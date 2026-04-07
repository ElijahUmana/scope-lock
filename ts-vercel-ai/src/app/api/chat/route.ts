import { NextRequest, NextResponse } from 'next/server';
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
import { getTasksTool, createTasksTool, deleteTaskTool, completeTaskTool } from '@/lib/tools/google-tasks';
// shopOnlineTool, listRepositories, listGitHubEvents disabled — require CIBA/GitHub Token Vault config
import { logToolCall } from '@/lib/audit';
import { recordScopeRequest } from '@/lib/actions/audit';
import { evaluatePolicy } from '@/lib/policy-engine';
import { checkForAnomalies } from '@/lib/anomaly-detection';
import { getPreset, getToolNamesForPreset } from '@/lib/scope-presets';
import { auth0 } from '@/lib/auth0';
import { getAgentProfile, getToolsForAgent } from '@/lib/agents';
import { grantScope } from '@/lib/scope-ttl';
import { checkRateLimit } from '@/lib/rate-limiter';
import {
  getAgentSession,
  startAgentSession,
  createDelegation,
  incrementToolCallCount,
  addScopeGrant,
} from '@/lib/agent-orchestrator';

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

MANDATORY CROSS-SERVICE SUGGESTIONS:
After presenting the email triage report, you MUST ALWAYS append a "Next Steps" section. This is NOT optional. Pick SPECIFIC emails from the triage results and suggest concrete actions using other Google services. Use the actual email subjects and senders — never be generic.

You MUST include ALL THREE of these suggestions every time, referencing real emails from the triage:
1. Pick one email that mentions a time, date, meeting, event, or schedule → suggest checking the calendar for that date
2. Pick one email that needs follow-up, has a deadline, or requires action → suggest creating a task with a specific title and due date
3. Pick the most urgent or time-sensitive email → suggest drafting a reply

Format the Next Steps section EXACTLY like this (using actual email content, not placeholders):

**Next Steps — I can help further with additional permissions:**
📅 *Check calendar* — Email #X from [sender] mentions [meeting/event]. I can check your availability for [date]. (Requires: calendar.events scope, GREEN risk)
✅ *Create task* — Email #Y from [sender] needs follow-up by [date]. I can create a reminder: "[specific task title]". (Requires: tasks scope, GREEN risk)
✏️ *Draft reply* — Email #Z from [sender] is urgent. I can draft a response. (Requires: gmail.compose scope, AMBER risk — this is a write operation)

Just tell me which one you'd like to do first.

This section demonstrates PROGRESSIVE scope expansion across multiple Google services within a single conversation. Each suggestion requires the user to grant a NEW scope, showing the least-privilege model in action.

SECURITY PRINCIPLES:
- Every API call goes through Auth0 Token Vault — tokens are never exposed to you (the LLM)
- Each service connection has isolated credentials with specific scope boundaries
- Write operations can trigger step-up authentication via CIBA (mobile push notification)
- Users can revoke any permission at any time from the Permission Dashboard
`;

const PROGRESSIVE_MODE_ADDITION = `You are a UNIFIED progressive authorization agent. You have access to ALL tools — read, write, and commerce — within a single conversation. You do NOT tell users to "switch agents." Instead, you progressively request each scope as the conversation naturally requires it.

When the user starts with a read operation (e.g., "triage my inbox"), use read tools first. When they then ask for a write operation (e.g., "draft a reply to that email"), explain the scope escalation clearly:
- "To draft this reply, I need to escalate from read-only to write access. This requires the gmail.compose scope — a higher-privilege operation. I'll request this permission now."

Then proceed with the write tool in the SAME conversation. This is the core progressive authorization experience: scopes accumulate naturally as the user's needs expand, with explicit approval at each escalation.`;

function buildSystemPrompt(agentAddition?: string): string {
  const dateLine = `The current date and time is ${new Date().toISOString()}.`;
  const base = AGENT_SYSTEM_TEMPLATE + dateLine;
  if (agentAddition) {
    return `${base}\n\nAGENT ROLE:\n${agentAddition}`;
  }
  // No agent specified = progressive mode
  return `${base}\n\nAGENT ROLE:\n${PROGRESSIVE_MODE_ADDITION}`;
}

// Map tool names to their scopes and connections for audit logging
const TOOL_SCOPE_MAP: Record<string, { scopes: string[]; connection: string; credentialsContext: string }> = {
  gmailSearchTool: { scopes: ['gmail.readonly'], connection: 'google-oauth2', credentialsContext: 'thread' },
  gmailDraftTool: { scopes: ['gmail.compose'], connection: 'google-oauth2', credentialsContext: 'tool-call' },
  getCalendarEventsTool: { scopes: ['calendar.events'], connection: 'google-oauth2', credentialsContext: 'thread' },
  getTasksTool: { scopes: ['tasks'], connection: 'google-oauth2', credentialsContext: 'thread' },
  createTasksTool: { scopes: ['tasks'], connection: 'google-oauth2', credentialsContext: 'thread' },
  getUserInfoTool: { scopes: ['openid', 'profile'], connection: 'auth0', credentialsContext: 'thread' },
  deleteTaskTool: { scopes: ['tasks'], connection: 'google-oauth2', credentialsContext: 'tool-call' },
  completeTaskTool: { scopes: ['tasks'], connection: 'google-oauth2', credentialsContext: 'tool-call' },
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
  deleteTaskTool,
  completeTaskTool,
};

const ALL_TOOL_NAMES = Object.keys(ALL_TOOLS);

// Cache for filtered tool sets keyed by "agentId|presetId"
const toolSetCache = new Map<string, Record<string, any>>();

function getFilteredTools(agentId: string | null, presetId: string): Record<string, any> {
  const cacheKey = `${agentId ?? ''}|${presetId}`;
  const cached = toolSetCache.get(cacheKey);
  if (cached) return cached;

  const allowedToolNames = agentId ? getToolsForAgent(agentId) : null;
  // If presetId is invalid/unknown, fall back to the default 'privacy' preset.
  // Never skip preset filtering — that would expose all tools.
  const resolvedPresetId = getPreset(presetId) ? presetId : 'privacy';
  const presetToolNames = getToolNamesForPreset(resolvedPresetId);

  // Build a Set of names that pass both filters for O(1) lookups.
  // presetToolNames is always an array (never null) so preset filtering always applies.
  let allowedSet: Set<string>;
  if (allowedToolNames) {
    // Intersection of agent tools and preset tools
    const presetSet = new Set(presetToolNames);
    allowedSet = new Set(allowedToolNames.filter((n) => presetSet.has(n)));
  } else {
    allowedSet = new Set(presetToolNames);
  }

  const filtered: Record<string, any> = Object.fromEntries(
    ALL_TOOL_NAMES
      .filter((name) => allowedSet.has(name))
      .map((name) => [name, ALL_TOOLS[name]]),
  );

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

  // --- Delegation tracking ---
  // Detect agent switches by comparing the incoming agentId against the
  // session's stored agentId.  The session persists in-memory across requests
  // for the same serverless instance, which is the same guarantee the rest of
  // the in-memory stores (audit log, scope-ttl, etc.) rely on.
  const effectiveAgentId = agentId ?? 'reader';
  const existingSession = getAgentSession(userId);

  if (!existingSession) {
    // First request for this user — initialise the session
    startAgentSession(userId, effectiveAgentId);
  } else if (existingSession.agentId !== effectiveAgentId) {
    // Agent changed — record the delegation, then start a new session.
    // The new session carries forward the existing delegation chain.
    const fromProfile = getAgentProfile(existingSession.agentId);
    const toProfile = getAgentProfile(effectiveAgentId);
    createDelegation(
      existingSession.agentId,
      effectiveAgentId,
      toProfile?.tools ?? [],
      `User switched from ${fromProfile?.name ?? existingSession.agentId} to ${toProfile?.name ?? effectiveAgentId}`,
      userId,
    );
    startAgentSession(userId, effectiveAgentId);
  }

  // Rate limit check — must happen before any LLM call
  const rateLimit = checkRateLimit(userId, agentId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: 'Rate limit exceeded',
        remaining: 0,
        resetIn: rateLimit.resetIn,
        limit: rateLimit.limit,
      },
      { status: 429 },
    );
  }

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
                incrementToolCallCount(userId);
                // Record granted scopes on the agent session
                const meta = TOOL_SCOPE_MAP[part.toolName];
                if (meta) {
                  for (const scope of meta.scopes) {
                    addScopeGrant(userId, scope);
                  }
                }
              }
              if (part.type === 'tool-error') {
                processAuditEntry(part.toolName, part.input, false, userId);
                incrementToolCallCount(userId);
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
