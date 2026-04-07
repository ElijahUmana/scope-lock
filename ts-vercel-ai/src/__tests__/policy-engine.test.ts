import { describe, it, expect } from 'vitest';
import { evaluatePolicy, getPolicyRules } from '@/lib/policy-engine';

describe('Policy Engine', () => {
  describe('GREEN tools — auto-approve', () => {
    const greenTools = [
      'gmailSearchTool',
      'getCalendarEventsTool',
      'getTasksTool',
      'listRepositories',
      'listGitHubEvents',
      'listSlackChannels',
      'getUserInfoTool',
    ];

    for (const toolName of greenTools) {
      it(`classifies ${toolName} as GREEN`, () => {
        const decision = evaluatePolicy(toolName, {});
        expect(decision.level).toBe('GREEN');
      });

      it(`auto-approves ${toolName}`, () => {
        const decision = evaluatePolicy(toolName, {});
        expect(decision.action).toBe('auto-approve');
      });

      it(`requires no auth for ${toolName}`, () => {
        const decision = evaluatePolicy(toolName, {});
        expect(decision.requiredAuth).toBe('none');
      });
    }
  });

  describe('AMBER tools — warn-and-proceed', () => {
    const amberTools = ['gmailDraftTool', 'createTasksTool'];

    for (const toolName of amberTools) {
      it(`classifies ${toolName} as AMBER`, () => {
        const decision = evaluatePolicy(toolName, {});
        expect(decision.level).toBe('AMBER');
      });

      it(`warn-and-proceed for ${toolName}`, () => {
        const decision = evaluatePolicy(toolName, {});
        expect(decision.action).toBe('warn-and-proceed');
      });

      it(`requires consent auth for ${toolName}`, () => {
        const decision = evaluatePolicy(toolName, {});
        expect(decision.requiredAuth).toBe('consent');
      });
    }
  });

  describe('RED tools — require-step-up', () => {
    it('classifies shopOnlineTool as RED', () => {
      const decision = evaluatePolicy('shopOnlineTool', {});
      expect(decision.level).toBe('RED');
    });

    it('require-step-up for shopOnlineTool', () => {
      const decision = evaluatePolicy('shopOnlineTool', {});
      expect(decision.action).toBe('require-step-up');
    });

    it('requires ciba auth for shopOnlineTool', () => {
      const decision = evaluatePolicy('shopOnlineTool', {});
      expect(decision.requiredAuth).toBe('ciba');
    });
  });

  describe('unknown tools — default to AMBER', () => {
    it('classifies unknown tool as AMBER', () => {
      const decision = evaluatePolicy('someTotallyUnknownTool', {});
      expect(decision.level).toBe('AMBER');
    });

    it('warn-and-proceed for unknown tool', () => {
      const decision = evaluatePolicy('someTotallyUnknownTool', {});
      expect(decision.action).toBe('warn-and-proceed');
    });

    it('requires consent auth for unknown tool', () => {
      const decision = evaluatePolicy('someTotallyUnknownTool', {});
      expect(decision.requiredAuth).toBe('consent');
    });

    it('includes tool name in reason for unknown tool', () => {
      const decision = evaluatePolicy('myCustomTool', {});
      expect(decision.reason).toContain('myCustomTool');
    });
  });

  describe('getPolicyRules', () => {
    it('returns all policy rules', () => {
      const rules = getPolicyRules();
      expect(rules.length).toBeGreaterThan(0);
    });

    it('contains GREEN, AMBER, and RED rules', () => {
      const rules = getPolicyRules();
      const levels = new Set(rules.map((r) => r.level));
      expect(levels.has('GREEN')).toBe(true);
      expect(levels.has('AMBER')).toBe(true);
      expect(levels.has('RED')).toBe(true);
    });

    it('returns a copy (not the internal array)', () => {
      const rules1 = getPolicyRules();
      const rules2 = getPolicyRules();
      expect(rules1).not.toBe(rules2);
      expect(rules1).toEqual(rules2);
    });

    it('each rule has toolName, level, action, and reason', () => {
      const rules = getPolicyRules();
      for (const rule of rules) {
        expect(rule.toolName).toBeDefined();
        expect(rule.level).toBeDefined();
        expect(rule.action).toBeDefined();
        expect(rule.reason).toBeDefined();
      }
    });
  });
});
