'use server';

import { auth0 } from '@/lib/auth0';
import { getAuditLog, type AuditEntry } from '@/lib/audit';

export type { AuditEntry };

export interface ScopeRequest {
  id: string;
  connection: string;
  scopes: string[];
  requestedAt: number;
  grantedAt: number | null;
  status: 'granted' | 'pending' | 'denied';
}

// In-memory scope request store keyed by user ID
const scopeRequestStore = new Map<string, ScopeRequest[]>();

let entryCounter = 0;

/**
 * Record a scope request event.
 */
export async function recordScopeRequest(
  userId: string,
  request: Omit<ScopeRequest, 'id'>,
): Promise<void> {
  const requests = scopeRequestStore.get(userId) || [];
  requests.push({
    ...request,
    id: `scope_${++entryCounter}_${Date.now()}`,
  });
  if (requests.length > 200) {
    requests.splice(0, requests.length - 200);
  }
  scopeRequestStore.set(userId, requests);
}

/**
 * Fetch audit entries for the current authenticated user.
 * Reads from the shared in-memory store that the chat route writes to.
 */
export async function fetchAuditEntries(): Promise<AuditEntry[]> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) return [];
  const entries = getAuditLog(session.user.sub);
  // Return newest first
  return [...entries].reverse();
}

/**
 * Fetch scope request history for the current authenticated user.
 */
export async function fetchScopeRequests(): Promise<ScopeRequest[]> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) return [];
  const requests = scopeRequestStore.get(session.user.sub) || [];
  return [...requests].reverse();
}
