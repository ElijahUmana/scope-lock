import { NextResponse } from 'next/server';
import { AGENT_PROFILES } from '@/lib/agents';
import { SCOPE_PRESETS } from '@/lib/scope-presets';
import { getPolicyRules, type RiskLevel } from '@/lib/policy-engine';
import { resolveScopes } from '@/lib/scope-resolver';

// Rate limits per agent, mirrored from rate-limiter.ts for introspection.
// Kept in sync manually — the rate-limiter owns the runtime enforcement.
const AGENT_RATE_LIMITS: Record<string, { maxCalls: number; windowMs: number }> = {
  reader: { maxCalls: 50, windowMs: 5 * 60 * 1000 },
  writer: { maxCalls: 15, windowMs: 5 * 60 * 1000 },
  commerce: { maxCalls: 3, windowMs: 5 * 60 * 1000 },
};

export async function GET() {
  const policyRules = getPolicyRules();
  const policyMap = new Map(policyRules.map((r) => [r.toolName, r]));

  const agents = AGENT_PROFILES.map((agent) => {
    // Resolve full scope metadata for this agent's tools
    const scopePlan = resolveScopes(agent.tools);

    // Build per-tool detail with policy cross-reference
    const tools = scopePlan.requirements.map((req) => {
      const policy = policyMap.get(req.toolName);
      return {
        name: req.toolName,
        riskLevel: policy?.level ?? ('AMBER' as RiskLevel),
        connection: req.connection,
        scopes: req.scopes,
        credentialsContext: req.credentialsContext,
        policyAction: policy?.action ?? 'warn-and-proceed',
        reason: req.reason,
      };
    });

    // Compute preset compatibility: intersection of agent tools x preset tools
    const presetCompatibility: Record<string, { availableTools: number; tools: string[] }> = {};
    for (const preset of SCOPE_PRESETS) {
      const intersection = agent.tools.filter((t) => preset.allowedTools.includes(t));
      presetCompatibility[preset.id] = {
        availableTools: intersection.length,
        tools: intersection,
      };
    }

    const rateLimit = AGENT_RATE_LIMITS[agent.id];

    return {
      id: agent.id,
      name: agent.name,
      description: agent.description,
      riskLevel: agent.riskLevel,
      credentialsContext: agent.credentialsContext,
      tools,
      totalScopes: scopePlan.totalScopes,
      maxRiskLevel: scopePlan.maxRiskLevel,
      presetCompatibility,
      rateLimit: rateLimit
        ? { maxCalls: rateLimit.maxCalls, windowSeconds: rateLimit.windowMs / 1000 }
        : null,
      canDelegateTo: agent.canDelegateTo,
      cannotAccess: agent.cannotAccess,
      isolationProof: 'Tools physically excluded from streamText() call — LLM cannot invoke them',
    };
  });

  return NextResponse.json({
    agents,
    isolationMechanism:
      'Object.entries(allTools).filter(([name]) => allowedToolNames.includes(name))',
    securityModel: {
      credentialIsolation:
        'Read ops: thread-scoped. Write ops: per-call isolation.',
      tokenManagement:
        'Auth0 Token Vault — RFC 8693 token exchange. Agent never sees raw tokens.',
      stepUpAuth:
        'RED-level actions require CIBA push notification to mobile device.',
    },
  });
}
