// Risk-tier policy engine for Scope Lock.
// Classifies every tool call by risk level and determines the required action.

export type RiskLevel = 'GREEN' | 'AMBER' | 'RED';

export interface PolicyDecision {
  level: RiskLevel;
  action: 'auto-approve' | 'warn-and-proceed' | 'require-step-up';
  reason: string;
  requiredAuth?: 'none' | 'consent' | 'ciba';
}

export interface PolicyRule {
  toolName: string;
  level: RiskLevel;
  action: 'auto-approve' | 'warn-and-proceed' | 'require-step-up';
  reason: string;
}

const POLICY_RULES: PolicyRule[] = [
  // GREEN — read-only operations (auto-approve)
  { toolName: 'gmailSearchTool', level: 'GREEN', action: 'auto-approve', reason: 'Read-only Gmail search' },
  { toolName: 'getCalendarEventsTool', level: 'GREEN', action: 'auto-approve', reason: 'Read-only calendar access' },
  { toolName: 'getTasksTool', level: 'GREEN', action: 'auto-approve', reason: 'Read-only tasks access' },
  { toolName: 'listRepositories', level: 'GREEN', action: 'auto-approve', reason: 'Read-only GitHub repo listing' },
  { toolName: 'listGitHubEvents', level: 'GREEN', action: 'auto-approve', reason: 'Read-only GitHub events listing' },
  { toolName: 'listSlackChannels', level: 'GREEN', action: 'auto-approve', reason: 'Read-only Slack channels listing' },
  { toolName: 'getUserInfoTool', level: 'GREEN', action: 'auto-approve', reason: 'Read-only user profile access' },

  // AMBER — write operations (warn-and-proceed)
  { toolName: 'gmailDraftTool', level: 'AMBER', action: 'warn-and-proceed', reason: 'Write operation — creates Gmail draft' },
  { toolName: 'createTasksTool', level: 'AMBER', action: 'warn-and-proceed', reason: 'Write operation — creates Google Task' },

  // RED — destructive/financial operations (require-step-up)
  { toolName: 'shopOnlineTool', level: 'RED', action: 'require-step-up', reason: 'Financial transaction — online purchase' },
];

const RULE_MAP = new Map<string, PolicyRule>(
  POLICY_RULES.map((rule) => [rule.toolName, rule]),
);

const AUTH_MAP: Record<RiskLevel, 'none' | 'consent' | 'ciba'> = {
  GREEN: 'none',
  AMBER: 'consent',
  RED: 'ciba',
};

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

/**
 * Return all policy rules for display in the dashboard.
 */
export function getPolicyRules(): PolicyRule[] {
  return [...POLICY_RULES];
}
