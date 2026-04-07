import { describe, it, expect, beforeEach } from 'vitest';
import { checkForAnomalies, getActiveAlerts, clearAlerts } from '@/lib/anomaly-detection';
import { logToolCall, clearAuditLog, type AuditEntry } from '@/lib/audit';

const TEST_USER = 'anomaly-test-user';

function makeAuditEntry(overrides: Partial<Omit<AuditEntry, 'id' | 'hash' | 'previousHash'>> = {}): AuditEntry {
  const entry = logToolCall({
    toolName: 'gmailSearchTool',
    scopes: ['gmail.readonly'],
    timestamp: new Date().toISOString(),
    success: true,
    duration: 100,
    userId: TEST_USER,
    connection: 'google-oauth2',
    credentialsContext: 'thread',
    riskLevel: 'GREEN',
    ...overrides,
  });
  return entry;
}

describe('Anomaly Detection', () => {
  beforeEach(() => {
    clearAuditLog(TEST_USER);
    clearAlerts(TEST_USER);
  });

  describe('no anomalies for normal usage', () => {
    it('returns no alerts for a single GREEN tool call', () => {
      const entry = makeAuditEntry();
      const alerts = checkForAnomalies(TEST_USER, entry);
      expect(alerts).toHaveLength(0);
    });

    it('returns no alerts for a few spaced-out calls', () => {
      const now = Date.now();
      const entry1 = makeAuditEntry({ timestamp: new Date(now - 120_000).toISOString() });
      checkForAnomalies(TEST_USER, entry1);

      const entry2 = makeAuditEntry({ timestamp: new Date(now - 60_000).toISOString() });
      checkForAnomalies(TEST_USER, entry2);

      const entry3 = makeAuditEntry({ timestamp: new Date(now).toISOString() });
      const alerts = checkForAnomalies(TEST_USER, entry3);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('RAPID_ESCALATION', () => {
    it('detected when going GREEN to RED in under 60s', () => {
      const now = Date.now();

      // First: GREEN call
      const greenEntry = makeAuditEntry({
        toolName: 'gmailSearchTool',
        riskLevel: 'GREEN',
        timestamp: new Date(now - 30_000).toISOString(), // 30 seconds ago
      });
      checkForAnomalies(TEST_USER, greenEntry);

      // Then: RED call within 60 seconds
      const redEntry = makeAuditEntry({
        toolName: 'shopOnlineTool',
        riskLevel: 'RED',
        connection: 'ciba',
        scopes: ['product:buy'],
        timestamp: new Date(now).toISOString(),
      });
      const alerts = checkForAnomalies(TEST_USER, redEntry);

      const escalationAlerts = alerts.filter((a) => a.type === 'RAPID_ESCALATION');
      expect(escalationAlerts).toHaveLength(1);
      expect(escalationAlerts[0].severity).toBe('high');
    });

    it('not detected when GREEN call was more than 60s ago', () => {
      const now = Date.now();

      // GREEN call 90 seconds ago (outside 60s window)
      const greenEntry = makeAuditEntry({
        toolName: 'gmailSearchTool',
        riskLevel: 'GREEN',
        timestamp: new Date(now - 90_000).toISOString(),
      });
      checkForAnomalies(TEST_USER, greenEntry);

      // RED call now
      const redEntry = makeAuditEntry({
        toolName: 'shopOnlineTool',
        riskLevel: 'RED',
        connection: 'ciba',
        timestamp: new Date(now).toISOString(),
      });
      const alerts = checkForAnomalies(TEST_USER, redEntry);

      const escalationAlerts = alerts.filter((a) => a.type === 'RAPID_ESCALATION');
      expect(escalationAlerts).toHaveLength(0);
    });

    it('not detected for AMBER calls (only RED triggers)', () => {
      const now = Date.now();

      const greenEntry = makeAuditEntry({
        riskLevel: 'GREEN',
        timestamp: new Date(now - 10_000).toISOString(),
      });
      checkForAnomalies(TEST_USER, greenEntry);

      const amberEntry = makeAuditEntry({
        toolName: 'gmailDraftTool',
        riskLevel: 'AMBER',
        timestamp: new Date(now).toISOString(),
      });
      const alerts = checkForAnomalies(TEST_USER, amberEntry);
      const escalationAlerts = alerts.filter((a) => a.type === 'RAPID_ESCALATION');
      expect(escalationAlerts).toHaveLength(0);
    });
  });

  describe('HIGH_FREQUENCY', () => {
    it('detected with 10+ calls in 60s', () => {
      const now = Date.now();
      let lastEntry: AuditEntry | undefined;

      // Log 11 calls within the last 60 seconds
      for (let i = 0; i < 11; i++) {
        lastEntry = makeAuditEntry({
          timestamp: new Date(now - (60_000 - i * 1000)).toISOString(),
        });
        checkForAnomalies(TEST_USER, lastEntry);
      }

      // The 12th call should trigger HIGH_FREQUENCY
      const triggerEntry = makeAuditEntry({
        timestamp: new Date(now).toISOString(),
      });
      const alerts = checkForAnomalies(TEST_USER, triggerEntry);

      const freqAlerts = alerts.filter((a) => a.type === 'HIGH_FREQUENCY');
      expect(freqAlerts).toHaveLength(1);
      expect(freqAlerts[0].severity).toBe('medium');
    });

    it('not detected with fewer than 10 calls in 60s', () => {
      const now = Date.now();

      // Log 5 calls
      for (let i = 0; i < 5; i++) {
        const entry = makeAuditEntry({
          timestamp: new Date(now - i * 1000).toISOString(),
        });
        checkForAnomalies(TEST_USER, entry);
      }

      const alerts = getActiveAlerts(TEST_USER);
      const freqAlerts = alerts.filter((a) => a.type === 'HIGH_FREQUENCY');
      expect(freqAlerts).toHaveLength(0);
    });
  });

  describe('SCOPE_HOPPING', () => {
    it('detected with 3+ distinct connections in 30s', () => {
      const now = Date.now();

      const entry1 = makeAuditEntry({
        connection: 'google-oauth2',
        timestamp: new Date(now - 20_000).toISOString(),
      });
      checkForAnomalies(TEST_USER, entry1);

      const entry2 = makeAuditEntry({
        toolName: 'listRepositories',
        connection: 'github',
        scopes: ['repo'],
        timestamp: new Date(now - 10_000).toISOString(),
      });
      checkForAnomalies(TEST_USER, entry2);

      const entry3 = makeAuditEntry({
        toolName: 'shopOnlineTool',
        connection: 'ciba',
        scopes: ['product:buy'],
        riskLevel: 'RED',
        timestamp: new Date(now).toISOString(),
      });
      const alerts = checkForAnomalies(TEST_USER, entry3);

      const hoppingAlerts = alerts.filter((a) => a.type === 'SCOPE_HOPPING');
      expect(hoppingAlerts).toHaveLength(1);
      expect(hoppingAlerts[0].severity).toBe('medium');
      expect(hoppingAlerts[0].details.connectionCount).toBe(3);
    });

    it('not detected with fewer than 3 connections in 30s', () => {
      const now = Date.now();

      const entry1 = makeAuditEntry({
        connection: 'google-oauth2',
        timestamp: new Date(now - 10_000).toISOString(),
      });
      checkForAnomalies(TEST_USER, entry1);

      const entry2 = makeAuditEntry({
        connection: 'google-oauth2',
        toolName: 'gmailDraftTool',
        timestamp: new Date(now).toISOString(),
      });
      const alerts = checkForAnomalies(TEST_USER, entry2);

      const hoppingAlerts = alerts.filter((a) => a.type === 'SCOPE_HOPPING');
      expect(hoppingAlerts).toHaveLength(0);
    });

    it('not detected when connections are outside 30s window', () => {
      const now = Date.now();

      const entry1 = makeAuditEntry({
        connection: 'google-oauth2',
        timestamp: new Date(now - 60_000).toISOString(),
      });
      checkForAnomalies(TEST_USER, entry1);

      const entry2 = makeAuditEntry({
        toolName: 'listRepositories',
        connection: 'github',
        scopes: ['repo'],
        timestamp: new Date(now - 50_000).toISOString(),
      });
      checkForAnomalies(TEST_USER, entry2);

      const entry3 = makeAuditEntry({
        toolName: 'shopOnlineTool',
        connection: 'ciba',
        scopes: ['product:buy'],
        riskLevel: 'RED',
        timestamp: new Date(now).toISOString(),
      });
      const alerts = checkForAnomalies(TEST_USER, entry3);

      const hoppingAlerts = alerts.filter((a) => a.type === 'SCOPE_HOPPING');
      expect(hoppingAlerts).toHaveLength(0);
    });
  });

  describe('UNUSUAL_SCOPE', () => {
    it('detected when a new tool is used after baseline is established', () => {
      const now = Date.now();

      // Build baseline: 6 calls with the same tool (>= UNUSUAL_SCOPE_BASELINE_COUNT + 1)
      for (let i = 0; i < 6; i++) {
        const entry = makeAuditEntry({
          toolName: 'gmailSearchTool',
          timestamp: new Date(now - (60_000 * (6 - i))).toISOString(),
        });
        checkForAnomalies(TEST_USER, entry);
      }

      // Now use a brand-new tool
      const novelEntry = makeAuditEntry({
        toolName: 'shopOnlineTool',
        connection: 'ciba',
        scopes: ['product:buy'],
        riskLevel: 'RED',
        timestamp: new Date(now).toISOString(),
      });
      const alerts = checkForAnomalies(TEST_USER, novelEntry);

      const unusualAlerts = alerts.filter((a) => a.type === 'UNUSUAL_SCOPE');
      expect(unusualAlerts).toHaveLength(1);
      expect(unusualAlerts[0].details.toolName).toBe('shopOnlineTool');
    });

    it('not detected when tool was used before', () => {
      const now = Date.now();

      // Build baseline with two tools
      for (let i = 0; i < 6; i++) {
        const toolName = i % 2 === 0 ? 'gmailSearchTool' : 'getCalendarEventsTool';
        const entry = makeAuditEntry({
          toolName,
          timestamp: new Date(now - (60_000 * (6 - i))).toISOString(),
        });
        checkForAnomalies(TEST_USER, entry);
      }

      // Use a tool that's already been used
      const repeatEntry = makeAuditEntry({
        toolName: 'gmailSearchTool',
        timestamp: new Date(now).toISOString(),
      });
      const alerts = checkForAnomalies(TEST_USER, repeatEntry);

      const unusualAlerts = alerts.filter((a) => a.type === 'UNUSUAL_SCOPE');
      expect(unusualAlerts).toHaveLength(0);
    });

    it('not detected before baseline is established', () => {
      const now = Date.now();

      // Only 3 calls (below the baseline threshold of 5+1)
      for (let i = 0; i < 3; i++) {
        const entry = makeAuditEntry({
          toolName: 'gmailSearchTool',
          timestamp: new Date(now - (60_000 * (3 - i))).toISOString(),
        });
        checkForAnomalies(TEST_USER, entry);
      }

      // New tool, but baseline not established yet
      const novelEntry = makeAuditEntry({
        toolName: 'shopOnlineTool',
        connection: 'ciba',
        scopes: ['product:buy'],
        riskLevel: 'RED',
        timestamp: new Date(now).toISOString(),
      });
      const alerts = checkForAnomalies(TEST_USER, novelEntry);

      const unusualAlerts = alerts.filter((a) => a.type === 'UNUSUAL_SCOPE');
      expect(unusualAlerts).toHaveLength(0);
    });
  });

  describe('getActiveAlerts', () => {
    it('returns empty array when no alerts', () => {
      const alerts = getActiveAlerts(TEST_USER);
      expect(alerts).toEqual([]);
    });

    it('accumulates alerts', () => {
      const now = Date.now();

      // Trigger RAPID_ESCALATION
      const greenEntry = makeAuditEntry({
        riskLevel: 'GREEN',
        timestamp: new Date(now - 10_000).toISOString(),
      });
      checkForAnomalies(TEST_USER, greenEntry);

      const redEntry = makeAuditEntry({
        toolName: 'shopOnlineTool',
        riskLevel: 'RED',
        connection: 'ciba',
        timestamp: new Date(now).toISOString(),
      });
      checkForAnomalies(TEST_USER, redEntry);

      const alerts = getActiveAlerts(TEST_USER);
      expect(alerts.length).toBeGreaterThan(0);
    });
  });

  describe('clearAlerts', () => {
    it('removes all alerts for the user', () => {
      const now = Date.now();

      // Generate an alert
      const greenEntry = makeAuditEntry({
        riskLevel: 'GREEN',
        timestamp: new Date(now - 10_000).toISOString(),
      });
      checkForAnomalies(TEST_USER, greenEntry);

      const redEntry = makeAuditEntry({
        toolName: 'shopOnlineTool',
        riskLevel: 'RED',
        connection: 'ciba',
        timestamp: new Date(now).toISOString(),
      });
      checkForAnomalies(TEST_USER, redEntry);

      clearAlerts(TEST_USER);
      expect(getActiveAlerts(TEST_USER)).toEqual([]);
    });
  });
});
