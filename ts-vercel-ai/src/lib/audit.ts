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
}

// Global in-memory audit store keyed by userId
const auditStore = new Map<string, AuditEntry[]>();

let entryCounter = 0;

export function logToolCall(entry: Omit<AuditEntry, 'id'>): void {
  const id = `audit-${++entryCounter}`;
  const userId = entry.userId;
  if (!auditStore.has(userId)) {
    auditStore.set(userId, []);
  }
  auditStore.get(userId)!.push({ ...entry, id });

  // Keep max 200 entries per user
  const entries = auditStore.get(userId)!;
  if (entries.length > 200) {
    auditStore.set(userId, entries.slice(-200));
  }
}

export function getAuditLog(userId: string): AuditEntry[] {
  return auditStore.get(userId) ?? [];
}

export function clearAuditLog(userId: string): void {
  auditStore.delete(userId);
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
