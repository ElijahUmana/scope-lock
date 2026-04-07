import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkRateLimit, getRateLimitStatus } from '@/lib/rate-limiter';

// Each test uses a unique userId to avoid cross-test pollution in the in-memory store
let userCounter = 0;
function uniqueUser(): string {
  return `rate-test-user-${++userCounter}`;
}

describe('Rate Limiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('per-agent limits', () => {
    it('reader allows 50 calls per window', () => {
      const userId = uniqueUser();
      const first = checkRateLimit(userId, 'reader');
      expect(first.allowed).toBe(true);
      expect(first.limit).toBe(50);
      expect(first.remaining).toBe(49);
    });

    it('writer allows 15 calls per window', () => {
      const userId = uniqueUser();
      const first = checkRateLimit(userId, 'writer');
      expect(first.allowed).toBe(true);
      expect(first.limit).toBe(15);
      expect(first.remaining).toBe(14);
    });

    it('commerce allows only 3 calls per window', () => {
      const userId = uniqueUser();
      const first = checkRateLimit(userId, 'commerce');
      expect(first.allowed).toBe(true);
      expect(first.limit).toBe(3);
      expect(first.remaining).toBe(2);
    });

    it('null agent uses default limit of 30', () => {
      const userId = uniqueUser();
      const first = checkRateLimit(userId, null);
      expect(first.allowed).toBe(true);
      expect(first.limit).toBe(30);
      expect(first.remaining).toBe(29);
    });

    it('unknown agent ID uses default limit of 30', () => {
      const userId = uniqueUser();
      const first = checkRateLimit(userId, 'nonexistent-agent');
      expect(first.limit).toBe(30);
    });
  });

  describe('rate limit enforcement', () => {
    it('blocks commerce agent after 3 calls', () => {
      const userId = uniqueUser();

      // Use all 3 calls
      checkRateLimit(userId, 'commerce');
      checkRateLimit(userId, 'commerce');
      checkRateLimit(userId, 'commerce');

      // 4th call should be blocked
      const result = checkRateLimit(userId, 'commerce');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('blocks writer agent after 15 calls', () => {
      const userId = uniqueUser();

      for (let i = 0; i < 15; i++) {
        const r = checkRateLimit(userId, 'writer');
        expect(r.allowed).toBe(true);
      }

      const result = checkRateLimit(userId, 'writer');
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it('remaining count decreases with each call', () => {
      const userId = uniqueUser();

      const r1 = checkRateLimit(userId, 'commerce');
      expect(r1.remaining).toBe(2);

      const r2 = checkRateLimit(userId, 'commerce');
      expect(r2.remaining).toBe(1);

      const r3 = checkRateLimit(userId, 'commerce');
      expect(r3.remaining).toBe(0);
    });
  });

  describe('window reset', () => {
    it('resets after the 5-minute window expires', () => {
      const userId = uniqueUser();

      // Exhaust commerce limit
      checkRateLimit(userId, 'commerce');
      checkRateLimit(userId, 'commerce');
      checkRateLimit(userId, 'commerce');
      expect(checkRateLimit(userId, 'commerce').allowed).toBe(false);

      // Advance past the 5-minute window
      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      // Should be allowed again with a fresh window
      const result = checkRateLimit(userId, 'commerce');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });
  });

  describe('user isolation', () => {
    it('limits are tracked separately per user', () => {
      const userA = uniqueUser();
      const userB = uniqueUser();

      // Exhaust userA's commerce limit
      checkRateLimit(userA, 'commerce');
      checkRateLimit(userA, 'commerce');
      checkRateLimit(userA, 'commerce');
      expect(checkRateLimit(userA, 'commerce').allowed).toBe(false);

      // userB should still have full quota
      const result = checkRateLimit(userB, 'commerce');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(2);
    });

    it('limits are tracked separately per agent for the same user', () => {
      const userId = uniqueUser();

      // Exhaust commerce limit for this user
      checkRateLimit(userId, 'commerce');
      checkRateLimit(userId, 'commerce');
      checkRateLimit(userId, 'commerce');
      expect(checkRateLimit(userId, 'commerce').allowed).toBe(false);

      // Reader should still be available for the same user
      const result = checkRateLimit(userId, 'reader');
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(49);
    });
  });

  describe('getRateLimitStatus (peek without incrementing)', () => {
    it('returns full quota when no calls have been made', () => {
      const userId = uniqueUser();
      const status = getRateLimitStatus(userId, 'commerce');
      expect(status.allowed).toBe(true);
      expect(status.remaining).toBe(3);
      expect(status.limit).toBe(3);
    });

    it('does not decrement the counter', () => {
      const userId = uniqueUser();

      // Peek twice -- should not consume any quota
      getRateLimitStatus(userId, 'commerce');
      getRateLimitStatus(userId, 'commerce');

      // All 3 calls should still be available
      const r1 = checkRateLimit(userId, 'commerce');
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2); // 3 - 1 = 2
    });

    it('reflects consumed calls accurately', () => {
      const userId = uniqueUser();

      checkRateLimit(userId, 'commerce');
      checkRateLimit(userId, 'commerce');

      const status = getRateLimitStatus(userId, 'commerce');
      expect(status.remaining).toBe(1);
      expect(status.allowed).toBe(true);
    });

    it('shows not allowed when limit is exhausted', () => {
      const userId = uniqueUser();

      checkRateLimit(userId, 'commerce');
      checkRateLimit(userId, 'commerce');
      checkRateLimit(userId, 'commerce');

      const status = getRateLimitStatus(userId, 'commerce');
      expect(status.allowed).toBe(false);
      expect(status.remaining).toBe(0);
    });
  });
});
