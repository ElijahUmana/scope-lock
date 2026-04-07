'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  Hash,
  Link2,
  Loader2,
  GitBranch,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// --- Types matching agent-orchestrator.ts ---

interface DelegationRequest {
  id: string;
  fromAgent: string;
  toAgent: string;
  reason: string;
  toolsRequested: string[];
  riskEscalation: { from: string; to: string };
  timestamp: number;
  hash: string;
  status: 'pending' | 'approved' | 'denied';
}

interface AgentSession {
  agentId: string;
  userId: string;
  startedAt: number;
  toolCallCount: number;
  delegationChain: DelegationRequest[];
  scopeGrants: string[];
}

// --- Agent visual metadata ---

interface AgentMeta {
  name: string;
  icon: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  riskLabel: string;
}

const AGENT_META: Record<string, AgentMeta> = {
  reader: {
    name: 'Reader Agent',
    icon: '\u{1F4D6}',
    colorClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    riskLabel: 'LOW',
  },
  writer: {
    name: 'Writer Agent',
    icon: '\u{270D}\u{FE0F}',
    colorClass: 'text-amber-400',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    riskLabel: 'MEDIUM',
  },
  commerce: {
    name: 'Commerce Agent',
    icon: '\u{1F6D2}',
    colorClass: 'text-red-400',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    riskLabel: 'HIGH',
  },
};

function getAgentMeta(agentId: string): AgentMeta {
  return (
    AGENT_META[agentId] ?? {
      name: agentId,
      icon: '\u{1F916}',
      colorClass: 'text-blue-400',
      bgClass: 'bg-blue-500/10',
      borderClass: 'border-blue-500/30',
      riskLabel: 'UNKNOWN',
    }
  );
}

// --- Risk escalation badge ---

function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    low: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    medium: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    high: 'bg-red-500/20 text-red-300 border-red-500/30',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-medium uppercase tracking-wider ${
        styles[level] ?? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
      }`}
    >
      {level === 'low' && <ShieldCheck className="h-2.5 w-2.5" />}
      {level === 'medium' && <Shield className="h-2.5 w-2.5" />}
      {level === 'high' && <ShieldAlert className="h-2.5 w-2.5" />}
      {level}
    </span>
  );
}

// --- Status badge ---

function StatusBadge({ status }: { status: DelegationRequest['status'] }) {
  if (status === 'approved') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium uppercase tracking-wider">
        <CheckCircle2 className="h-2.5 w-2.5" />
        approved
      </span>
    );
  }
  if (status === 'denied') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30 font-medium uppercase tracking-wider">
        <XCircle className="h-2.5 w-2.5" />
        denied
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-medium uppercase tracking-wider">
      <Clock className="h-2.5 w-2.5" />
      pending
    </span>
  );
}

// --- Agent node ---

function AgentNode({ agentId }: { agentId: string }) {
  const meta = getAgentMeta(agentId);
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${meta.bgClass} ${meta.borderClass}`}
    >
      <span className="text-lg">{meta.icon}</span>
      <div className="flex flex-col">
        <span className={`text-xs font-semibold ${meta.colorClass}`}>
          {meta.name}
        </span>
        <span className="text-[10px] text-white/40">{meta.riskLabel} risk</span>
      </div>
    </div>
  );
}

// --- Single delegation card ---

function DelegationCard({ delegation }: { delegation: DelegationRequest }) {
  const fromMeta = getAgentMeta(delegation.fromAgent);
  const toMeta = getAgentMeta(delegation.toAgent);
  const truncatedHash = delegation.hash.slice(0, 8);

  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors">
      {/* Flow: From -> To */}
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <AgentNode agentId={delegation.fromAgent} />

        {/* Arrow with hash */}
        <div className="flex flex-col items-center gap-0.5">
          <div className="flex items-center gap-1">
            <div className={`h-px w-6 ${fromMeta.bgClass.replace('/10', '/40')}`} />
            <ArrowRight className="h-3.5 w-3.5 text-white/40" />
            <div className={`h-px w-6 ${toMeta.bgClass.replace('/10', '/40')}`} />
          </div>
          <span className="flex items-center gap-0.5 text-[9px] text-white/30 font-mono">
            <Hash className="h-2.5 w-2.5" />
            {truncatedHash}
          </span>
        </div>

        <AgentNode agentId={delegation.toAgent} />
      </div>

      {/* Details */}
      <div className="space-y-2">
        {/* Reason */}
        <div className="text-xs text-white/60">
          <span className="text-white/40">reason: </span>
          {delegation.reason}
        </div>

        {/* Tools requested */}
        <div className="flex flex-wrap gap-1">
          {delegation.toolsRequested.map((tool) => (
            <span
              key={tool}
              className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/60 font-mono"
            >
              {tool}
            </span>
          ))}
        </div>

        {/* Bottom row: risk escalation, status, timestamp */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-1">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <RiskBadge level={delegation.riskEscalation.from} />
              <ArrowRight className="h-2.5 w-2.5 text-white/30" />
              <RiskBadge level={delegation.riskEscalation.to} />
            </div>
            <StatusBadge status={delegation.status} />
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-white/35">
            <Clock className="h-2.5 w-2.5" />
            {formatDistanceToNow(new Date(delegation.timestamp), {
              addSuffix: true,
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Compact flow summary ---

function FlowSummary({ chain }: { chain: DelegationRequest[] }) {
  if (chain.length === 0) return null;

  // Build ordered sequence of unique agents from the chain (oldest first)
  const reversed = [...chain].reverse();
  const agents: string[] = [reversed[0].fromAgent];
  for (const d of reversed) {
    if (agents[agents.length - 1] !== d.toAgent) {
      agents.push(d.toAgent);
    }
  }

  // Build hash labels between agents from the chain
  const hashes: string[] = reversed.map((d) => d.hash.slice(0, 4));

  return (
    <div className="flex items-center gap-1.5 flex-wrap mb-4 p-3 rounded-lg bg-white/[0.03] border border-white/5">
      {agents.map((agentId, i) => {
        const meta = getAgentMeta(agentId);
        return (
          <div key={`${agentId}-${i}`} className="flex items-center gap-1.5">
            {i > 0 && (
              <div className="flex items-center gap-1 text-white/30">
                <span className="text-[9px] font-mono text-white/25">
                  SHA:{hashes[i - 1]}
                </span>
                <ArrowRight className="h-3 w-3" />
              </div>
            )}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded border text-xs font-medium ${meta.bgClass} ${meta.borderClass} ${meta.colorClass}`}
            >
              <span>{meta.icon}</span>
              <span>{meta.name}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Main component ---

export default function DelegationChain() {
  const [chain, setChain] = useState<DelegationRequest[]>([]);
  const [session, setSession] = useState<AgentSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchDelegation() {
      try {
        const res = await fetch('/api/delegation');
        if (res.ok) {
          const data = await res.json();
          setChain(data.chain ?? []);
          setSession(data.session ?? null);
        }
      } catch {
        // Silently continue — data will appear on next poll
      } finally {
        setLoading(false);
      }
    }

    fetchDelegation();

    // Poll every 10 seconds to stay in sync with agent switches
    const interval = setInterval(fetchDelegation, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-white/40" />
      </div>
    );
  }

  if (chain.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-3 rounded-full bg-white/5 mb-4">
          <Link2 className="h-8 w-8 text-white/20" />
        </div>
        <p className="text-white/40 text-sm mb-1">
          No delegation events yet
        </p>
        <p className="text-white/30 text-xs max-w-[300px]">
          Switch between agents in the chat to see cryptographic delegation
          chains appear here. Each switch generates a SHA-256 signed handoff.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary stats */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-white/50">
            {chain.filter((d) => d.status === 'approved').length} approved
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="h-2 w-2 rounded-full bg-red-400" />
          <span className="text-white/50">
            {chain.filter((d) => d.status === 'denied').length} denied
          </span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/30">
          {chain.length} total delegation{chain.length !== 1 ? 's' : ''}
        </div>
        {session && (
          <div className="flex items-center gap-2 text-xs text-white/30 ml-auto">
            <span>
              Active: {getAgentMeta(session.agentId).name}
            </span>
            <span className="text-white/20">|</span>
            <span>{session.toolCallCount} tool calls</span>
          </div>
        )}
      </div>

      {/* Flow summary line */}
      <FlowSummary chain={chain} />

      {/* Delegation cards */}
      <div className="space-y-3 max-h-[500px] overflow-y-auto hide-scrollbar">
        {chain.map((delegation) => (
          <DelegationCard key={delegation.id} delegation={delegation} />
        ))}
      </div>
    </div>
  );
}
