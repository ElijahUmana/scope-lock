import { describe, it, expect } from 'vitest';
import { getToolsForAgent } from '@/lib/agents';
import { getToolNamesForPreset } from '@/lib/scope-presets';

/**
 * Compute the intersection of agent tools and preset allowed tools.
 * This mirrors what the runtime should do: only allow tools that
 * appear in BOTH the agent's tool list and the preset's allowed list.
 */
function getEffectiveTools(agentId: string | null, presetId: string): string[] {
  const presetTools = getToolNamesForPreset(presetId);
  if (agentId === null) {
    return presetTools;
  }
  const agentTools = getToolsForAgent(agentId);
  return agentTools.filter((t) => presetTools.includes(t));
}

describe('Scope Presets + Agent Integration', () => {
  describe('Reader agent + Privacy preset', () => {
    it('returns intersection of their tools', () => {
      const effective = getEffectiveTools('reader', 'privacy');
      // Reader has: gmailSearchTool, getCalendarEventsTool, getTasksTool, getUserInfoTool
      // Privacy has: gmailSearchTool, getCalendarEventsTool, getTasksTool, getUserInfoTool
      // Intersection = all 4
      expect(effective).toContain('gmailSearchTool');
      expect(effective).toContain('getCalendarEventsTool');
      expect(effective).toContain('getTasksTool');
      expect(effective).toContain('getUserInfoTool');
      expect(effective).toHaveLength(4);
    });
  });

  describe('Reader agent + Lockdown preset', () => {
    it('returns 0 tools', () => {
      const effective = getEffectiveTools('reader', 'lockdown');
      expect(effective).toHaveLength(0);
    });
  });

  describe('No agent + Lockdown preset', () => {
    it('returns 0 tools', () => {
      const effective = getEffectiveTools(null, 'lockdown');
      expect(effective).toHaveLength(0);
    });
  });

  describe('Writer agent + Privacy preset', () => {
    it('returns only tools in BOTH lists', () => {
      const effective = getEffectiveTools('writer', 'privacy');
      // Writer has: gmailDraftTool, createTasksTool
      // Privacy has: gmailSearchTool, getCalendarEventsTool, getTasksTool, getUserInfoTool
      // Intersection = empty (no overlap)
      expect(effective).toHaveLength(0);
    });
  });

  describe('Writer agent + Productivity preset', () => {
    it('returns writer tools (all are in productivity)', () => {
      const effective = getEffectiveTools('writer', 'productivity');
      // Writer has: gmailDraftTool, createTasksTool
      // Productivity has all tools
      expect(effective).toContain('gmailDraftTool');
      expect(effective).toContain('createTasksTool');
      expect(effective).toHaveLength(2);
    });
  });

  describe('Reader agent + Productivity preset', () => {
    it('returns reader tools (all are in productivity)', () => {
      const effective = getEffectiveTools('reader', 'productivity');
      expect(effective).toContain('gmailSearchTool');
      expect(effective).toContain('getCalendarEventsTool');
      expect(effective).toContain('getTasksTool');
      expect(effective).toContain('getUserInfoTool');
      expect(effective).toHaveLength(4);
    });
  });

  describe('Writer agent + Lockdown preset', () => {
    it('returns 0 tools', () => {
      const effective = getEffectiveTools('writer', 'lockdown');
      expect(effective).toHaveLength(0);
    });
  });
});
