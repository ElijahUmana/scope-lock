// Demo data seeder for Scope Lock.
// Seeds realistic audit entries, scope requests, and delegation chains
// so the dashboard shows meaningful data on first visit.
// All seeded entries are tagged with a "[demo]" prefix in their toolName
// or reason fields so they are distinguishable from real activity.

import { logToolCall, getAuditLog } from './audit';
import { recordScopeRequest } from './actions/audit';
import {
  createDelegation,
  startAgentSession,
} from './agent-orchestrator';

const DEMO_TAG = '[demo] ';

/**
 * Returns true if the user already has real or demo data.
 */
export function hasDemoData(userId: string): boolean {
  return getAuditLog(userId).length > 0;
}

/**
 * Seeds the in-memory stores with realistic demo entries.
 * Only seeds if the user has no existing data.
 */
export async function seedDemoData(userId: string): Promise<boolean> {
  if (hasDemoData(userId)) {
    return false;
  }

  const now = Date.now();

  // --- 1. Seed audit entries (15 entries spanning the last ~55 minutes) ---

  const auditEntries: Array<{
    toolName: string;
    scopes: string[];
    success: boolean;
    duration: number;
    connection: string;
    credentialsContext: string;
    riskLevel: string;
    minutesAgo: number;
  }> = [
    // GREEN: Gmail read operations
    {
      toolName: `${DEMO_TAG}gmailSearchTool`,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      success: true,
      duration: 342,
      connection: 'google-oauth2',
      credentialsContext: 'token-vault',
      riskLevel: 'GREEN',
      minutesAgo: 54,
    },
    {
      toolName: `${DEMO_TAG}gmailSearchTool`,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      success: true,
      duration: 287,
      connection: 'google-oauth2',
      credentialsContext: 'token-vault',
      riskLevel: 'GREEN',
      minutesAgo: 51,
    },
    // GREEN: Calendar view
    {
      toolName: `${DEMO_TAG}getCalendarEventsTool`,
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
      success: true,
      duration: 198,
      connection: 'google-oauth2',
      credentialsContext: 'token-vault',
      riskLevel: 'GREEN',
      minutesAgo: 47,
    },
    // GREEN: Tasks read
    {
      toolName: `${DEMO_TAG}getTasksTool`,
      scopes: ['https://www.googleapis.com/auth/tasks'],
      success: true,
      duration: 156,
      connection: 'google-oauth2',
      credentialsContext: 'token-vault',
      riskLevel: 'GREEN',
      minutesAgo: 44,
    },
    // GREEN: Gmail read again
    {
      toolName: `${DEMO_TAG}gmailSearchTool`,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      success: true,
      duration: 305,
      connection: 'google-oauth2',
      credentialsContext: 'token-vault',
      riskLevel: 'GREEN',
      minutesAgo: 33,
    },
    // GREEN: Calendar read
    {
      toolName: `${DEMO_TAG}getCalendarEventsTool`,
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
      success: true,
      duration: 178,
      connection: 'google-oauth2',
      credentialsContext: 'token-vault',
      riskLevel: 'GREEN',
      minutesAgo: 28,
    },
    // AMBER: Draft creation (write scope, escalation)
    {
      toolName: `${DEMO_TAG}gmailDraftTool`,
      scopes: ['https://www.googleapis.com/auth/gmail.compose'],
      success: true,
      duration: 467,
      connection: 'google-oauth2',
      credentialsContext: 'token-vault',
      riskLevel: 'AMBER',
      minutesAgo: 20,
    },
    // GREEN: Gmail read
    {
      toolName: `${DEMO_TAG}gmailSearchTool`,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      success: true,
      duration: 291,
      connection: 'google-oauth2',
      credentialsContext: 'token-vault',
      riskLevel: 'GREEN',
      minutesAgo: 16,
    },
    // AMBER: Task creation
    {
      toolName: `${DEMO_TAG}createTasksTool`,
      scopes: ['https://www.googleapis.com/auth/tasks'],
      success: true,
      duration: 234,
      connection: 'google-oauth2',
      credentialsContext: 'token-vault',
      riskLevel: 'AMBER',
      minutesAgo: 12,
    },
    // GREEN: User info lookup
    {
      toolName: `${DEMO_TAG}getUserInfoTool`,
      scopes: ['openid', 'profile'],
      success: true,
      duration: 89,
      connection: 'auth0',
      credentialsContext: 'token-vault',
      riskLevel: 'GREEN',
      minutesAgo: 2,
    },
  ];

  // Insert entries in chronological order (oldest first) so the hash chain is valid
  for (const entry of auditEntries) {
    logToolCall({
      toolName: entry.toolName,
      scopes: entry.scopes,
      timestamp: new Date(now - entry.minutesAgo * 60 * 1000).toISOString(),
      success: entry.success,
      duration: entry.duration,
      userId,
      connection: entry.connection,
      credentialsContext: entry.credentialsContext,
      riskLevel: entry.riskLevel,
    });
  }

  // --- 2. Seed scope requests for the consent timeline ---

  const scopeRequests: Array<{
    connection: string;
    scopes: string[];
    status: 'granted' | 'pending' | 'denied';
    minutesAgo: number;
    grantedMinutesAgo: number | null;
  }> = [
    {
      connection: 'google-oauth2',
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
      status: 'granted',
      minutesAgo: 55,
      grantedMinutesAgo: 55,
    },
    {
      connection: 'google-oauth2',
      scopes: ['https://www.googleapis.com/auth/calendar.events'],
      status: 'granted',
      minutesAgo: 48,
      grantedMinutesAgo: 48,
    },
    {
      connection: 'google-oauth2',
      scopes: ['https://www.googleapis.com/auth/tasks'],
      status: 'granted',
      minutesAgo: 45,
      grantedMinutesAgo: 45,
    },
    {
      connection: 'google-oauth2',
      scopes: ['https://www.googleapis.com/auth/gmail.compose'],
      status: 'granted',
      minutesAgo: 21,
      grantedMinutesAgo: 21,
    },
  ];

  for (const req of scopeRequests) {
    await recordScopeRequest(userId, {
      connection: req.connection,
      scopes: req.scopes,
      requestedAt: now - req.minutesAgo * 60 * 1000,
      grantedAt: req.grantedMinutesAgo !== null
        ? now - req.grantedMinutesAgo * 60 * 1000
        : null,
      status: req.status,
    });
  }

  // --- 3. Seed delegation chain data ---

  // Start with a reader session
  startAgentSession(userId, 'reader');

  // Reader -> Writer escalation (for gmail compose)
  createDelegation(
    'reader',
    'writer',
    ['gmailDraftTool', 'createTasksTool'],
    `${DEMO_TAG}User requested a draft reply — escalating to Writer for compose access`,
    userId,
  );

  return true;
}
