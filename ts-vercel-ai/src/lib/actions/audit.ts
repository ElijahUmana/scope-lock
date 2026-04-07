'use server';

import { auth0 } from '@/lib/auth0';
import { getAuditLog, hasRealEntries, removeDemoEntries, type AuditEntry } from '@/lib/audit';
import { getActiveAlerts, type AnomalyAlert } from '@/lib/anomaly-detection';

export type { AuditEntry, AnomalyAlert };

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
 *
 * If real (non-demo) entries exist alongside demo entries, the demo entries
 * are purged automatically so the dashboard shows only real activity.
 *
 * Returns { entries, isDemoData } where isDemoData is true only when all
 * entries are demo data.
 */
export async function fetchAuditEntries(): Promise<{ entries: AuditEntry[]; isDemoData: boolean }> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) return { entries: [], isDemoData: false };

  const userId = session.user.sub;

  // If the user has real entries alongside demo entries, purge the demo entries
  if (hasRealEntries(userId)) {
    removeDemoEntries(userId);
    await clearScopeRequests(userId);
  }

  const entries = getAuditLog(userId);
  const isDemoData = entries.length > 0 && entries.every((e) => e.toolName.startsWith('[demo] '));

  // Return newest first
  return { entries: [...entries].reverse(), isDemoData };
}

/**
 * Clear all scope requests for a user.
 * Used when purging demo data after real activity begins.
 */
export async function clearScopeRequests(userId: string): Promise<void> {
  scopeRequestStore.delete(userId);
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

/**
 * Fetch anomaly alerts for the current authenticated user.
 */
export async function fetchAnomalyAlerts(): Promise<AnomalyAlert[]> {
  const session = await auth0.getSession();
  if (!session?.user?.sub) return [];
  return getActiveAlerts(session.user.sub);
}
