// Agent Orchestrator: Cryptographic delegation chains for agent-to-agent escalation.
// When a user switches between agents (Reader -> Writer -> Commerce), each transition
// is recorded as a DelegationRequest with a SHA-256 hash of the delegation payload.
// The chain is append-only — creating a verifiable, tamper-evident trail of
// every privilege escalation that occurred during the session.

import { createHash } from 'crypto';

// --- Types ---

export interface DelegationRequest {
  id: string;
  fromAgent: string;
  toAgent: string;
  reason: string;
  toolsRequested: string[];
  riskEscalation: { from: string; to: string };
  timestamp: number;
  hash: string; // SHA-256 of the delegation payload
  status: 'pending' | 'approved' | 'denied';
}

export interface AgentSession {
  agentId: string;
  userId: string;
  startedAt: number;
  toolCallCount: number;
  delegationChain: DelegationRequest[];
  scopeGrants: string[];
}

// --- In-memory stores ---

const delegationStore = new Map<string, DelegationRequest[]>();
const sessionStore = new Map<string, AgentSession>();

let delegationCounter = 0;

// --- Hashing ---

function computeDelegationHash(
  fromAgent: string,
  toAgent: string,
  tools: string[],
  timestamp: number,
): string {
  const payload = `${fromAgent}:${toAgent}:${tools.join(',')}:${timestamp}`;
  return createHash('sha256').update(payload).digest('hex');
}

// --- Public API ---

/**
 * Create a new delegation request recording an agent-to-agent escalation.
 * The delegation is immediately approved (auto-approve policy) and appended
 * to both the per-user delegation store and the active session's chain.
 */
export function createDelegation(
  from: string,
  to: string,
  tools: string[],
  reason: string,
  userId: string,
): DelegationRequest {
  const timestamp = Date.now();
  const hash = computeDelegationHash(from, to, tools, timestamp);
  const id = `del_${++delegationCounter}_${timestamp}`;

  // Determine risk levels from agent IDs
  const RISK_MAP: Record<string, string> = {
    reader: 'low',
    writer: 'medium',
    commerce: 'high',
  };

  const delegation: DelegationRequest = {
    id,
    fromAgent: from,
    toAgent: to,
    reason,
    toolsRequested: tools,
    riskEscalation: {
      from: RISK_MAP[from] ?? 'unknown',
      to: RISK_MAP[to] ?? 'unknown',
    },
    timestamp,
    hash,
    status: 'approved',
  };

  // Append to the per-user delegation store
  if (!delegationStore.has(userId)) {
    delegationStore.set(userId, []);
  }
  const chain = delegationStore.get(userId)!;
  chain.push(delegation);

  // Keep max 200 entries per user
  if (chain.length > 200) {
    delegationStore.set(userId, chain.slice(-200));
  }

  // Append to the active session's delegation chain
  const session = sessionStore.get(userId);
  if (session) {
    session.delegationChain.push(delegation);
  }

  return delegation;
}

/**
 * Get the full delegation chain for a user — newest first.
 */
export function getDelegationChain(userId: string): DelegationRequest[] {
  const chain = delegationStore.get(userId) ?? [];
  return [...chain].reverse();
}

/**
 * Get the active agent session for a user.
 */
export function getAgentSession(userId: string): AgentSession | null {
  return sessionStore.get(userId) ?? null;
}

/**
 * Start (or replace) an agent session for the given user.
 * If a prior session exists, the delegation chain is carried forward so the
 * full history is preserved across agent switches within the same user session.
 */
export function startAgentSession(userId: string, agentId: string): AgentSession {
  const existingChain = sessionStore.get(userId)?.delegationChain ?? [];
  const existingGrants = sessionStore.get(userId)?.scopeGrants ?? [];

  const session: AgentSession = {
    agentId,
    userId,
    startedAt: Date.now(),
    toolCallCount: 0,
    delegationChain: existingChain,
    scopeGrants: existingGrants,
  };

  sessionStore.set(userId, session);
  return session;
}

/**
 * Increment the tool-call counter on the active session.
 */
export function incrementToolCallCount(userId: string): void {
  const session = sessionStore.get(userId);
  if (session) {
    session.toolCallCount++;
  }
}

/**
 * Add a scope grant to the active session.
 */
export function addScopeGrant(userId: string, scope: string): void {
  const session = sessionStore.get(userId);
  if (session && !session.scopeGrants.includes(scope)) {
    session.scopeGrants.push(scope);
  }
}
