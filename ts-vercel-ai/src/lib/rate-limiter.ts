// Per-agent rate limiting with risk-aware limits.
// Higher-risk agents get stricter rate limits.

interface RateLimit {
  maxCalls: number;
  windowMs: number;
  currentCalls: number;
  windowStart: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetIn: number;
  limit: number;
}

// Rate limits per agent, tuned by risk level:
// - Reader (low risk): generous — reads are safe
// - Writer (medium risk): restricted — writes mutate state
// - No agent: moderate default
const AGENT_RATE_LIMITS: Record<string, { maxCalls: number; windowMs: number }> = {
  reader: { maxCalls: 50, windowMs: 5 * 60 * 1000 },
  writer: { maxCalls: 15, windowMs: 5 * 60 * 1000 },
  __default__: { maxCalls: 30, windowMs: 5 * 60 * 1000 },
};

// In-memory store keyed by `${userId}:${agentId}`
const rateLimitStore = new Map<string, RateLimit>();

function getKey(userId: string, agentId: string | null): string {
  return `${userId}:${agentId ?? '__default__'}`;
}

function getLimits(agentId: string | null): { maxCalls: number; windowMs: number } {
  if (agentId && AGENT_RATE_LIMITS[agentId]) {
    return AGENT_RATE_LIMITS[agentId];
  }
  return AGENT_RATE_LIMITS.__default__;
}

export function checkRateLimit(userId: string, agentId: string | null): RateLimitResult {
  const key = getKey(userId, agentId);
  const { maxCalls, windowMs } = getLimits(agentId);
  const now = Date.now();

  let entry = rateLimitStore.get(key);

  // Create new window or reset expired window
  if (!entry || now - entry.windowStart >= entry.windowMs) {
    entry = {
      maxCalls,
      windowMs,
      currentCalls: 1,
      windowStart: now,
    };
    rateLimitStore.set(key, entry);
    return {
      allowed: true,
      remaining: maxCalls - 1,
      resetIn: Math.ceil(windowMs / 1000),
      limit: maxCalls,
    };
  }

  // Within active window
  entry.currentCalls += 1;
  const resetIn = Math.ceil((entry.windowStart + windowMs - now) / 1000);

  if (entry.currentCalls > maxCalls) {
    return {
      allowed: false,
      remaining: 0,
      resetIn,
      limit: maxCalls,
    };
  }

  return {
    allowed: true,
    remaining: maxCalls - entry.currentCalls,
    resetIn,
    limit: maxCalls,
  };
}

/** Peek at current rate limit state without incrementing the counter. */
export function getRateLimitStatus(userId: string, agentId: string | null): RateLimitResult {
  const key = getKey(userId, agentId);
  const { maxCalls, windowMs } = getLimits(agentId);
  const now = Date.now();

  const entry = rateLimitStore.get(key);

  // No entry or expired window — full quota available
  if (!entry || now - entry.windowStart >= entry.windowMs) {
    return {
      allowed: true,
      remaining: maxCalls,
      resetIn: 0,
      limit: maxCalls,
    };
  }

  const resetIn = Math.ceil((entry.windowStart + windowMs - now) / 1000);
  const remaining = Math.max(0, maxCalls - entry.currentCalls);

  return {
    allowed: remaining > 0,
    remaining,
    resetIn,
    limit: maxCalls,
  };
}
