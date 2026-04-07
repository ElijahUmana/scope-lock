import { type UIMessage } from 'ai';
import { MemoizedMarkdown } from './memoized-markdown';
import { cn } from '@/utils/cn';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

function uiMessageToText(message: UIMessage): string {
  if (Array.isArray((message as any).parts)) {
    return (message as any).parts
      .map((p: any) => {
        if (typeof p === 'string') return p;
        if (typeof p?.text === 'string') return p.text;
        if (typeof p?.content === 'string') return p.content;
        return '';
      })
      .filter(Boolean)
      .join('');
  }
  return (message as any).content ?? '';
}

function getToolCallsFromMessage(message: UIMessage): Array<{
  toolCallId: string;
  toolName: string;
  args: any;
  result?: any;
  status: 'pending' | 'complete' | 'error';
}> {
  const parts = (message as any).parts;
  if (!Array.isArray(parts)) return [];

  const toolCalls: Array<{
    toolCallId: string;
    toolName: string;
    args: any;
    result?: any;
    status: 'pending' | 'complete' | 'error';
  }> = [];

  parts.forEach((part: any) => {
    // Check if this part is a tool call (starts with "tool-")
    if (part?.type && part.type.startsWith('tool-') && part.toolCallId) {
      const toolName = part.type.replace('tool-', '');
      
      // Determine status based on the SDK's state field.
      // SDK states: 'input-streaming' | 'input-available' | 'output-available' | 'output-error' | 'output-denied'
      let status: 'pending' | 'complete' | 'error' = 'pending';
      if (part.state === 'output-available') {
        status = 'complete';
      } else if (part.state === 'output-error' || part.state === 'output-denied') {
        status = 'error';
      }
      
      toolCalls.push({
        toolCallId: part.toolCallId,
        toolName,
        args: part.input || part.args || {},
        result: part.output || part.result,
        status
      });
    }
  });

  return toolCalls;
}

const TOOL_LABELS: Record<string, { label: string; icon: string }> = {
  gmailSearchTool: { label: 'Gmail Search', icon: '📧' },
  gmailDraftTool: { label: 'Gmail Draft', icon: '✏️' },
  getCalendarEventsTool: { label: 'Calendar', icon: '📅' },
  getTasksTool: { label: 'Tasks', icon: '✅' },
  createTasksTool: { label: 'Create Task', icon: '➕' },
  deleteTaskTool: { label: 'Delete Task', icon: '🗑️' },
  completeTaskTool: { label: 'Complete Task', icon: '☑️' },
  getUserInfoTool: { label: 'User Info', icon: '👤' },
  serpApiTool: { label: 'Web Search', icon: '🔍' },
};

function ToolCallDisplay({ toolCall }: {
  toolCall: {
    toolCallId: string;
    toolName: string;
    args: any;
    result?: any;
    status: 'pending' | 'complete' | 'error';
  }
}) {
  const { toolName, status } = toolCall;
  const meta = TOOL_LABELS[toolName] ?? { label: toolName, icon: '🔧' };

  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border border-white/10 bg-white/5 mb-1 mr-1">
      {status === 'pending' && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
      {status === 'complete' && <CheckCircle className="w-3 h-3 text-green-400" />}
      {status === 'error' && <AlertCircle className="w-3 h-3 text-red-400" />}
      <span>{meta.icon}</span>
      <span className="text-white/80">{meta.label}</span>
    </div>
  );
}

export function ChatMessageBubble(props: { message: UIMessage; aiEmoji?: string }) {
  const { message, aiEmoji } = props;
  const text = uiMessageToText(message);
  const toolCalls = getToolCallsFromMessage(message);

  return (
    <div
      className={cn(
        'rounded-[24px] max-w-[80%] mb-8 flex',
        message.role === 'user' ? 'bg-secondary text-secondary-foreground px-4 py-2' : null,
        message.role === 'user' ? 'ml-auto' : 'mr-auto',
      )}
    >
      {message.role !== 'user' && (
        <div className="mr-4 mt-1 border bg-secondary rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center">
          {aiEmoji}
        </div>
      )}

      <div className="chat-message-bubble whitespace-pre-wrap flex flex-col prose dark:prose-invert max-w-none">
        {/* Render tool calls if present */}
        {toolCalls.length > 0 && (
          <div className="mb-3">
            {toolCalls.map((toolCall, index) => (
              <ToolCallDisplay key={`${toolCall.toolCallId}-${index}`} toolCall={toolCall} />
            ))}
          </div>
        )}
        
        {/* Render text content if present */}
        {text && <MemoizedMarkdown content={text} id={message.id as any} />}
      </div>
    </div>
  );
}