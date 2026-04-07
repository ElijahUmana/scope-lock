'use client';

import { cn } from '@/utils/cn';
import type { RateLimitResult } from '@/lib/rate-limiter';

const AGENT_LABELS: Record<string, string> = {
  reader: 'Reader Agent',
  writer: 'Writer Agent',
  commerce: 'Commerce Agent',
};

export function RateLimitIndicator({
  agentId,
  status,
}: {
  agentId?: string;
  status: RateLimitResult | null;
}) {
  if (!status) return null;

  const label = agentId ? (AGENT_LABELS[agentId] ?? agentId) : 'Default';
  const pct = status.limit > 0 ? status.remaining / status.limit : 0;
  const isLow = pct < 0.2;
  const isExhausted = status.remaining === 0;

  return (
    <div className="max-w-[768px] w-full mx-auto mb-2">
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-1.5 rounded-lg border text-xs transition-colors',
          isExhausted
            ? 'border-red-500/30 bg-red-500/10 text-red-300'
            : isLow
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
              : 'border-white/10 bg-white/5 text-white/50',
        )}
      >
        <span className="shrink-0">
          {isExhausted
            ? `Rate limited. Resets in ${status.resetIn}s.`
            : `${label}: ${status.remaining}/${status.limit} calls remaining`}
        </span>

        {/* Progress bar */}
        <div className="flex-1 h-1 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-300',
              isExhausted
                ? 'bg-red-500'
                : isLow
                  ? 'bg-amber-500'
                  : 'bg-green-500',
            )}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
