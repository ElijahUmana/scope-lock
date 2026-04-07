import { describe, it, expect } from 'vitest';
import { resolveScopes, formatAuthorizationPlan } from '@/lib/scope-resolver';

describe('Scope Resolver', () => {
  describe('single tool resolution', () => {
    it('resolves gmailSearchTool to correct scopes', () => {
      const plan = resolveScopes(['gmailSearchTool']);
      expect(plan.requirements).toHaveLength(1);
      expect(plan.requirements[0].scopes).toContain('gmail.readonly');
      expect(plan.requirements[0].connection).toBe('google-oauth2');
      expect(plan.requirements[0].riskLevel).toBe('GREEN');
      expect(plan.requirements[0].credentialsContext).toBe('thread');
    });

    it('resolves unknown tool to AMBER defaults', () => {
      const plan = resolveScopes(['shopOnlineTool']);
      expect(plan.requirements).toHaveLength(1);
      expect(plan.requirements[0].scopes).toEqual([]);
      expect(plan.requirements[0].connection).toBe('unknown');
      expect(plan.requirements[0].riskLevel).toBe('AMBER');
      expect(plan.requirements[0].credentialsContext).toBe('tool-call');
    });

    it('resolves gmailDraftTool to correct scopes', () => {
      const plan = resolveScopes(['gmailDraftTool']);
      expect(plan.requirements).toHaveLength(1);
      expect(plan.requirements[0].scopes).toContain('gmail.compose');
      expect(plan.requirements[0].riskLevel).toBe('AMBER');
    });
  });

  describe('multiple tools — scope aggregation', () => {
    it('aggregates scopes from multiple tools', () => {
      const plan = resolveScopes(['gmailSearchTool', 'getCalendarEventsTool']);
      expect(plan.requirements).toHaveLength(2);
      expect(plan.totalScopes).toBe(2); // gmail.readonly + calendar.events
    });

    it('deduplicates scopes across tools with same scopes', () => {
      // getTasksTool and createTasksTool both use 'tasks' scope
      const plan = resolveScopes(['getTasksTool', 'createTasksTool']);
      expect(plan.requirements).toHaveLength(2);
      expect(plan.totalScopes).toBe(1); // 'tasks' appears once in the set
    });

    it('counts distinct connections', () => {
      const plan = resolveScopes(['gmailSearchTool', 'getUserInfoTool']);
      expect(plan.estimatedConnections).toBe(2); // google-oauth2, auth0
    });
  });

  describe('risk level is maximum across all tools', () => {
    it('GREEN when all tools are GREEN', () => {
      const plan = resolveScopes(['gmailSearchTool', 'getCalendarEventsTool']);
      expect(plan.maxRiskLevel).toBe('GREEN');
    });

    it('AMBER when highest is AMBER', () => {
      const plan = resolveScopes(['gmailSearchTool', 'gmailDraftTool']);
      expect(plan.maxRiskLevel).toBe('AMBER');
    });

    it('AMBER when any tool is unknown (shopOnlineTool removed from resolver)', () => {
      const plan = resolveScopes(['gmailSearchTool', 'shopOnlineTool']);
      expect(plan.maxRiskLevel).toBe('AMBER');
    });
  });

  describe('requiresStepUp', () => {
    it('false when no RED tools', () => {
      const plan = resolveScopes(['gmailSearchTool', 'gmailDraftTool']);
      expect(plan.requiresStepUp).toBe(false);
    });

    it('false when shopOnlineTool is included (no longer RED in resolver)', () => {
      const plan = resolveScopes(['gmailSearchTool', 'shopOnlineTool']);
      expect(plan.requiresStepUp).toBe(false);
    });

    it('false when only shopOnlineTool (treated as AMBER unknown)', () => {
      const plan = resolveScopes(['shopOnlineTool']);
      expect(plan.requiresStepUp).toBe(false);
    });
  });

  describe('unknown tools', () => {
    it('handles unknown tool names gracefully', () => {
      const plan = resolveScopes(['totallyFakeTool']);
      expect(plan.requirements).toHaveLength(1);
      expect(plan.requirements[0].riskLevel).toBe('AMBER');
      expect(plan.requirements[0].connection).toBe('unknown');
      expect(plan.requirements[0].scopes).toEqual([]);
    });

    it('unknown tool raises max risk to at least AMBER', () => {
      const plan = resolveScopes(['totallyFakeTool']);
      expect(plan.maxRiskLevel).toBe('AMBER');
    });
  });

  describe('empty input', () => {
    it('returns empty plan for no tools', () => {
      const plan = resolveScopes([]);
      expect(plan.requirements).toHaveLength(0);
      expect(plan.totalScopes).toBe(0);
      expect(plan.maxRiskLevel).toBe('GREEN');
      expect(plan.requiresStepUp).toBe(false);
      expect(plan.estimatedConnections).toBe(0);
    });
  });

  describe('formatAuthorizationPlan', () => {
    it('returns no-services message for empty plan', () => {
      const plan = resolveScopes([]);
      const formatted = formatAuthorizationPlan(plan);
      expect(formatted).toContain('No external services');
    });

    it('includes tool names in formatted output', () => {
      const plan = resolveScopes(['gmailSearchTool', 'shopOnlineTool']);
      const formatted = formatAuthorizationPlan(plan);
      expect(formatted).toContain('gmailSearchTool');
      expect(formatted).toContain('shopOnlineTool');
    });

    it('does not include step-up warning for shopOnlineTool (no longer RED)', () => {
      const plan = resolveScopes(['shopOnlineTool']);
      const formatted = formatAuthorizationPlan(plan);
      expect(formatted).not.toContain('step-up authentication');
    });

    it('does not include step-up warning for non-RED plans', () => {
      const plan = resolveScopes(['gmailSearchTool']);
      const formatted = formatAuthorizationPlan(plan);
      expect(formatted).not.toContain('step-up authentication');
    });
  });
});
