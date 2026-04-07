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
