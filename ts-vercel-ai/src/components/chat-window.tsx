'use client';

import { useState, useEffect, useMemo, type FormEvent, type ReactNode } from 'react';
import { type UIMessage, DefaultChatTransport, generateId, lastAssistantMessageIsCompleteWithToolCalls } from 'ai';
import { useChat } from '@ai-sdk/react';
import { toast } from 'sonner';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
import { ArrowDown, ArrowUpIcon, LoaderCircle, Shield, Lock, Unlock } from 'lucide-react';
import { useInterruptions } from '@auth0/ai-vercel/react';

import { TokenVaultInterruptHandler } from '@/components/TokenVaultInterruptHandler';
import { ChatMessageBubble } from '@/components/chat-message-bubble';
import { Button } from '@/components/ui/button';
import { cn } from '@/utils/cn';

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
      <div className="flex items-center gap-2 px-4 py-2 bg-black/20 border-b border-white/5 text-xs text-white/40">
        <Shield className="w-3.5 h-3.5" />
        <Lock className="w-3 h-3" />
        <span>Zero Trust — No services authorized. The agent will request each permission as needed.</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2 bg-black/20 border-b border-white/5 text-xs">
      <div className="flex items-center gap-1.5 text-white/40">
        <Shield className="w-3.5 h-3.5 text-green-400" />
        <span>Active:</span>
      </div>
      {Array.from(activeServices.entries()).map(([name, { icon, level }]) => (
        <div key={name} className={cn(
          'flex items-center gap-1 px-2 py-0.5 rounded-full border transition-all duration-500',
          level === 'write'
            ? 'bg-amber-500/15 border-amber-500/30 text-amber-300'
            : 'bg-green-500/15 border-green-500/30 text-green-300'
        )}>
          <span>{icon}</span>
          <span>{name}</span>
          {level === 'write' ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
        </div>
      ))}
      <span className="text-white/30 ml-auto">{activeServices.size} service{activeServices.size !== 1 ? 's' : ''} authorized</span>
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
    <div className="flex flex-col max-w-[768px] mx-auto pb-12 w-full">
      {props.messages.map((m, i) => {
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
          className="border-none outline-none bg-transparent p-4"
        />

        <div className="flex justify-between ml-4 mr-2 mb-2">
          <div className="flex gap-3">{props.children}</div>

          <Button
            className="rounded-full p-1.5 h-fit border dark:border-zinc-600"
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

export function ChatWindow(props: {
  endpoint: string;
  emptyStateComponent: ReactNode;
  placeholder?: string;
  emoji?: string;
}) {
  const { messages, sendMessage, status, toolInterrupt } = useInterruptions((handler) =>
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useChat({
      transport: new DefaultChatTransport({ api: props.endpoint }),
      generateId,
      onError: handler((e: Error) => {
        console.error('Error: ', e);
        toast.error(`Error while processing your request`, { description: e.message });
      }),
      sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
    }),
  );

  const [input, setInput] = useState('');

  const isChatLoading = status === 'streaming';

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!input.trim() || isChatLoading) return;
    const text = input;
    setInput('');
    await sendMessage({ text });
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      <ActiveScopesBar messages={messages} />
      <div className="flex-1 relative">
        <StickToBottom>
          <StickyToBottomContent
            className="absolute inset-0"
            contentClassName="py-8 px-2"
            content={
              messages.length === 0 ? (
                <div>{props.emptyStateComponent}</div>
              ) : (
                <>
                  <ChatMessages aiEmoji={props.emoji} messages={messages} emptyStateComponent={props.emptyStateComponent} />
                  <div className="flex flex-col max-w-[768px] mx-auto pb-12 w-full">
                    <TokenVaultInterruptHandler interrupt={toolInterrupt} />
                  </div>
                </>
              )
            }
            footer={
              <div className="sticky bottom-8 px-2">
                <ScrollToBottom className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4" />
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
