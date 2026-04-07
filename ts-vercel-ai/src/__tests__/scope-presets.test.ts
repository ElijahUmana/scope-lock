import { describe, it, expect } from 'vitest';
import { getPreset, getToolNamesForPreset, SCOPE_PRESETS } from '@/lib/scope-presets';

describe('Scope Presets', () => {
  describe('Lockdown preset', () => {
    it('exists', () => {
      const preset = getPreset('lockdown');
      expect(preset).toBeDefined();
    });

    it('has 0 allowed tools', () => {
      const preset = getPreset('lockdown')!;
      expect(preset.allowedTools).toHaveLength(0);
    });

    it('has GREEN risk threshold', () => {
      const preset = getPreset('lockdown')!;
      expect(preset.riskThreshold).toBe('GREEN');
    });
  });

  describe('Privacy preset', () => {
    it('exists', () => {
      const preset = getPreset('privacy');
      expect(preset).toBeDefined();
    });

    it('has only read tools', () => {
      const preset = getPreset('privacy')!;
      expect(preset.allowedTools).toContain('gmailSearchTool');
      expect(preset.allowedTools).toContain('getCalendarEventsTool');
      expect(preset.allowedTools).toContain('getTasksTool');
      expect(preset.allowedTools).toContain('getUserInfoTool');
    });

    it('does not have write tools', () => {
      const preset = getPreset('privacy')!;
      expect(preset.allowedTools).not.toContain('gmailDraftTool');
      expect(preset.allowedTools).not.toContain('createTasksTool');
      expect(preset.allowedTools).not.toContain('shopOnlineTool');
    });

    it('has GREEN risk threshold', () => {
      const preset = getPreset('privacy')!;
      expect(preset.riskThreshold).toBe('GREEN');
    });
  });

  describe('Productivity preset', () => {
    it('exists', () => {
      const preset = getPreset('productivity');
      expect(preset).toBeDefined();
    });

    it('has read and write tools', () => {
      const preset = getPreset('productivity')!;
      expect(preset.allowedTools).toContain('gmailSearchTool');
      expect(preset.allowedTools).toContain('getCalendarEventsTool');
      expect(preset.allowedTools).toContain('getTasksTool');
      expect(preset.allowedTools).toContain('getUserInfoTool');
      expect(preset.allowedTools).toContain('gmailDraftTool');
      expect(preset.allowedTools).toContain('createTasksTool');
      // Disabled features should not be in presets
      expect(preset.allowedTools).not.toContain('shopOnlineTool');
      expect(preset.allowedTools).not.toContain('listRepositories');
      expect(preset.allowedTools).not.toContain('listGitHubEvents');
    });

    it('has RED risk threshold', () => {
      const preset = getPreset('productivity')!;
      expect(preset.riskThreshold).toBe('RED');
    });
  });

  describe('getPreset', () => {
    it('returns correct preset for lockdown', () => {
      const preset = getPreset('lockdown');
      expect(preset?.id).toBe('lockdown');
      expect(preset?.name).toBe('Lockdown');
    });

    it('returns correct preset for privacy', () => {
      const preset = getPreset('privacy');
      expect(preset?.id).toBe('privacy');
      expect(preset?.name).toBe('Privacy');
    });

    it('returns correct preset for productivity', () => {
      const preset = getPreset('productivity');
      expect(preset?.id).toBe('productivity');
      expect(preset?.name).toBe('Productivity');
    });

    it('returns undefined for invalid preset ID', () => {
      const preset = getPreset('nonexistent-preset');
      expect(preset).toBeUndefined();
    });
  });

  describe('getToolNamesForPreset', () => {
    it('returns empty array for lockdown', () => {
      const tools = getToolNamesForPreset('lockdown');
      expect(tools).toEqual([]);
    });

    it('returns read tools for privacy', () => {
      const tools = getToolNamesForPreset('privacy');
      expect(tools).toContain('gmailSearchTool');
      expect(tools).toContain('getCalendarEventsTool');
      expect(tools).toContain('getTasksTool');
      expect(tools).toContain('getUserInfoTool');
      expect(tools.length).toBe(4);
    });

    it('returns all tools for productivity', () => {
      const tools = getToolNamesForPreset('productivity');
      expect(tools).toContain('gmailSearchTool');
      expect(tools).toContain('getCalendarEventsTool');
      expect(tools).toContain('getTasksTool');
      expect(tools).toContain('getUserInfoTool');
      expect(tools).toContain('gmailDraftTool');
      expect(tools).toContain('createTasksTool');
      expect(tools.length).toBe(6);
    });

    it('returns empty array for invalid preset ID', () => {
      const tools = getToolNamesForPreset('nonexistent');
      expect(tools).toEqual([]);
    });
  });

  describe('preset structure', () => {
    it('all presets have required fields', () => {
      for (const preset of SCOPE_PRESETS) {
        expect(preset.id).toBeDefined();
        expect(preset.name).toBeDefined();
        expect(preset.icon).toBeDefined();
        expect(preset.description).toBeDefined();
        expect(Array.isArray(preset.allowedTools)).toBe(true);
        expect(preset.riskThreshold).toBeDefined();
        expect(preset.color).toBeDefined();
      }
    });
  });
});
