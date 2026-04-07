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
  shopOnlineTool: { label: 'Shop Online', icon: '🛒' },
};

// Suggested actions per agent, contextual to what each agent can do
const AGENT_SUGGESTIONS: Record<string, Array<{ icon: string; label: string; prompt: string }>> = {
  progressive: [
    { icon: '📧', label: 'Triage your inbox', prompt: "'Triage my inbox'" },
    { icon: '✏️', label: 'Read and reply', prompt: "'Show my latest emails, then draft a reply to the most urgent one'" },
    { icon: '📅', label: 'Full daily briefing', prompt: "'Give me a morning briefing: emails, calendar, and tasks'" },
  ],
  reader: [
    { icon: '📧', label: 'Triage your inbox', prompt: "'Show me my recent emails'" },
    { icon: '📅', label: 'Check your schedule', prompt: "'What's on my calendar today?'" },
    { icon: '✅', label: 'Review tasks', prompt: "'List my current tasks'" },
  ],
  writer: [
    { icon: '✏️', label: 'Draft an email', prompt: "'Draft a reply to the last email from my manager'" },
    { icon: '➕', label: 'Create a task', prompt: "'Add a task to follow up on the Q2 report'" },
    { icon: '📝', label: 'Compose a message', prompt: "'Write a professional out-of-office reply'" },
  ],
  commerce: [
    { icon: '🛒', label: 'Browse products', prompt: "'Search for wireless headphones under $100'" },
    { icon: '💳', label: 'Make a purchase', prompt: "'Buy the top-rated USB-C hub'" },
    { icon: '🔍', label: 'Compare options', prompt: "'Compare the top 3 portable chargers'" },
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
  listRepositories: { service: 'GitHub', icon: '📦', level: 'read' },
  listGitHubEvents: { service: 'GitHub', icon: '⚡', level: 'read' },
  listSlackChannels: { service: 'Slack', icon: '💬', level: 'read' },
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

function ChatMessages(props: {
  messages: UIMessage[];
  emptyStateComponent: ReactNode;
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
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitResult | null>(null);

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
                  {/* Welcome message shows in both modes — content adapts based on agentId presence */}
                  <div className="flex flex-col max-w-[768px] mx-auto pt-4 w-full px-3 md:px-0">
                    <ChatMessageBubble message={welcomeMessage} aiEmoji={props.emoji} />
                  </div>
                </div>
              ) : (
                <>
                  <ChatMessages aiEmoji={props.emoji} messages={messages} emptyStateComponent={props.emptyStateComponent} />
                  <div className="flex flex-col max-w-[768px] mx-auto pb-12 w-full px-3 md:px-0">
                    <TokenVaultInterruptHandler interrupt={toolInterrupt} />
                  </div>
                </>
              )
            }
            footer={
              <div className="sticky bottom-4 md:bottom-8 px-3 md:px-2">
                <ScrollToBottom className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4" />
                {/* Scope preset selector always visible — users can switch between lockdown/privacy/productivity in any mode */}
                <ScopePresetSelector activePresetId={presetId} onPresetChange={setPresetId} />
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
