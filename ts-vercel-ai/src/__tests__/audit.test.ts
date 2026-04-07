import { describe, it, expect, beforeEach } from 'vitest';
import { logToolCall, getAuditLog, clearAuditLog, verifyAuditChain, GENESIS_HASH } from '@/lib/audit';

function makeEntry(overrides: Partial<Parameters<typeof logToolCall>[0]> = {}) {
  return {
    toolName: 'gmailSearchTool',
    scopes: ['gmail.readonly'],
    timestamp: new Date().toISOString(),
    success: true,
    duration: 120,
    userId: 'test-user',
    connection: 'google-oauth2',
    credentialsContext: 'thread',
    riskLevel: 'GREEN',
    ...overrides,
  };
}

describe('Audit Trail', () => {
  beforeEach(() => {
    clearAuditLog('test-user');
    clearAuditLog('other-user');
  });

  describe('logToolCall', () => {
    it('adds an entry to the store', () => {
      logToolCall(makeEntry());
      const log = getAuditLog('test-user');
      expect(log).toHaveLength(1);
    });

    it('returns the full entry with id, hash, and previousHash', () => {
      const entry = logToolCall(makeEntry());
      expect(entry.id).toBeDefined();
      expect(entry.id).toMatch(/^audit-/);
      expect(entry.hash).toBeDefined();
      expect(entry.hash.length).toBe(64); // SHA-256 hex
      expect(entry.previousHash).toBeDefined();
    });

    it('first entry has GENESIS_HASH as previousHash', () => {
      const entry = logToolCall(makeEntry());
      expect(entry.previousHash).toBe(GENESIS_HASH);
    });

    it('chains entries via previousHash', () => {
      const first = logToolCall(makeEntry());
      const second = logToolCall(makeEntry({ toolName: 'gmailDraftTool', riskLevel: 'AMBER' }));
      expect(second.previousHash).toBe(first.hash);
    });
  });

  describe('getAuditLog', () => {
    it('returns entries for the correct user', () => {
      logToolCall(makeEntry({ userId: 'test-user' }));
      logToolCall(makeEntry({ userId: 'other-user' }));
      const log = getAuditLog('test-user');
      expect(log).toHaveLength(1);
      expect(log[0].userId).toBe('test-user');
    });

    it('returns empty array for unknown user', () => {
      const log = getAuditLog('nobody');
      expect(log).toEqual([]);
    });

    it('returns entries in chronological order', () => {
      logToolCall(makeEntry({ toolName: 'first', timestamp: '2024-01-01T00:00:00Z' }));
      logToolCall(makeEntry({ toolName: 'second', timestamp: '2024-01-01T00:01:00Z' }));
      const log = getAuditLog('test-user');
      expect(log[0].toolName).toBe('first');
      expect(log[1].toolName).toBe('second');
    });
  });

  describe('entry fields', () => {
    it('includes all required fields', () => {
      const entry = logToolCall(makeEntry({
        toolName: 'gmailDraftTool',
        scopes: ['gmail.compose'],
        success: true,
        riskLevel: 'AMBER',
        connection: 'google-oauth2',
        credentialsContext: 'tool-call',
      }));

      expect(entry.toolName).toBe('gmailDraftTool');
      expect(entry.scopes).toEqual(['gmail.compose']);
      expect(entry.timestamp).toBeDefined();
      expect(entry.success).toBe(true);
      expect(entry.riskLevel).toBe('AMBER');
      expect(entry.connection).toBe('google-oauth2');
      expect(entry.credentialsContext).toBe('tool-call');
    });
  });

  describe('store cap at 200 entries', () => {
    it('keeps at most 200 entries per user', () => {
      for (let i = 0; i < 210; i++) {
        logToolCall(makeEntry({ timestamp: new Date(Date.now() + i).toISOString() }));
      }
      const log = getAuditLog('test-user');
      expect(log.length).toBeLessThanOrEqual(200);
    });

    it('retains the most recent entries when capped', () => {
      for (let i = 0; i < 210; i++) {
        logToolCall(makeEntry({ toolName: `tool-${i}` }));
      }
      const log = getAuditLog('test-user');
      // The last entry should be tool-209
      expect(log[log.length - 1].toolName).toBe('tool-209');
      // The first should be tool-10 (entries 0-9 dropped)
      expect(log[0].toolName).toBe('tool-10');
    });
  });

  describe('clearAuditLog', () => {
    it('removes all entries for the user', () => {
      logToolCall(makeEntry());
      logToolCall(makeEntry());
      clearAuditLog('test-user');
      const log = getAuditLog('test-user');
      expect(log).toEqual([]);
    });

    it('does not affect other users', () => {
      logToolCall(makeEntry({ userId: 'test-user' }));
      logToolCall(makeEntry({ userId: 'other-user' }));
      clearAuditLog('test-user');
      expect(getAuditLog('test-user')).toEqual([]);
      expect(getAuditLog('other-user')).toHaveLength(1);
    });
  });

  describe('verifyAuditChain', () => {
    it('returns valid for empty log', () => {
      const result = verifyAuditChain('test-user');
      expect(result.valid).toBe(true);
    });

    it('returns valid for intact chain', () => {
      logToolCall(makeEntry());
      logToolCall(makeEntry({ toolName: 'gmailDraftTool', riskLevel: 'AMBER' }));
      logToolCall(makeEntry({ toolName: 'shopOnlineTool', riskLevel: 'RED' }));
      const result = verifyAuditChain('test-user');
      expect(result.valid).toBe(true);
    });
  });
});
