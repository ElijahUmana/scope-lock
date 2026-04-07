import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  grantScope,
  checkScopeExpiry,
  getActiveGrants,
  getAllGrants,
  revokeExpiredScopes,
  revokeGrant,
  renewGrant,
} from '@/lib/scope-ttl';

const TEST_USER = 'ttl-test-user';

describe('Scope TTL', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Revoke any leftover grants
    revokeGrant(TEST_USER, 'google-oauth2');
    revokeGrant(TEST_USER, 'ciba');
    revokeGrant(TEST_USER, 'github');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('grantScope', () => {
    it('creates a grant with correct fields', () => {
      const grant = grantScope(TEST_USER, 'google-oauth2', ['gmail.readonly'], 'GREEN');
      expect(grant.connection).toBe('google-oauth2');
      expect(grant.scopes).toEqual(['gmail.readonly']);
      expect(grant.expired).toBe(false);
      expect(grant.expiresAt).toBeGreaterThan(grant.grantedAt);
    });

    it('GREEN grants get 30-minute TTL', () => {
      const grant = grantScope(TEST_USER, 'google-oauth2', ['gmail.readonly'], 'GREEN');
      expect(grant.expiresAt - grant.grantedAt).toBe(30 * 60 * 1000);
    });

    it('AMBER grants get 10-minute TTL', () => {
      const grant = grantScope(TEST_USER, 'google-oauth2', ['gmail.compose'], 'AMBER');
      expect(grant.expiresAt - grant.grantedAt).toBe(10 * 60 * 1000);
    });

    it('RED grants get 5-minute TTL', () => {
      const grant = grantScope(TEST_USER, 'ciba', ['product:buy'], 'RED');
      expect(grant.expiresAt - grant.grantedAt).toBe(5 * 60 * 1000);
    });

    it('unknown risk level defaults to AMBER TTL', () => {
      const grant = grantScope(TEST_USER, 'google-oauth2', ['custom'], 'UNKNOWN');
      expect(grant.expiresAt - grant.grantedAt).toBe(10 * 60 * 1000);
    });
  });

  describe('checkScopeExpiry — TTL expiration', () => {
    it('grant is valid immediately after creation', () => {
      grantScope(TEST_USER, 'google-oauth2', ['gmail.readonly'], 'GREEN');
      const result = checkScopeExpiry(TEST_USER, 'google-oauth2');
      expect(result.valid).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
      expect(result.grant).toBeDefined();
    });

    it('grant is invalid after TTL expires', () => {
      grantScope(TEST_USER, 'google-oauth2', ['gmail.readonly'], 'GREEN');

      // Advance time past the 30-minute GREEN TTL
      vi.advanceTimersByTime(31 * 60 * 1000);

      const result = checkScopeExpiry(TEST_USER, 'google-oauth2');
      expect(result.valid).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.grant?.expired).toBe(true);
    });

    it('grant is still valid just before TTL expires', () => {
      grantScope(TEST_USER, 'ciba', ['product:buy'], 'RED');

      // Advance to 4 minutes 59 seconds (just under the 5-minute RED TTL)
      vi.advanceTimersByTime(4 * 60 * 1000 + 59 * 1000);

      const result = checkScopeExpiry(TEST_USER, 'ciba');
      expect(result.valid).toBe(true);
      expect(result.remaining).toBeGreaterThan(0);
    });

    it('returns invalid for non-existent grant', () => {
      const result = checkScopeExpiry(TEST_USER, 'nonexistent');
      expect(result.valid).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.grant).toBeUndefined();
    });
  });

  describe('getActiveGrants', () => {
    it('returns only non-expired grants', () => {
      grantScope(TEST_USER, 'google-oauth2', ['gmail.readonly'], 'GREEN');
      grantScope(TEST_USER, 'ciba', ['product:buy'], 'RED');

      // Advance past RED TTL (5 min) but before GREEN TTL (30 min)
      vi.advanceTimersByTime(6 * 60 * 1000);

      const active = getActiveGrants(TEST_USER);
      expect(active).toHaveLength(1);
      expect(active[0].connection).toBe('google-oauth2');
    });

    it('returns empty when all grants have expired', () => {
      grantScope(TEST_USER, 'ciba', ['product:buy'], 'RED');

      vi.advanceTimersByTime(6 * 60 * 1000);

      const active = getActiveGrants(TEST_USER);
      expect(active).toHaveLength(0);
    });
  });

  describe('getAllGrants', () => {
    it('returns both active and expired grants', () => {
      grantScope(TEST_USER, 'google-oauth2', ['gmail.readonly'], 'GREEN');
      grantScope(TEST_USER, 'ciba', ['product:buy'], 'RED');

      vi.advanceTimersByTime(6 * 60 * 1000);

      const all = getAllGrants(TEST_USER);
      expect(all).toHaveLength(2);

      const expired = all.filter((g) => g.expired);
      const active = all.filter((g) => !g.expired);
      expect(expired).toHaveLength(1);
      expect(expired[0].connection).toBe('ciba');
      expect(active).toHaveLength(1);
      expect(active[0].connection).toBe('google-oauth2');
    });
  });

  describe('revokeExpiredScopes', () => {
    it('removes expired grants and returns their connections', () => {
      grantScope(TEST_USER, 'google-oauth2', ['gmail.readonly'], 'GREEN');
      grantScope(TEST_USER, 'ciba', ['product:buy'], 'RED');

      vi.advanceTimersByTime(6 * 60 * 1000);

      const revoked = revokeExpiredScopes(TEST_USER);
      expect(revoked).toContain('ciba');
      expect(revoked).not.toContain('google-oauth2');

      // Verify the expired grant is gone
      const result = checkScopeExpiry(TEST_USER, 'ciba');
      expect(result.valid).toBe(false);
      expect(result.grant).toBeUndefined();
    });

    it('returns empty array when no grants are expired', () => {
      grantScope(TEST_USER, 'google-oauth2', ['gmail.readonly'], 'GREEN');
      const revoked = revokeExpiredScopes(TEST_USER);
      expect(revoked).toEqual([]);
    });
  });

  describe('revokeGrant', () => {
    it('immediately revokes a specific grant', () => {
      grantScope(TEST_USER, 'google-oauth2', ['gmail.readonly'], 'GREEN');
      const removed = revokeGrant(TEST_USER, 'google-oauth2');
      expect(removed).toBe(true);

      const result = checkScopeExpiry(TEST_USER, 'google-oauth2');
      expect(result.valid).toBe(false);
    });

    it('returns false for non-existent grant', () => {
      const removed = revokeGrant(TEST_USER, 'nonexistent');
      expect(removed).toBe(false);
    });
  });

  describe('renewGrant', () => {
    it('resets the TTL on an existing grant', () => {
      grantScope(TEST_USER, 'google-oauth2', ['gmail.readonly'], 'GREEN');

      // Advance 20 minutes into the 30-minute window
      vi.advanceTimersByTime(20 * 60 * 1000);

      const renewed = renewGrant(TEST_USER, 'google-oauth2', 'GREEN');
      expect(renewed).not.toBeNull();

      // Should have a fresh 30-minute window from now
      const result = checkScopeExpiry(TEST_USER, 'google-oauth2');
      expect(result.valid).toBe(true);
      expect(result.remaining).toBeGreaterThan(25 * 60 * 1000);
    });

    it('returns null for non-existent grant', () => {
      const result = renewGrant(TEST_USER, 'nonexistent', 'GREEN');
      expect(result).toBeNull();
    });

    it('can change risk level on renewal, adjusting TTL', () => {
      grantScope(TEST_USER, 'google-oauth2', ['gmail.readonly'], 'GREEN');

      // Renew with RED risk level (shorter TTL)
      const renewed = renewGrant(TEST_USER, 'google-oauth2', 'RED');
      expect(renewed).not.toBeNull();
      expect(renewed!.expiresAt - renewed!.grantedAt).toBe(5 * 60 * 1000);
    });
  });
});
