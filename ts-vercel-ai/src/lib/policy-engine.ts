// Risk-tier policy engine for Scope Lock.
// Classifies every tool call by risk level and determines the required action.
//
// Static data (types, rules, auth map) lives in policy-constants.ts so that
// client components can safely import them without pulling in server-only code.

import {
  POLICY_RULES,
  AUTH_MAP,
  type RiskLevel,
  type PolicyRule,
} from './policy-constants';

export type { RiskLevel, PolicyRule };

export interface PolicyDecision {
  level: RiskLevel;
  action: 'auto-approve' | 'warn-and-proceed' | 'require-step-up';
  reason: string;
  requiredAuth?: 'none' | 'consent' | 'ciba';
}

const RULE_MAP = new Map<string, PolicyRule>(
  POLICY_RULES.map((rule) => [rule.toolName, rule]),
);

/**
 * Evaluate the policy for a given tool call.
 * Returns the risk level, required action, and reason.
 */
export function evaluatePolicy(toolName: string, _args: unknown): PolicyDecision {
  const rule = RULE_MAP.get(toolName);

  if (rule) {
    return {
      level: rule.level,
      action: rule.action,
      reason: rule.reason,
      requiredAuth: AUTH_MAP[rule.level],
    };
  }

  // Unknown tools default to AMBER (cautious)
  return {
    level: 'AMBER',
    action: 'warn-and-proceed',
    reason: `Unknown tool "${toolName}" — defaulting to elevated access`,
    requiredAuth: 'consent',
  };
}

// Tools that are disabled in the UI but kept in the engine for evaluation/tests
const HIDDEN_TOOLS = new Set(['listRepositories', 'listGitHubEvents', 'listSlackChannels', 'shopOnlineTool']);

/**
 * Return policy rules for display in the dashboard.
 * Excludes disabled tools (GitHub, Slack, Commerce) that are not active features.
 */
export function getPolicyRules(): PolicyRule[] {
  return POLICY_RULES.filter((rule) => !HIDDEN_TOOLS.has(rule.toolName));
}
