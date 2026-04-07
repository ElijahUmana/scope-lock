// Audit Trail: In-memory log of every tool call made by the agent.
// Each entry records what tool was called, what scopes were used,
// whether it succeeded, and how long it took.

export interface AuditEntry {
  id: string;
  toolName: string;
  scopes: string[];
  timestamp: string;
  success: boolean;
  duration: number;
  userId: string;
  connection: string;
  credentialsContext: string;
  riskLevel: string;
  hash: string;
  previousHash: string;
}

// Global in-memory audit store keyed by userId
const auditStore = new Map<string, AuditEntry[]>();

let entryCounter = 0;

export function logToolCall(entry: Omit<AuditEntry, 'id' | 'hash' | 'previousHash'>): AuditEntry {
  const id = `audit-${++entryCounter}`;
  const userId = entry.userId;
  if (!auditStore.has(userId)) {
    auditStore.set(userId, []);
  }
  const existingEntries = auditStore.get(userId)!;
  const previousHash = existingEntries.length > 0 ? existingEntries[existingEntries.length - 1].hash : GENESIS_HASH;
  const partialEntry = { ...entry, id, hash: '', previousHash };
  partialEntry.hash = computeEntryHash(partialEntry, previousHash);
  const fullEntry: AuditEntry = partialEntry;
  existingEntries.push(fullEntry);

  // Keep max 200 entries per user
  const entries = auditStore.get(userId)!;
  if (entries.length > 200) {
    auditStore.set(userId, entries.slice(-200));
  }

  return fullEntry;
}

export function getAuditLog(userId: string): AuditEntry[] {
  return auditStore.get(userId) ?? [];
}

export function clearAuditLog(userId: string): void {
  auditStore.delete(userId);
}

// Cryptographic audit chain
import { createHash } from 'crypto';

export const GENESIS_HASH = '0'.repeat(64);

function computeEntryHash(entry: AuditEntry, previousHash: string): string {
  const payload = `${previousHash}:${entry.toolName}:${entry.scopes.join(',')}:${entry.timestamp}:${entry.success}:${entry.riskLevel}:${entry.connection}`;
  return createHash('sha256').update(payload).digest('hex');
}

export function verifyAuditChain(userId: string): { valid: boolean; brokenAt?: number } {
  const entries = getAuditLog(userId);
  if (entries.length === 0) return { valid: true };

  let previousHash = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const expected = computeEntryHash(entries[i], previousHash);
    if (entries[i].hash && entries[i].hash !== expected) {
      return { valid: false, brokenAt: i };
    }
    previousHash = entries[i].hash || expected;
  }
  return { valid: true };
}

// Scope metadata for display
export const SCOPE_METADATA: Record<string, { label: string; level: 'read' | 'write' | 'admin'; service: string }> = {
  'https://www.googleapis.com/auth/gmail.readonly': { label: 'Gmail Read', level: 'read', service: 'Google' },
  'https://www.googleapis.com/auth/gmail.compose': { label: 'Gmail Write', level: 'write', service: 'Google' },
  'https://www.googleapis.com/auth/calendar.events': { label: 'Calendar Events', level: 'read', service: 'Google' },
  'https://www.googleapis.com/auth/tasks': { label: 'Tasks', level: 'read', service: 'Google' },
  'channels:read': { label: 'Channels Read', level: 'read', service: 'Slack' },
  'groups:read': { label: 'Groups Read', level: 'read', service: 'Slack' },
  'openid': { label: 'OpenID', level: 'read', service: 'Auth0' },
};
