'use client';

import { useState, type ReactNode } from 'react';
import { Shield, ShieldAlert, ShieldCheck, ToggleLeft, ToggleRight } from 'lucide-react';
import { AGENT_PROFILES, type AgentProfile } from '@/lib/agents';
import { ChatWindow } from '@/components/chat-window';
import { cn } from '@/utils/cn';

const RISK_CONFIG: Record<AgentProfile['riskLevel'], { border: string; bg: string; text: string; badge: string; icon: typeof Shield }> = {
  low: { border: 'border-green-500/40', bg: 'bg-green-500/10', text: 'text-green-300', badge: 'bg-green-500/20 text-green-300', icon: ShieldCheck },
  medium: { border: 'border-amber-500/40', bg: 'bg-amber-500/10', text: 'text-amber-300', badge: 'bg-amber-500/20 text-amber-300', icon: Shield },
  high: { border: 'border-red-500/40', bg: 'bg-red-500/10', text: 'text-red-300', badge: 'bg-red-500/20 text-red-300', icon: ShieldAlert },
};

function AgentCard({ profile, selected, onSelect }: { profile: AgentProfile; selected: boolean; onSelect: () => void }) {
  const risk = RISK_CONFIG[profile.riskLevel];
  const RiskIcon = risk.icon;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex flex-col gap-2 p-3 md:p-4 rounded-lg border transition-all text-left cursor-pointer min-h-[44px]',
        selected
          ? `${risk.border} ${risk.bg} ring-1 ring-white/20`
          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-xl">{profile.icon}</span>
        <span className="font-medium text-sm text-white">{profile.name}</span>
        <span className={cn('ml-auto text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider', risk.badge)}>
          <RiskIcon className="w-3 h-3 inline mr-0.5 -mt-0.5" />
          {profile.riskLevel}
        </span>
      </div>
      <p className="text-xs text-white/50 leading-relaxed">{profile.description}</p>
      <div className="flex flex-wrap gap-1 mt-1">
        {profile.tools.map((t) => (
          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10">
            {t.replace(/Tool$/, '')}
          </span>
        ))}
      </div>
    </button>
  );
}

function ModeToggle({ strictMode, onToggle }: { strictMode: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 rounded-lg border transition-all cursor-pointer min-h-[44px] w-full',
        strictMode
          ? 'border-amber-500/40 bg-amber-500/10'
          : 'border-cyan-500/40 bg-cyan-500/10',
      )}
    >
      {strictMode ? (
        <ToggleRight className="w-5 h-5 text-amber-400 shrink-0" />
      ) : (
        <ToggleLeft className="w-5 h-5 text-cyan-400 shrink-0" />
      )}
      <div className="flex flex-col text-left min-w-0">
        <span className={cn('text-xs font-medium', strictMode ? 'text-amber-300' : 'text-cyan-300')}>
          {strictMode ? 'Strict Isolation Mode' : 'Progressive Mode'}
        </span>
        <span className="text-[10px] text-white/40 hidden sm:block">
          {strictMode
            ? 'Separate agents with hard credential boundaries'
            : 'Unified agent, scopes requested progressively as needed'}
        </span>
      </div>
    </button>
  );
}

export function AgentSelector({ userName, infoCard }: { userName: string; infoCard: ReactNode }) {
  const [strictMode, setStrictMode] = useState(false);
  const [agentId, setAgentId] = useState<string>('reader');

  // Progressive mode: agentId is null (all tools available, filtered only by preset)
  // Strict isolation mode: agentId selects a specific agent
  const effectiveAgentId = strictMode ? agentId : undefined;
  const effectiveEmoji = strictMode
    ? (AGENT_PROFILES.find((a) => a.id === agentId)?.icon ?? '🔒')
    : '🔐';

  return (
    <ChatWindow
      endpoint="api/chat"
      emoji={effectiveEmoji}
      agentId={effectiveAgentId}
      userName={userName}
      strictMode={strictMode}
      placeholder={
        strictMode
          ? `Say 'triage my inbox' — I'll categorize your emails and suggest actions across Gmail, Calendar, and Tasks.`
          : `Ask me anything — I'll request each permission as needed. Try 'triage my inbox' to see progressive authorization.`
      }
      emptyStateComponent={
        <div className="flex flex-col gap-4 md:gap-6 max-w-[768px] mx-auto px-3 md:px-0">
          {infoCard}
          <div className="px-0 md:px-2">
            <ModeToggle strictMode={strictMode} onToggle={() => setStrictMode((v) => !v)} />
            {strictMode && (
              <div className="mt-4">
                <h3 className="text-sm font-medium text-white/60 mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Select an agent — each has isolated credential boundaries
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {AGENT_PROFILES.map((profile) => (
                    <AgentCard key={profile.id} profile={profile} selected={agentId === profile.id} onSelect={() => setAgentId(profile.id)} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      }
    />
  );
}
