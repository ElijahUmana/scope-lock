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
    it('exists in the profiles list', () => {
      const commerce = getAgentProfile('commerce');
      expect(commerce).toBeDefined();
    });

    it('has only shopOnlineTool', () => {
      const commerce = getAgentProfile('commerce')!;
      expect(commerce.tools).toEqual(['shopOnlineTool']);
    });

    it('does NOT have gmailSearchTool', () => {
      const commerce = getAgentProfile('commerce')!;
      expect(commerce.tools).not.toContain('gmailSearchTool');
    });

    it('does NOT have gmailDraftTool', () => {
      const commerce = getAgentProfile('commerce')!;
      expect(commerce.tools).not.toContain('gmailDraftTool');
    });

    it('does NOT have any read tools', () => {
      const commerce = getAgentProfile('commerce')!;
      expect(commerce.tools).not.toContain('getCalendarEventsTool');
      expect(commerce.tools).not.toContain('getTasksTool');
      expect(commerce.tools).not.toContain('getUserInfoTool');
    });

    it('has high risk level', () => {
      const commerce = getAgentProfile('commerce')!;
      expect(commerce.riskLevel).toBe('high');
    });

    it('uses tool-call credentials context', () => {
      const commerce = getAgentProfile('commerce')!;
      expect(commerce.credentialsContext).toBe('tool-call');
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

    it('returns correct profile for commerce', () => {
      const profile = getAgentProfile('commerce');
      expect(profile?.id).toBe('commerce');
      expect(profile?.name).toBe('Commerce Agent');
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

    it('returns shopOnlineTool for commerce', () => {
      const tools = getToolsForAgent('commerce');
      expect(tools).toEqual(['shopOnlineTool']);
    });

    it('returns empty array for invalid agent ID', () => {
      const tools = getToolsForAgent('nonexistent-agent');
      expect(tools).toEqual([]);
    });
  });

  describe('agent isolation — cannotAccess declarations', () => {
    it('reader cannotAccess lists all write/commerce tools', () => {
      const reader = getAgentProfile('reader')!;
      expect(reader.cannotAccess).toContain('gmailDraftTool');
      expect(reader.cannotAccess).toContain('createTasksTool');
      expect(reader.cannotAccess).toContain('shopOnlineTool');
    });

    it('writer cannotAccess lists all read/commerce tools', () => {
      const writer = getAgentProfile('writer')!;
      expect(writer.cannotAccess).toContain('gmailSearchTool');
      expect(writer.cannotAccess).toContain('shopOnlineTool');
    });

    it('commerce cannotAccess lists all read/write tools', () => {
      const commerce = getAgentProfile('commerce')!;
      expect(commerce.cannotAccess).toContain('gmailSearchTool');
      expect(commerce.cannotAccess).toContain('gmailDraftTool');
      expect(commerce.cannotAccess).toContain('createTasksTool');
    });

    it('no agent has tools that overlap with its cannotAccess', () => {
      for (const agent of AGENT_PROFILES) {
        for (const tool of agent.tools) {
          expect(agent.cannotAccess).not.toContain(tool);
        }
      }
    });
  });
});
