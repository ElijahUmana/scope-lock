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
import { logToolCall } from '@/lib/audit';
import { recordScopeRequest } from '@/lib/actions/audit';
import { evaluatePolicy } from '@/lib/policy-engine';
import { checkForAnomalies } from '@/lib/anomaly-detection';
import { getPreset, getToolNamesForPreset } from '@/lib/scope-presets';
import { auth0 } from '@/lib/auth0';
import { getAgentProfile, getToolsForAgent } from '@/lib/agents';
import { grantScope } from '@/lib/scope-ttl';

const AGENT_SYSTEM_TEMPLATE = `You are an Email Triage Agent — an AI assistant that helps busy professionals triage their inbox, manage their schedule, and stay on top of follow-ups. You operate on the principle of LEAST PRIVILEGE — you never assume access, you earn it.

You specialize in email triage and productivity. When asked to help with emails:
1. First, search for recent unread or important emails
2. Categorize them: URGENT (needs immediate response), ACTION (needs follow-up), INFORMATIONAL (FYI only), LOW PRIORITY
3. For each email, suggest an action: Reply, Forward, Create Task, Archive, or Ignore
4. If the user wants to act on an email, request the appropriate additional scope (e.g., gmail.compose for drafting a reply, or tasks for creating a follow-up)

When presenting emails, format them as a clean triage report:
📧 **URGENT** — [Subject] from [Sender]
   Suggested action: Reply

📋 **ACTION** — [Subject] from [Sender]
   Suggested action: Create follow-up task

ℹ️ **INFO** — [Subject] from [Sender]
   Suggested action: Archive

PROGRESSIVE AUTHORIZATION BEHAVIOR:
1. BEFORE accessing any service (Gmail, Calendar, Tasks), ALWAYS tell the user:
   - Which service you need to access
   - What specific permission (scope) is required (e.g., "read-only Gmail access")
   - WHY you need it for their request
   - Example: "To triage your inbox, I'll need read-only access to your Gmail. This uses the gmail.readonly scope through Auth0 Token Vault. I'll request this permission now."

2. AFTER accessing a service, confirm what you accessed:
   - "I retrieved your latest 10 emails using read-only Gmail access."

3. For WRITE operations (drafting emails, creating tasks), explicitly warn about scope escalation:
   - "This requires WRITE access to [service]. This is a higher-privilege operation than reading. I'll request gmail.compose scope now."

4. NEVER access multiple services without explaining each one.

5. When displaying results:
   - Format emails cleanly with Subject, From, and Snippet fields
   - Format calendar events with time, title, and attendees
   - NEVER show raw HTML, JSON, or API responses to the user

6. For tool arguments, always provide valid JSON.

TRIAGE WORKFLOW:
- Start with gmail.readonly to read and categorize emails (Reader Agent, GREEN risk)
- Escalate to gmail.compose only when the user wants to draft a reply (Writer Agent, AMBER risk — scope escalation visible)
- Use calendar.events to check availability for meeting requests
- Use tasks to create follow-up items from emails that need action

SECURITY PRINCIPLES:
- Every API call goes through Auth0 Token Vault — tokens are never exposed to you (the LLM)
- Each service connection has isolated credentials with specific scope boundaries
- Write operations can trigger step-up authentication via CIBA (mobile push notification)
- Users can revoke any permission at any time from the Permission Dashboard
`;

function buildSystemPrompt(agentAddition?: string): string {
  const dateLine = `The current date and time is ${new Date().toISOString()}.`;
  const base = AGENT_SYSTEM_TEMPLATE + dateLine;
  return agentAddition
    ? `${base}\n\nAGENT ROLE:\n${agentAddition}`
    : base;
}

// Map tool names to their scopes and connections for audit logging
const TOOL_SCOPE_MAP: Record<string, { scopes: string[]; connection: string; credentialsContext: string }> = {
  gmailSearchTool: { scopes: ['gmail.readonly'], connection: 'google-oauth2', credentialsContext: 'thread' },
  gmailDraftTool: { scopes: ['gmail.compose'], connection: 'google-oauth2', credentialsContext: 'tool-call' },
  getCalendarEventsTool: { scopes: ['calendar.events'], connection: 'google-oauth2', credentialsContext: 'thread' },
  getTasksTool: { scopes: ['tasks'], connection: 'google-oauth2', credentialsContext: 'thread' },
  createTasksTool: { scopes: ['tasks'], connection: 'google-oauth2', credentialsContext: 'thread' },
  getUserInfoTool: { scopes: ['openid', 'profile'], connection: 'auth0', credentialsContext: 'thread' },
  shopOnlineTool: { scopes: ['product:buy'], connection: 'ciba', credentialsContext: 'tool-call' },
};

const UNKNOWN_META = { scopes: [] as string[], connection: 'unknown', credentialsContext: 'unknown' };

// All available tools — static, built once at module load
const ALL_TOOLS: Record<string, any> = {
  ...(serpApiTool ? { serpApiTool } : {}),
  getUserInfoTool,
  gmailSearchTool,
  gmailDraftTool,
  getCalendarEventsTool,
  getTasksTool,
  createTasksTool,
  shopOnlineTool,
};

const ALL_TOOL_NAMES = Object.keys(ALL_TOOLS);

// Cache for filtered tool sets keyed by "agentId|presetId"
const toolSetCache = new Map<string, Record<string, any>>();

function getFilteredTools(agentId: string | null, presetId: string): Record<string, any> {
  const cacheKey = `${agentId ?? ''}|${presetId}`;
  const cached = toolSetCache.get(cacheKey);
  if (cached) return cached;

  const allowedToolNames = agentId ? getToolsForAgent(agentId) : null;
  const presetToolNames = getPreset(presetId) ? getToolNamesForPreset(presetId) : null;

  // Build a Set of names that pass both filters for O(1) lookups
  let allowedSet: Set<string> | null = null;
  if (allowedToolNames && presetToolNames !== null) {
    // Intersection of agent tools and preset tools
    const presetSet = new Set(presetToolNames);
    allowedSet = new Set(allowedToolNames.filter((n) => presetSet.has(n)));
  } else if (allowedToolNames) {
    allowedSet = new Set(allowedToolNames);
  } else if (presetToolNames !== null) {
    allowedSet = new Set(presetToolNames);
  }

  let filtered: Record<string, any>;
  if (allowedSet) {
    filtered = Object.fromEntries(
      ALL_TOOL_NAMES
        .filter((name) => allowedSet!.has(name))
        .map((name) => [name, ALL_TOOLS[name]]),
    );
  } else {
    filtered = ALL_TOOLS;
  }

  toolSetCache.set(cacheKey, filtered);
  return filtered;
}

function processAuditEntry(
  toolName: string,
  input: unknown,
  success: boolean,
  userId: string,
) {
  const meta = TOOL_SCOPE_MAP[toolName] ?? UNKNOWN_META;
  const policy = evaluatePolicy(toolName, input);
  const now = new Date().toISOString();
  const auditEntry = logToolCall({
    toolName,
    scopes: meta.scopes,
    timestamp: now,
    success,
    duration: 0,
    userId,
    connection: meta.connection,
    credentialsContext: meta.credentialsContext,
    riskLevel: policy.level,
  });
  const alerts = checkForAnomalies(userId, auditEntry);
  if (alerts.length > 0) {
    console.warn(`[anomaly] ${alerts.length} alert(s) for user ${userId}:`, alerts.map((a) => a.type));
  }
  recordScopeRequest(userId, {
    connection: meta.connection,
    scopes: meta.scopes,
    requestedAt: Date.now(),
    grantedAt: success ? Date.now() : null,
    status: success ? 'granted' : 'denied',
  });
  if (success) {
    grantScope(userId, meta.connection, meta.scopes, policy.level);
  }
}

export async function POST(req: NextRequest) {
  const agentId = req.nextUrl.searchParams.get('agentId');
  const presetId = req.nextUrl.searchParams.get('preset') ?? 'privacy';

  // Resolve tools from cache (no per-request object allocation)
  const tools = getFilteredTools(agentId, presetId);

  // Parse body and resolve session in parallel
  const [body, session] = await Promise.all([
    req.json() as Promise<{ id: string; messages: Array<UIMessage> }>,
    auth0.getSession(),
  ]);

  const { id, messages } = body;
  const userId = session?.user?.sub ?? 'anonymous';

  setAIContext({ threadID: id });

  // Build system prompt with fresh timestamp per request
  const agentProfile = agentId ? getAgentProfile(agentId) : undefined;
  const systemPrompt = buildSystemPrompt(agentProfile?.systemPromptAddition);

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
            for (const part of output.content) {
              if (part.type === 'tool-call') {
                processAuditEntry(part.toolName, part.input, true, userId);
              }
              if (part.type === 'tool-error') {
                processAuditEntry(part.toolName, part.input, false, userId);
              }
            }

            if (output.finishReason === 'tool-calls') {
              const lastMessage = output.content[output.content.length - 1];
              if (lastMessage?.type === 'tool-error') {
                const { toolName, toolCallId, error, input } = lastMessage;
                throw {
                  cause: error,
                  toolCallId,
                  toolName,
                  toolArgs: input,
                };
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
