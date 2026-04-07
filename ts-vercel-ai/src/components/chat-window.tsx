'use client';

import { useState, useMemo, useRef, useEffect, useCallback, type FormEvent, type ReactNode } from 'react';
import { type UIMessage, DefaultChatTransport, generateId, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { useChat } from '@ai-sdk/react';
import { toast } from 'sonner';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
import { ArrowDown, ArrowUpIcon, LoaderCircle, Shield, Lock, Unlock } from 'lucide-react';
import { useInterruptions } from '@auth0/ai-vercel/react';

import { TokenVaultInterruptHandler } from '@/components/TokenVaultInterruptHandler';
import { ChatMessageBubble } from '@/components/chat-message-bubble';
import { ScopePresetSelector } from '@/components/chat/scope-preset-selector';
import { RateLimitIndicator } from '@/components/chat/rate-limit-indicator';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';
import { getAgentProfile } from '@/lib/agents';
import { getPreset } from '@/lib/scope-presets';
import type { RateLimitResult } from '@/lib/rate-limiter';

// Human-readable labels for tool names, used in the welcome message
const TOOL_LABEL_MAP: Record<string, { label: string; icon: string }> = {
  gmailSearchTool: { label: 'Gmail Search', icon: '📧' },
  gmailDraftTool: { label: 'Gmail Draft', icon: '✏️' },
  getCalendarEventsTool: { label: 'Calendar', icon: '📅' },
  getTasksTool: { label: 'Tasks', icon: '✅' },
  createTasksTool: { label: 'Create Task', icon: '➕' },
  getUserInfoTool: { label: 'User Info', icon: '👤' },
};

// Suggested actions per agent, contextual to what each agent can do
// `prompt` is the display text shown in the welcome message.
// `submitPrompt` is the actual message sent when the quick action card is clicked.
interface AgentSuggestion {
  icon: string;
  label: string;
  description: string;
  prompt: string;
  submitPrompt: string;
}

const AGENT_SUGGESTIONS: Record<string, AgentSuggestion[]> = {
  progressive: [
    { icon: '📧', label: 'Triage Inbox', description: 'Categorize and prioritize', prompt: "'Triage my inbox'", submitPrompt: 'Triage my inbox' },
    { icon: '📅', label: "Today's Schedule", description: 'Check calendar for today', prompt: "'Give me a morning briefing: emails, calendar, and tasks'", submitPrompt: "What's on my calendar today?" },
    { icon: '✅', label: 'My Tasks', description: 'List pending tasks', prompt: "'List my current tasks'", submitPrompt: 'List my current tasks' },
    { icon: '✏️', label: 'Draft Email', description: 'Compose a new message', prompt: "'Show my latest emails, then draft a reply to the most urgent one'", submitPrompt: 'Draft an email to ' },
  ],
  reader: [
    { icon: '📧', label: 'Triage Inbox', description: 'Categorize and prioritize', prompt: "'Show me my recent emails'", submitPrompt: 'Triage my inbox' },
    { icon: '📅', label: "Today's Schedule", description: 'Check calendar for today', prompt: "'What's on my calendar today?'", submitPrompt: "What's on my calendar today?" },
    { icon: '✅', label: 'My Tasks', description: 'List pending tasks', prompt: "'List my current tasks'", submitPrompt: 'List my current tasks' },
  ],
  writer: [
    { icon: '✏️', label: 'Draft Email', description: 'Reply to latest message', prompt: "'Draft a reply to the last email from my manager'", submitPrompt: 'Draft a reply to the last email from my manager' },
    { icon: '➕', label: 'Create Task', description: 'Add a new to-do item', prompt: "'Add a task to follow up on the Q2 report'", submitPrompt: 'Add a task to follow up on the Q2 report' },
    { icon: '📝', label: 'Compose Message', description: 'Write from scratch', prompt: "'Write a professional out-of-office reply'", submitPrompt: 'Write a professional out-of-office reply' },
  ],
};

function buildWelcomeMessage(userName: string, agentId: string | undefined, presetId: string): UIMessage {
  const isProgressive = !agentId;
  const agent = agentId ? getAgentProfile(agentId) : undefined;
  const preset = getPreset(presetId);

  const presetName = preset?.name ?? 'Privacy';

  // In progressive mode, tools come from the preset only (no agent filter)
  // In strict mode, tools come from the intersection of agent and preset
  const presetTools = preset?.allowedTools ?? [];
  let availableTools: string[];
  if (presetId === 'lockdown') {
    availableTools = [];
  } else if (isProgressive) {
    availableTools = presetTools;
  } else {
    const agentTools = agent?.tools ?? [];
    availableTools = agentTools.filter((t) => presetTools.includes(t));
  }

  const toolLines = availableTools
    .map((t) => {
      const meta = TOOL_LABEL_MAP[t];
      return meta ? `${meta.icon} ${meta.label}` : null;
    })
    .filter(Boolean);

  const suggestions = isProgressive
    ? AGENT_SUGGESTIONS.progressive
    : (AGENT_SUGGESTIONS[agentId] ?? AGENT_SUGGESTIONS.reader);

  // Build the status line based on preset
  let statusLine: string;
  if (presetId === 'lockdown') {
    statusLine = '🔒 **Current Status:** Lockdown mode active. All external access is disabled.';
  } else if (availableTools.length === 0) {
    statusLine = '🔒 **Current Status:** No tools available in this preset/agent combination.';
  } else {
    statusLine = `🔒 **Current Status:** Zero permissions active. I'll request each scope as needed.`;
  }

  // Build intro line
  let introLine: string;
  if (isProgressive) {
    introLine = `Hello ${userName}! I'm **Scope Lock**, your progressive authorization assistant.\n`;
  } else {
    const agentName = agent?.name ?? 'Agent';
    const agentIcon = agent?.icon ?? '🤖';
    introLine = `Hello ${userName}! I'm your **${agentName}** ${agentIcon} running in **${presetName}** mode.\n`;
  }

  const sections = [introLine, statusLine];

  if (isProgressive && presetId !== 'lockdown') {
    sections.push('\nI start with **zero permissions** and request each one as needed. You approve every scope escalation before I access anything.');
  }

  if (toolLines.length > 0) {
    sections.push(`\n**Available tools:** ${toolLines.join(' · ')}`);
  }

  sections.push('\n**Try:**');
  suggestions.forEach((s, i) => {
    sections.push(`${i + 1}. ${s.icon} **${s.label}** — ${s.prompt}`);
  });

  if (presetId !== 'lockdown') {
    sections.push('\nEach action will request only the specific permission needed. You\'ll see the authorization card before I access anything.');
  } else {
    sections.push('\nSwitch to **Privacy** or **Productivity** mode below to enable tool access.');
  }

  return {
    id: 'welcome-message',
    role: 'assistant',
    parts: [{ type: 'text', text: sections.join('\n') }],
  };
}

// Map tool names to the services they represent
const TOOL_SERVICE_MAP: Record<string, { service: string; icon: string; level: 'read' | 'write' }> = {
  gmailSearchTool: { service: 'Gmail', icon: '📧', level: 'read' },
  gmailDraftTool: { service: 'Gmail', icon: '✏️', level: 'write' },
  getCalendarEventsTool: { service: 'Calendar', icon: '📅', level: 'read' },
  getTasksTool: { service: 'Tasks', icon: '✅', level: 'read' },
  createTasksTool: { service: 'Tasks', icon: '➕', level: 'write' },
};

function ActiveScopesBar({ messages }: { messages: UIMessage[] }) {
  // Derive which services have been accessed from tool calls in messages
  const activeServices = useMemo(() => {
    const services = new Map<string, { icon: string; level: 'read' | 'write'; grantedAt: number }>();
    for (const msg of messages) {
      const parts = (msg as any).parts;
      if (!Array.isArray(parts)) continue;
      for (const part of parts) {
        if (part?.type?.startsWith('tool-') && part.toolCallId) {
          const toolName = part.type.replace('tool-', '');
          const meta = TOOL_SERVICE_MAP[toolName];
          if (meta) {
            const existing = services.get(meta.service);
            // Upgrade to write if we see a write tool
            if (!existing || meta.level === 'write') {
              services.set(meta.service, { icon: meta.icon, level: existing?.level === 'write' ? 'write' : meta.level, grantedAt: existing?.grantedAt ?? Date.now() });
            }
          }
        }
      }
    }
    return services;
  }, [messages]);

  if (activeServices.size === 0) {
    return (
      <div className="flex items-center gap-2 px-3 md:px-4 py-2 bg-black/20 border-b border-white/5 text-xs text-white/40">
        <Shield className="w-3.5 h-3.5 shrink-0" />
        <Lock className="w-3 h-3 shrink-0" />
        <span className="truncate">Zero Trust — No services authorized. The agent will request each permission as needed.</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 bg-black/20 border-b border-white/5 text-xs overflow-x-auto">
      <div className="flex items-center gap-1.5 text-white/40 shrink-0">
        <Shield className="w-3.5 h-3.5 text-green-400" />
        <span className="hidden sm:inline">Active:</span>
      </div>
      {Array.from(activeServices.entries()).map(([name, { icon, level }]) => (
        <div key={name} className={cn(
          'flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all duration-500 shrink-0',
          level === 'write'
            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
            : 'bg-green-500/15 border-green-500/30 text-green-300'
        )}>
          <span>{icon}</span>
          <span>{name}</span>
          {level === 'write' ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
        </div>
      ))}
      <span className="text-white/30 ml-auto shrink-0 hidden sm:inline">{activeServices.size} service{activeServices.size !== 1 ? 's' : ''} authorized</span>
    </div>
  );
}

function QuickActions({
  agentId,
  presetId,
  onAction,
}: {
  agentId: string | undefined;
  presetId: string;
  onAction: (prompt: string) => void;
}) {
  const isProgressive = !agentId;
  const suggestions = isProgressive
    ? AGENT_SUGGESTIONS.progressive
    : (AGENT_SUGGESTIONS[agentId] ?? AGENT_SUGGESTIONS.reader);

  // In lockdown mode, no actions make sense
  if (presetId === 'lockdown') return null;

  // Filter out "Draft Email" for reader agents (no write tools)
  const filtered = suggestions.filter((s) => {
    if (agentId === 'reader' && s.submitPrompt.startsWith('Draft')) return false;
    return true;
  });

  return (
    <div className="flex flex-col max-w-[768px] mx-auto w-full px-3 md:px-0 pb-4">
      <p className="text-xs text-white/40 mb-3">Quick actions</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
        {filtered.map((suggestion) => (
          <button
            key={suggestion.submitPrompt}
            type="button"
            onClick={() => onAction(suggestion.submitPrompt)}
            className={cn(
              'flex flex-col gap-1 p-3 rounded-lg border border-white/10 bg-white/[0.03]',
              'hover:border-white/25 hover:bg-white/[0.06] transition-all text-left cursor-pointer',
              'group min-h-[72px]',
            )}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{suggestion.icon}</span>
              <span className="text-xs font-medium text-white/80 group-hover:text-white transition-colors">
                {suggestion.label}
              </span>
            </div>
            <span className="text-[11px] text-white/35 group-hover:text-white/50 transition-colors leading-tight">
              {suggestion.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Follow-up suggestions shown after the last assistant message
function getFollowUpSuggestions(messages: UIMessage[]): Array<{ icon: string; label: string; prompt: string }> | null {
  if (messages.length < 2) return null;

  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
  if (!lastAssistant) return null;

  const text = ((lastAssistant as any).parts ?? [])
    .map((p: any) => (typeof p === 'string' ? p : p?.text ?? ''))
    .join('')
    .toLowerCase();

  // After a triage / inbox response, suggest follow-ups
  const hasEmailContent = text.includes('email') || text.includes('inbox') || text.includes('subject');
  const hasCalendarContent = text.includes('calendar') || text.includes('meeting') || text.includes('schedule');
  const hasTaskContent = text.includes('task') || text.includes('to-do') || text.includes('todo');

  const followUps: Array<{ icon: string; label: string; prompt: string }> = [];

  if (hasEmailContent && !hasCalendarContent) {
    followUps.push({ icon: '📅', label: 'Check calendar', prompt: "What's on my calendar today?" });
  }
  if (hasEmailContent && !hasTaskContent) {
    followUps.push({ icon: '✅', label: 'Show my tasks', prompt: 'List my current tasks' });
  }
  if (hasEmailContent) {
    followUps.push({ icon: '✏️', label: 'Reply to most urgent', prompt: 'Draft a reply to the most urgent email' });
  }
  if (hasCalendarContent && !hasEmailContent) {
    followUps.push({ icon: '📧', label: 'Check inbox', prompt: 'Triage my inbox' });
  }
  if (hasTaskContent && !hasEmailContent) {
    followUps.push({ icon: '📧', label: 'Check inbox', prompt: 'Triage my inbox' });
  }

  return followUps.length > 0 ? followUps.slice(0, 3) : null;
}

function FollowUpActions({
  messages,
  isLoading,
  onAction,
}: {
  messages: UIMessage[];
  isLoading: boolean;
  onAction: (prompt: string) => void;
}) {
  const suggestions = useMemo(() => getFollowUpSuggestions(messages), [messages]);

  // Don't show while streaming or if there are no suggestions
  if (isLoading || !suggestions) return null;

  // Only show after the last message is from the assistant
  const lastMsg = messages[messages.length - 1];
  if (!lastMsg || lastMsg.role !== 'assistant') return null;

  return (
    <div className="flex flex-col max-w-[768px] mx-auto w-full px-3 md:px-0 pt-2 pb-4">
      <div className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <button
            key={s.prompt}
            type="button"
            onClick={() => onAction(s.prompt)}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs',
              'border border-white/10 bg-white/[0.03]',
              'hover:border-white/25 hover:bg-white/[0.06] transition-all cursor-pointer',
              'text-white/60 hover:text-white/80',
            )}
          >
            <span>{s.icon}</span>
            <span>{s.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatMessages(props: {
  messages: UIMessage[];
  aiEmoji?: string;
  className?: string;
}) {
  return (
    <div className="flex flex-col max-w-[768px] mx-auto pb-12 w-full px-3 md:px-0">
      {props.messages.map((m) => {
        return <ChatMessageBubble key={m.id} message={m} aiEmoji={props.aiEmoji} />;
      })}
    </div>
  );
}

function ScrollToBottom(props: { className?: string }) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  if (isAtBottom) return null;
  return (
    <Button variant="outline" className={props.className} onClick={() => scrollToBottom()}>
      <ArrowDown className="w-4 h-4" />
      <span>Scroll to bottom</span>
    </Button>
  );
}

function ChatInput(props: {
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading?: boolean;
  placeholder?: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <form
      onSubmit={(e) => {
        e.stopPropagation();
        e.preventDefault();
        props.onSubmit(e);
      }}
      className={cn('flex w-full flex-col', props.className)}
    >
      <div className="border border-input bg-background rounded-lg flex flex-col gap-2 max-w-[768px] w-full mx-auto">
        <input
          value={props.value}
          placeholder={props.placeholder}
          onChange={props.onChange}
          className="border-none outline-none bg-transparent p-3 md:p-4 text-sm md:text-base min-h-[44px]"
        />

        <div className="flex justify-between ml-3 md:ml-4 mr-2 mb-2">
          <div className="flex gap-2 md:gap-3">{props.children}</div>

          <Button
            className="rounded-full p-1.5 h-fit border dark:border-zinc-600 min-w-[44px] min-h-[44px] flex items-center justify-center"
            type="submit"
            disabled={props.loading}
          >
            {props.loading ? <LoaderCircle className="animate-spin" /> : <ArrowUpIcon size={14} />}
          </Button>
        </div>
      </div>
    </form>
  );
}

function StickyToBottomContent(props: {
  content: ReactNode;
  footer?: ReactNode;
  className?: string;
  contentClassName?: string;
}) {
  const context = useStickToBottomContext();

  // scrollRef will also switch between overflow: unset to overflow: auto
  return (
    <div
      ref={context.scrollRef}
      style={{ width: '100%', height: '100%' }}
      className={cn('grid grid-rows-[1fr,auto]', props.className)}
    >
      <div ref={context.contentRef} className={props.contentClassName}>
        {props.content}
      </div>

      {props.footer}
    </div>
  );
}

function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

export function ChatWindow(props: {
  endpoint: string;
  emptyStateComponent: ReactNode;
  placeholder?: string;
  emoji?: string;
  agentId?: string;
  userName?: string;
  strictMode?: boolean;
}) {
  // Progressive mode defaults to 'productivity' (all tools available, scopes earned via Token Vault)
  // Strict isolation mode defaults to 'privacy' (read-only)
  const defaultPreset = props.strictMode ? 'privacy' : 'productivity';
  const [presetId, setPresetId] = useState(defaultPreset);

  // Reset preset when mode changes
  const prevStrictMode = usePrevious(props.strictMode);
  if (prevStrictMode !== undefined && prevStrictMode !== props.strictMode) {
    const newDefault = props.strictMode ? 'privacy' : 'productivity';
    if (presetId !== newDefault) {
      setPresetId(newDefault);
    }
  }

  const welcomeMessage = useMemo(
    () => buildWelcomeMessage(props.userName ?? 'there', props.agentId, presetId),
    [props.userName, props.agentId, presetId],
  );

  const apiUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (props.agentId) params.set('agentId', props.agentId);
    params.set('preset', presetId);
    const qs = params.toString();
    return qs ? `${props.endpoint}?${qs}` : props.endpoint;
  }, [props.endpoint, props.agentId, presetId]);

  const { messages, sendMessage, status, toolInterrupt } = useInterruptions((handler) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useChat({
      transport: new DefaultChatTransport({
        api: apiUrl,
      }),
      generateId,
      onError: handler((e: Error) => {
        console.error('Error: ', e);
        toast.error(`Error while processing your request`, { description: e.message });
      }),
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    }),
  );

  const [input, setInput] = useState('');
  const [interruptDismissed, setInterruptDismissed] = useState(false);
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitResult | null>(null);

  // Reset dismissed state when a new interrupt arrives
  const prevInterrupt = usePrevious(toolInterrupt);
  if (toolInterrupt && toolInterrupt !== prevInterrupt) {
    if (interruptDismissed) {
      setInterruptDismissed(false);
    }
  }

  const fetchRateLimitStatus = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (props.agentId) params.set('agentId', props.agentId);
      const qs = params.toString();
      const url = qs ? `/api/rate-limit?${qs}` : '/api/rate-limit';
      const res = await fetch(url);
      if (res.ok) {
        const data: RateLimitResult = await res.json();
        setRateLimitStatus(data);
      }
    } catch {
      // Silently ignore fetch errors — indicator will stay hidden
    }
  }, [props.agentId]);

  // Fetch initial status on mount and when agentId changes
  useEffect(() => {
    fetchRateLimitStatus();
  }, [fetchRateLimitStatus]);

  const isChatLoading = status === 'streaming';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() || isChatLoading) return;
    const text = input;
    setInput('');
    await sendMessage({ text });
    // Refresh rate limit status after sending a message
    fetchRateLimitStatus();
  }

  const handleQuickAction = useCallback(async (prompt: string) => {
    if (isChatLoading) return;
    // "Draft an email to " is a special case: pre-fill the input instead of submitting
    if (prompt.endsWith(' ')) {
      setInput(prompt);
      return;
    }
    setInput('');
    await sendMessage({ text: prompt });
    fetchRateLimitStatus();
  }, [isChatLoading, sendMessage, fetchRateLimitStatus]);

  return (
    <div className="absolute inset-0 flex flex-col">
      <ActiveScopesBar messages={messages} />
      <div className="flex-1 relative">
        <StickToBottom>
          <StickyToBottomContent
            className="absolute inset-0"
            contentClassName="py-4 md:py-8 px-2"
            content={
              messages.length === 0 ? (
                <div>
                  {props.emptyStateComponent}
                  <div className="flex flex-col max-w-[768px] mx-auto pt-4 w-full px-3 md:px-0">
                    <ChatMessageBubble message={welcomeMessage} aiEmoji={props.emoji} />
                  </div>
                  <QuickActions
                    agentId={props.agentId}
                    presetId={presetId}
                    onAction={handleQuickAction}
                  />
                </div>
              ) : (
                <>
                  <ChatMessages aiEmoji={props.emoji} messages={messages} />
                  <FollowUpActions
                    messages={messages}
                    isLoading={isChatLoading}
                    onAction={handleQuickAction}
                  />
                  {!interruptDismissed && (
                    <div className="flex flex-col max-w-[768px] mx-auto pb-12 w-full px-3 md:px-0">
                      <TokenVaultInterruptHandler
                        interrupt={toolInterrupt}
                        onCancel={() => setInterruptDismissed(true)}
                      />
                    </div>
                  )}
                </>
              )
            }
            footer={
              <div className="sticky bottom-4 md:bottom-8 px-3 md:px-2">
                <ScrollToBottom className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4" />
                {props.strictMode && <ScopePresetSelector activePresetId={presetId} onPresetChange={setPresetId} />}
                <ChatInput
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onSubmit={onSubmit}
                  loading={isChatLoading}
                  placeholder={props.placeholder ?? 'What can I help you with?'}
                ></ChatInput>
              </div>
            }
          ></StickyToBottomContent>
        </StickToBottom>
      </div>
    </div>
  );
}
