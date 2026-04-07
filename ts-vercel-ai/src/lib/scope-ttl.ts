// Scope TTL: Time-to-live management for scope grants.
// After a grant's TTL expires, the scope is considered revoked
// and the agent must re-request authorization.

import type { RiskLevel } from './policy-engine';

export interface ScopeGrant {
  connection: string;
  scopes: string[];
  grantedAt: number;
  expiresAt: number;
  expired: boolean;
}

// Default TTLs by risk level
const SCOPE_TTL: Record<string, number> = {
  GREEN: 30 * 60 * 1000,  // 30 minutes for read scopes
  AMBER: 10 * 60 * 1000,  // 10 minutes for write scopes
  RED: 5 * 60 * 1000,     // 5 minutes for high-risk scopes
};

// In-memory grant store keyed by userId, then connection
const grantStore = new Map<string, Map<string, ScopeGrant>>();

function getUserGrants(userId: string): Map<string, ScopeGrant> {
  if (!grantStore.has(userId)) {
    grantStore.set(userId, new Map());
  }
  return grantStore.get(userId)!;
}

/**
 * Grant scopes for a connection with a TTL based on risk level.
 * If a grant already exists for the connection, it is replaced.
 */
export function grantScope(
  userId: string,
  connection: string,
  scopes: string[],
  riskLevel: string,
): ScopeGrant {
  const ttl = SCOPE_TTL[riskLevel] ?? SCOPE_TTL.AMBER;
  const now = Date.now();
  const grant: ScopeGrant = {
    connection,
    scopes,
    grantedAt: now,
    expiresAt: now + ttl,
    expired: false,
  };
  getUserGrants(userId).set(connection, grant);
  return grant;
}

/**
 * Check whether the scope grant for a connection is still valid.
 * Returns validity status, remaining time in ms, and the grant itself.
 */
export function checkScopeExpiry(
  userId: string,
  connection: string,
): { valid: boolean; remaining: number; grant?: ScopeGrant } {
  const grants = getUserGrants(userId);
  const grant = grants.get(connection);
  if (!grant) {
    return { valid: false, remaining: 0 };
  }

  const now = Date.now();
  const remaining = Math.max(0, grant.expiresAt - now);
  const valid = remaining > 0;

  // Mark expired in place so subsequent reads reflect the state
  if (!valid && !grant.expired) {
    grant.expired = true;
  }

  return { valid, remaining, grant };
}

/**
 * Return all active (non-expired) grants for a user.
 * Also marks any newly expired grants as expired.
 */
export function getActiveGrants(userId: string): ScopeGrant[] {
  const grants = getUserGrants(userId);
  const now = Date.now();
  const active: ScopeGrant[] = [];

  for (const grant of grants.values()) {
    if (grant.expiresAt > now) {
      active.push(grant);
    } else if (!grant.expired) {
      grant.expired = true;
    }
  }

  return active;
}

/**
 * Return ALL grants (active + expired) for a user.
 * Updates the expired flag on any that have passed their TTL.
 */
export function getAllGrants(userId: string): ScopeGrant[] {
  const grants = getUserGrants(userId);
  const now = Date.now();
  const all: ScopeGrant[] = [];

  for (const grant of grants.values()) {
    if (grant.expiresAt <= now && !grant.expired) {
      grant.expired = true;
    }
    all.push(grant);
  }

  return all;
}

/**
 * Revoke all expired grants for a user and return the list of
 * connections that were revoked.
 */
export function revokeExpiredScopes(userId: string): string[] {
  const grants = getUserGrants(userId);
  const now = Date.now();
  const revoked: string[] = [];

  for (const [connection, grant] of grants.entries()) {
    if (grant.expiresAt <= now) {
      revoked.push(connection);
      grants.delete(connection);
    }
  }

  return revoked;
}

/**
 * Immediately revoke a specific connection's grant.
 * Returns true if the grant existed and was removed.
 */
export function revokeGrant(userId: string, connection: string): boolean {
  const grants = getUserGrants(userId);
  return grants.delete(connection);
}

/**
 * Renew an existing grant, resetting its TTL based on the given risk level.
 * Returns the renewed grant, or null if no grant exists for the connection.
 */
export function renewGrant(
  userId: string,
  connection: string,
  riskLevel: string,
): ScopeGrant | null {
  const grants = getUserGrants(userId);
  const existing = grants.get(connection);
  if (!existing) return null;

  return grantScope(userId, connection, existing.scopes, riskLevel);
}
