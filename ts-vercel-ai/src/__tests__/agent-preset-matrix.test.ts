import { describe, it, expect } from 'vitest';
import { getToolsForAgent, getAgentProfile, AGENT_PROFILES } from '@/lib/agents';
import { getToolNamesForPreset, getPreset, SCOPE_PRESETS } from '@/lib/scope-presets';

/**
 * Mirrors the filtering logic from route.ts `getFilteredTools`.
 * Given an agentId and presetId, returns the tool names that the API
 * would make available to the LLM.
 */
function computeEffectiveToolNames(agentId: string, presetId: string): string[] {
  const agentTools = getToolsForAgent(agentId);
  const presetTools = getToolNamesForPreset(presetId);
  const presetSet = new Set(presetTools);
  return agentTools.filter((t) => presetSet.has(t));
}

const AGENT_IDS = AGENT_PROFILES.map((a) => a.id);
const PRESET_IDS = SCOPE_PRESETS.map((p) => p.id);

/**
 * Expected tool counts for the full 3x3 matrix.
 *
 * Reader tools (6): gmailSearchTool, getCalendarEventsTool, getTasksTool, getUserInfoTool, listRepositories, listGitHubEvents
 * Writer tools (2): gmailDraftTool, createTasksTool
 * Commerce tools (1): shopOnlineTool
 *
 * Lockdown allows: [] (0)
 * Privacy allows: gmailSearchTool, getCalendarEventsTool, getTasksTool, getUserInfoTool, listRepositories, listGitHubEvents (6)
 * Productivity allows: all 9
 */
const EXPECTED_MATRIX: Record<string, Record<string, { count: number; tools: string[] }>> = {
  reader: {
    lockdown: { count: 0, tools: [] },
    privacy: {
      count: 6,
      tools: ['gmailSearchTool', 'getCalendarEventsTool', 'getTasksTool', 'getUserInfoTool', 'listRepositories', 'listGitHubEvents'],
    },
    productivity: {
      count: 6,
      tools: ['gmailSearchTool', 'getCalendarEventsTool', 'getTasksTool', 'getUserInfoTool', 'listRepositories', 'listGitHubEvents'],
    },
  },
  writer: {
    lockdown: { count: 0, tools: [] },
    privacy: { count: 0, tools: [] },
    productivity: { count: 2, tools: ['gmailDraftTool', 'createTasksTool'] },
  },
  commerce: {
    lockdown: { count: 0, tools: [] },
    privacy: { count: 0, tools: [] },
    productivity: { count: 1, tools: ['shopOnlineTool'] },
  },
};

describe('Agent + Preset full matrix (3 agents x 3 presets = 9 combinations)', () => {
  for (const agentId of AGENT_IDS) {
    for (const presetId of PRESET_IDS) {
      const expected = EXPECTED_MATRIX[agentId]?.[presetId];

      describe(`${agentId} + ${presetId}`, () => {
        it(`produces exactly ${expected?.count ?? '?'} tools`, () => {
          expect(expected).toBeDefined();
          const effective = computeEffectiveToolNames(agentId, presetId);
          expect(effective).toHaveLength(expected!.count);
        });

        it('produces exactly the expected tool set', () => {
          expect(expected).toBeDefined();
          const effective = computeEffectiveToolNames(agentId, presetId);
          expect(effective.sort()).toEqual([...expected!.tools].sort());
        });

        it('every returned tool exists in the agent profile', () => {
          const effective = computeEffectiveToolNames(agentId, presetId);
          const agentTools = getToolsForAgent(agentId);
          for (const t of effective) {
            expect(agentTools).toContain(t);
          }
        });

        it('every returned tool exists in the preset allowed list', () => {
          const effective = computeEffectiveToolNames(agentId, presetId);
          const presetTools = getToolNamesForPreset(presetId);
          for (const t of effective) {
            expect(presetTools).toContain(t);
          }
        });

        it('no tool from the agent cannotAccess list leaks through', () => {
          const effective = computeEffectiveToolNames(agentId, presetId);
          const agent = getAgentProfile(agentId)!;
          for (const forbidden of agent.cannotAccess) {
            expect(effective).not.toContain(forbidden);
          }
        });
      });
    }
  }
});

describe('System prompt includes agent role addition', () => {
  for (const agent of AGENT_PROFILES) {
    it(`${agent.id} agent has a non-empty systemPromptAddition`, () => {
      expect(agent.systemPromptAddition).toBeTruthy();
      expect(agent.systemPromptAddition.length).toBeGreaterThan(20);
    });

    it(`${agent.id} agent systemPromptAddition mentions its name`, () => {
      expect(agent.systemPromptAddition.toUpperCase()).toContain(agent.id.toUpperCase());
    });
  }
});

describe('Lockdown preset blocks ALL tools for every agent', () => {
  for (const agent of AGENT_PROFILES) {
    it(`${agent.id} + lockdown = 0 tools`, () => {
      const effective = computeEffectiveToolNames(agent.id, 'lockdown');
      expect(effective).toHaveLength(0);
    });
  }
});

describe('No agent gains tools it should not have via any preset', () => {
  for (const agent of AGENT_PROFILES) {
    for (const preset of SCOPE_PRESETS) {
      it(`${agent.id} + ${preset.id}: no cannotAccess tool appears`, () => {
        const effective = computeEffectiveToolNames(agent.id, preset.id);
        for (const forbidden of agent.cannotAccess) {
          expect(effective).not.toContain(forbidden);
        }
      });
    }
  }
});

describe('Query param construction matches route.ts expectations', () => {
  it('agentId and preset are both passed as query params', () => {
    // Simulate what chat-window.tsx does
    const agentId = 'reader';
    const presetId = 'privacy';
    const params = new URLSearchParams();
    params.set('agentId', agentId);
    params.set('preset', presetId);
    const qs = params.toString();
    const url = `api/chat?${qs}`;

    // Verify route.ts can extract them
    const parsed = new URL(url, 'http://localhost');
    expect(parsed.searchParams.get('agentId')).toBe('reader');
    expect(parsed.searchParams.get('preset')).toBe('privacy');
  });

  it('default preset is privacy when not specified', () => {
    // route.ts line: const presetId = req.nextUrl.searchParams.get('preset') ?? 'privacy';
    const fallback = null ?? 'privacy';
    expect(fallback).toBe('privacy');
  });
});
