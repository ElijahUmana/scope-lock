// Shared policy classification data for Scope Lock.
// This module is safe for BOTH client and server use — it contains only
// static data with zero external dependencies.
//
// The full policy engine (policy-engine.ts) imports from here and adds
// server-safe evaluation logic on top.

export type RiskLevel = 'GREEN' | 'AMBER' | 'RED';

export interface PolicyRule {
  toolName: string;
  level: RiskLevel;
  action: 'auto-approve' | 'warn-and-proceed' | 'require-step-up';
  reason: string;
}

export const POLICY_RULES: PolicyRule[] = [
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

export const AUTH_MAP: Record<RiskLevel, 'none' | 'consent' | 'ciba'> = {
  GREEN: 'none',
  AMBER: 'consent',
  RED: 'ciba',
};
