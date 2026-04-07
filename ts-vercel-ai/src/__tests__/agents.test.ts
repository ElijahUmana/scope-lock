import { describe, it, expect } from 'vitest';
import { getAgentProfile, getToolsForAgent, AGENT_PROFILES } from '@/lib/agents';

describe('Agents', () => {
  describe('Reader agent', () => {
    it('exists in the profiles list', () => {
      const reader = getAgentProfile('reader');
      expect(reader).toBeDefined();
    });

    it('has only read tools', () => {
      const reader = getAgentProfile('reader')!;
      expect(reader.tools).toContain('gmailSearchTool');
      expect(reader.tools).toContain('getCalendarEventsTool');
      expect(reader.tools).toContain('getTasksTool');
      expect(reader.tools).toContain('getUserInfoTool');
    });

    it('does NOT have gmailDraftTool', () => {
      const reader = getAgentProfile('reader')!;
      expect(reader.tools).not.toContain('gmailDraftTool');
    });

    it('does NOT have shopOnlineTool', () => {
      const reader = getAgentProfile('reader')!;
      expect(reader.tools).not.toContain('shopOnlineTool');
    });

    it('does NOT have createTasksTool', () => {
      const reader = getAgentProfile('reader')!;
      expect(reader.tools).not.toContain('createTasksTool');
    });

    it('has low risk level', () => {
      const reader = getAgentProfile('reader')!;
      expect(reader.riskLevel).toBe('low');
    });

    it('uses thread credentials context', () => {
      const reader = getAgentProfile('reader')!;
      expect(reader.credentialsContext).toBe('thread');
    });
  });

  describe('Writer agent', () => {
    it('exists in the profiles list', () => {
      const writer = getAgentProfile('writer');
      expect(writer).toBeDefined();
    });

    it('has write tools', () => {
      const writer = getAgentProfile('writer')!;
      expect(writer.tools).toContain('gmailDraftTool');
      expect(writer.tools).toContain('createTasksTool');
    });

    it('does NOT have shopOnlineTool', () => {
      const writer = getAgentProfile('writer')!;
      expect(writer.tools).not.toContain('shopOnlineTool');
    });

    it('does NOT have read tools', () => {
      const writer = getAgentProfile('writer')!;
      expect(writer.tools).not.toContain('gmailSearchTool');
      expect(writer.tools).not.toContain('getCalendarEventsTool');
      expect(writer.tools).not.toContain('getTasksTool');
    });

    it('has medium risk level', () => {
      const writer = getAgentProfile('writer')!;
      expect(writer.riskLevel).toBe('medium');
    });

    it('uses tool-call credentials context', () => {
      const writer = getAgentProfile('writer')!;
      expect(writer.credentialsContext).toBe('tool-call');
    });
  });

  describe('Commerce agent', () => {
    it('does not exist (removed)', () => {
      const commerce = getAgentProfile('commerce');
      expect(commerce).toBeUndefined();
    });
  });

  describe('getAgentProfile', () => {
    it('returns correct profile for reader', () => {
      const profile = getAgentProfile('reader');
      expect(profile?.id).toBe('reader');
      expect(profile?.name).toBe('Reader Agent');
    });

    it('returns correct profile for writer', () => {
      const profile = getAgentProfile('writer');
      expect(profile?.id).toBe('writer');
      expect(profile?.name).toBe('Writer Agent');
    });

    it('returns undefined for commerce (removed)', () => {
      const profile = getAgentProfile('commerce');
      expect(profile).toBeUndefined();
    });

    it('returns undefined for invalid agent ID', () => {
      const profile = getAgentProfile('nonexistent-agent');
      expect(profile).toBeUndefined();
    });
  });

  describe('getToolsForAgent', () => {
    it('returns read tools for reader', () => {
      const tools = getToolsForAgent('reader');
      expect(tools).toContain('gmailSearchTool');
      expect(tools).toContain('getCalendarEventsTool');
      expect(tools).toContain('getTasksTool');
      expect(tools).toContain('getUserInfoTool');
    });

    it('returns write tools for writer', () => {
      const tools = getToolsForAgent('writer');
      expect(tools).toContain('gmailDraftTool');
      expect(tools).toContain('createTasksTool');
    });

    it('returns empty array for commerce (removed)', () => {
      const tools = getToolsForAgent('commerce');
      expect(tools).toEqual([]);
    });

    it('returns empty array for invalid agent ID', () => {
      const tools = getToolsForAgent('nonexistent-agent');
      expect(tools).toEqual([]);
    });
  });

  describe('agent isolation — cannotAccess declarations', () => {
    it('reader cannotAccess lists all write tools', () => {
      const reader = getAgentProfile('reader')!;
      expect(reader.cannotAccess).toContain('gmailDraftTool');
      expect(reader.cannotAccess).toContain('createTasksTool');
    });

    it('writer cannotAccess lists all read tools', () => {
      const writer = getAgentProfile('writer')!;
      expect(writer.cannotAccess).toContain('gmailSearchTool');
    });

    it('no agent has tools that overlap with its cannotAccess', () => {
      for (const agent of AGENT_PROFILES) {
        for (const tool of agent.tools) {
          expect(agent.cannotAccess).not.toContain(tool);
        }
      }
    });
  });

  describe('agent delegation — canDelegateTo', () => {
    it('reader can delegate to writer', () => {
      const reader = getAgentProfile('reader')!;
      expect(reader.canDelegateTo).toContain('writer');
    });

    it('writer cannot delegate to reader', () => {
      const writer = getAgentProfile('writer')!;
      expect(writer.canDelegateTo).not.toContain('reader');
    });

    it('writer cannot delegate to anyone', () => {
      const writer = getAgentProfile('writer')!;
      expect(writer.canDelegateTo).toHaveLength(0);
    });

    it('delegation targets are valid agent IDs', () => {
      for (const agent of AGENT_PROFILES) {
        for (const targetId of agent.canDelegateTo) {
          const target = getAgentProfile(targetId);
          expect(target).toBeDefined();
        }
      }
    });

    it('no agent delegates to itself', () => {
      for (const agent of AGENT_PROFILES) {
        expect(agent.canDelegateTo).not.toContain(agent.id);
      }
    });

    it('delegation flows in one direction: reader -> writer', () => {
      const reader = getAgentProfile('reader')!;
      const writer = getAgentProfile('writer')!;

      // Forward direction exists
      expect(reader.canDelegateTo).toContain('writer');

      // Reverse direction does not exist
      expect(writer.canDelegateTo).not.toContain('reader');
    });
  });
});
