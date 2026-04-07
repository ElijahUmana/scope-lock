// Scope Dependency Resolver for Scope Lock.
// Analyzes a set of tools and produces an authorization plan showing
// every scope, risk level, and credential context the request requires.

import { evaluatePolicy, type RiskLevel } from '@/lib/policy-engine';

// --- Public types ---

export interface ScopeRequirement {
  toolName: string;
  connection: string;
  scopes: string[];
  riskLevel: RiskLevel;
  credentialsContext: 'thread' | 'tool-call';
  reason: string;
}

export interface AuthorizationPlan {
  requirements: ScopeRequirement[];
  totalScopes: number;
  maxRiskLevel: RiskLevel;
  requiresStepUp: boolean;
  estimatedConnections: number;
}

// --- Internal registry ---

// Mirrors TOOL_SCOPE_MAP from the chat route so the resolver can work
// without importing route-level state.
const TOOL_METADATA: Record<
  string,
  { scopes: string[]; connection: string; credentialsContext: 'thread' | 'tool-call' }
> = {
  gmailSearchTool: { scopes: ['gmail.readonly'], connection: 'google-oauth2', credentialsContext: 'thread' },
  gmailDraftTool: { scopes: ['gmail.compose'], connection: 'google-oauth2', credentialsContext: 'tool-call' },
  getCalendarEventsTool: { scopes: ['calendar.events'], connection: 'google-oauth2', credentialsContext: 'thread' },
  getTasksTool: { scopes: ['tasks'], connection: 'google-oauth2', credentialsContext: 'thread' },
  createTasksTool: { scopes: ['tasks'], connection: 'google-oauth2', credentialsContext: 'thread' },
  getUserInfoTool: { scopes: ['openid', 'profile'], connection: 'auth0', credentialsContext: 'thread' },
};

// --- Risk ordering ---

const RISK_ORDER: Record<RiskLevel, number> = { GREEN: 0, AMBER: 1, RED: 2 };

function maxRisk(a: RiskLevel, b: RiskLevel): RiskLevel {
  return RISK_ORDER[a] >= RISK_ORDER[b] ? a : b;
}

// --- Resolver ---

/**
 * Resolve the full authorization plan for a set of tool names.
 * Returns the minimal set of scopes, connections, and risk metadata
 * the LLM should present to the user before executing.
 */
export function resolveScopes(toolNames: string[]): AuthorizationPlan {
  const requirements: ScopeRequirement[] = [];
  const allScopes = new Set<string>();
  const connections = new Set<string>();
  let highest: RiskLevel = 'GREEN';

  for (const toolName of toolNames) {
    const meta = TOOL_METADATA[toolName];
    if (!meta) {
      // Unknown tool: surface it transparently with AMBER risk.
      requirements.push({
        toolName,
        connection: 'unknown',
        scopes: [],
        riskLevel: 'AMBER',
        credentialsContext: 'tool-call',
        reason: `Unknown tool "${toolName}" -- defaulting to elevated risk`,
      });
      highest = maxRisk(highest, 'AMBER');
      connections.add('unknown');
      continue;
    }

    const policy = evaluatePolicy(toolName, {});
    const riskLevel = policy.level;

    requirements.push({
      toolName,
      connection: meta.connection,
      scopes: meta.scopes,
      riskLevel,
      credentialsContext: meta.credentialsContext,
      reason: policy.reason,
    });

    for (const scope of meta.scopes) {
      allScopes.add(scope);
    }
    connections.add(meta.connection);
    highest = maxRisk(highest, riskLevel);
  }

  return {
    requirements,
    totalScopes: allScopes.size,
    maxRiskLevel: highest,
    requiresStepUp: highest === 'RED',
    estimatedConnections: connections.size,
  };
}

// --- Formatter ---

const RISK_BADGE: Record<RiskLevel, string> = {
  GREEN: 'GREEN',
  AMBER: 'AMBER',
  RED: 'RED',
};

const CONTEXT_LABEL: Record<string, string> = {
  thread: 'thread-scoped',
  'tool-call': 'per-call isolation',
};

/**
 * Format an authorization plan as a readable markdown string
 * the LLM can include directly in its response to the user.
 */
export function formatAuthorizationPlan(plan: AuthorizationPlan): string {
  if (plan.requirements.length === 0) {
    return 'No external services are required for this request.';
  }

  const lines: string[] = [];
  lines.push('**Authorization Plan**\n');

  for (let i = 0; i < plan.requirements.length; i++) {
    const req = plan.requirements[i];
    const scopeList = req.scopes.length > 0 ? req.scopes.join(', ') : 'none';
    const ctx = CONTEXT_LABEL[req.credentialsContext] ?? req.credentialsContext;
    lines.push(
      `${i + 1}. **${req.toolName}** — ${req.reason}`,
    );
    lines.push(
      `   - Scopes: \`${scopeList}\` | Risk: **${RISK_BADGE[req.riskLevel]}** | Credentials: ${ctx}`,
    );
  }

  lines.push('');
  lines.push(`**Summary:** ${plan.totalScopes} scope(s) across ${plan.estimatedConnections} connection(s). Maximum risk level: **${RISK_BADGE[plan.maxRiskLevel]}**.`);

  if (plan.requiresStepUp) {
    lines.push('This plan includes a RED-tier operation that requires step-up authentication (CIBA mobile push).');
  }

  lines.push('\nShall I proceed?');

  return lines.join('\n');
}
