import { NextRequest } from 'next/server';
import {
  streamText,
  type UIMessage,
  createUIMessageStream,
  createUIMessageStreamResponse,
  convertToModelMessages,
} from 'ai';
import { openai } from '@ai-sdk/openai';
import { setAIContext } from '@auth0/ai-vercel';
import { errorSerializer, withInterruptions } from '@auth0/ai-vercel/interrupts';

import { serpApiTool } from '@/lib/tools/serpapi';
import { getUserInfoTool } from '@/lib/tools/user-info';
import { gmailDraftTool, gmailSearchTool } from '@/lib/tools/gmail';
import { getCalendarEventsTool } from '@/lib/tools/google-calender';
import { getTasksTool, createTasksTool } from '@/lib/tools/google-tasks';
import { shopOnlineTool } from '@/lib/tools/shop-online';
// import { getContextDocumentsTool } from '@/lib/tools/context-docs'; // requires FGA + postgres
import { listRepositories } from '@/lib/tools/list-gh-repos';
import { listGitHubEvents } from '@/lib/tools/list-gh-events';
import { listSlackChannels } from '@/lib/tools/list-slack-channels';
import { logToolCall } from '@/lib/audit';
import { recordScopeRequest } from '@/lib/actions/audit';
import { evaluatePolicy } from '@/lib/policy-engine';
import { getPreset, getToolNamesForPreset } from '@/lib/scope-presets';
import { auth0 } from '@/lib/auth0';
import { getAgentProfile, getToolsForAgent } from '@/lib/agents';

const date = new Date().toISOString();

const AGENT_SYSTEM_TEMPLATE = `You are Scope Lock, a security-first AI agent that demonstrates progressive authorization. You operate on the principle of LEAST PRIVILEGE — you never assume access, you earn it.

CORE BEHAVIOR:
1. BEFORE accessing any service (Gmail, Calendar, GitHub, Tasks, Slack), ALWAYS tell the user:
   - Which service you need to access
   - What specific permission (scope) is required (e.g., "read-only Gmail access")
   - WHY you need it for their request
   - Example: "To check your emails, I'll need read-only access to your Gmail. This uses the gmail.readonly scope through Auth0 Token Vault. I'll request this permission now."

2. AFTER accessing a service, confirm what you accessed:
   - "I retrieved your latest 10 emails using read-only Gmail access."

3. For WRITE operations (drafting emails, creating tasks), explicitly warn:
   - "This requires WRITE access to [service]. This is a higher-privilege operation. I'll request gmail.compose scope now."

4. NEVER access multiple services without explaining each one.

5. When displaying results:
   - Format emails cleanly with Subject, From, and Snippet fields
   - Format calendar events with time, title, and attendees
   - Format GitHub repos with name, description, and language
   - NEVER show raw HTML, JSON, or API responses to the user

6. For tool arguments, always provide valid JSON.

SECURITY PRINCIPLES:
- Every API call goes through Auth0 Token Vault — tokens are never exposed to you (the LLM)
- Each service connection has isolated credentials with specific scope boundaries
- Write operations can trigger step-up authentication via CIBA (mobile push notification)
- Users can revoke any permission at any time from the Permission Dashboard

The current date and time is ${date}.`;

/**
 * This handler initializes and calls an tool calling agent.
 */
// Map tool names to their scopes and connections for audit logging
const TOOL_SCOPE_MAP: Record<string, { scopes: string[]; connection: string; credentialsContext: string }> = {
  gmailSearchTool: { scopes: ['gmail.readonly'], connection: 'google-oauth2', credentialsContext: 'thread' },
  gmailDraftTool: { scopes: ['gmail.compose'], connection: 'google-oauth2', credentialsContext: 'tool-call' },
  getCalendarEventsTool: { scopes: ['calendar.events'], connection: 'google-oauth2', credentialsContext: 'thread' },
  getTasksTool: { scopes: ['tasks'], connection: 'google-oauth2', credentialsContext: 'thread' },
  createTasksTool: { scopes: ['tasks'], connection: 'google-oauth2', credentialsContext: 'thread' },
  listRepositories: { scopes: ['repo'], connection: 'github', credentialsContext: 'tool-call' },
  listGitHubEvents: { scopes: ['events'], connection: 'github', credentialsContext: 'tool-call' },
  listSlackChannels: { scopes: ['channels:read'], connection: 'slack', credentialsContext: 'tool-call' },
  getUserInfoTool: { scopes: ['openid', 'profile'], connection: 'auth0', credentialsContext: 'thread' },
  shopOnlineTool: { scopes: ['product:buy'], connection: 'ciba', credentialsContext: 'tool-call' },
};

export async function POST(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId');
  const presetId = req.nextUrl.searchParams.get('preset') ?? 'privacy';
  const agentProfile = agentId ? getAgentProfile(agentId) : undefined;
  const allowedToolNames = agentId ? getToolsForAgent(agentId) : null;
  const preset = getPreset(presetId);
  const presetToolNames = preset ? getToolNamesForPreset(presetId) : null;

  const { id, messages }: { id: string; messages: Array<UIMessage> } = await req.json();

  setAIContext({ threadID: id });

  // Get user for audit logging
  const session = await auth0.getSession();
  const userId = session?.user?.sub ?? 'anonymous';

  // All available tools — keyed by name
  const allTools: Record<string, any> = {
    ...(serpApiTool ? { serpApiTool } : {}),
    getUserInfoTool,
    gmailSearchTool,
    gmailDraftTool,
    getCalendarEventsTool,
    getTasksTool,
    createTasksTool,
    shopOnlineTool,
    // getContextDocumentsTool, // requires FGA + postgres
    // listRepositories,      // GitHub Token Vault connection not configured — re-enable when ready
    // listGitHubEvents,      // GitHub Token Vault connection not configured — re-enable when ready
    // listSlackChannels,     // Slack Token Vault connection not configured — re-enable when ready
  };

  // Scope isolation: apply both agent and preset filters.
  // Agent filtering: only include the agent's authorized tools.
  // Preset filtering: further restrict to only the preset's allowed tools.
  // The intersection enforces least-privilege — the LLM literally cannot invoke
  // tools outside both the agent's and the preset's allowed sets.
  let tools: Record<string, any> = allTools;

  if (allowedToolNames) {
    tools = Object.fromEntries(
      Object.entries(tools).filter(([name]) => allowedToolNames.includes(name)),
    );
  }

  if (presetToolNames !== null) {
    // Lockdown preset has an empty allowedTools array, which means zero tools
    tools = Object.fromEntries(
      Object.entries(tools).filter(([name]) => presetToolNames.includes(name)),
    );
  }

  // Build system prompt with agent-specific addition
  const systemPrompt = agentProfile
    ? `${AGENT_SYSTEM_TEMPLATE}\n\nAGENT ROLE:\n${agentProfile.systemPromptAddition}`
    : AGENT_SYSTEM_TEMPLATE;

  const modelMessages = await convertToModelMessages(messages);

  const stream = createUIMessageStream({
    originalMessages: messages,
    execute: withInterruptions(
      async ({ writer }) => {
        const result = streamText({
          model: openai.chat('gpt-4o'),
          system: systemPrompt,
          messages: modelMessages,
          tools: tools as any,
          onFinish: (output) => {
            // Audit log every tool call
            for (const part of output.content) {
              if (part.type === 'tool-call') {
                const meta = TOOL_SCOPE_MAP[part.toolName] ?? { scopes: [], connection: 'unknown', credentialsContext: 'unknown' };
                const policy = evaluatePolicy(part.toolName, part.input);
                const now = new Date().toISOString();
                logToolCall({
                  toolName: part.toolName,
                  scopes: meta.scopes,
                  timestamp: now,
                  success: true,
                  duration: 0,
                  userId,
                  connection: meta.connection,
                  credentialsContext: meta.credentialsContext,
                  riskLevel: policy.level,
                });
                // Record scope request for the dashboard timeline
                recordScopeRequest(userId, {
                  connection: meta.connection,
                  scopes: meta.scopes,
                  requestedAt: Date.now(),
                  grantedAt: Date.now(),
                  status: 'granted',
                });
              }
              if (part.type === 'tool-error') {
                const meta = TOOL_SCOPE_MAP[part.toolName] ?? { scopes: [], connection: 'unknown', credentialsContext: 'unknown' };
                const policy = evaluatePolicy(part.toolName, part.input);
                const now = new Date().toISOString();
                logToolCall({
                  toolName: part.toolName,
                  scopes: meta.scopes,
                  timestamp: now,
                  success: false,
                  duration: 0,
                  userId,
                  connection: meta.connection,
                  credentialsContext: meta.credentialsContext,
                  riskLevel: policy.level,
                });
                // Record failed scope request
                recordScopeRequest(userId, {
                  connection: meta.connection,
                  scopes: meta.scopes,
                  requestedAt: Date.now(),
                  grantedAt: null,
                  status: 'denied',
                });
              }
            }

            if (output.finishReason === 'tool-calls') {
              const lastMessage = output.content[output.content.length - 1];
              if (lastMessage?.type === 'tool-error') {
                const { toolName, toolCallId, error, input } = lastMessage;
                const serializableError = {
                  cause: error,
                  toolCallId: toolCallId,
                  toolName: toolName,
                  toolArgs: input,
                };

                throw serializableError;
              }
            }
          },
        });

        writer.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      {
        messages: messages,
        tools: tools as any,
      },
    ),
    onError: errorSerializer((err) => {
      console.log(err);
      return `An error occurred! ${(err as Error).message}`;
    }),
  });

  return createUIMessageStreamResponse({ stream });
}
