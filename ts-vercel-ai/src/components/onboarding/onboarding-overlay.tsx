'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Lock,
  Unlock,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  FileSearch,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';

const STORAGE_KEY = 'scope-lock-onboarding-seen';
const TOTAL_STEPS = 4;

// ─── Step 1: Welcome ────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="flex flex-col items-center text-center gap-6">
      <div className="relative">
        <div className="w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
          <Shield className="w-12 h-12 text-white/80" />
        </div>
        <span className="absolute -bottom-2 -right-2 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-xs font-mono text-white/70">
          0 scopes active
        </span>
      </div>

      <div>
        <h2 className="text-3xl font-bold text-white mb-3">Welcome to Scope Lock</h2>
        <p className="text-base text-white/60 max-w-md leading-relaxed">
          Your AI agent starts with <span className="text-white font-medium">ZERO permissions</span>.
          Every scope is earned, explained, and auditable.
        </p>
      </div>

      <div className="flex gap-4 mt-2">
        {['Read', 'Write', 'Execute'].map((label) => (
          <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
            <Lock className="w-3 h-3 text-white/30" />
            <span className="text-xs text-white/30">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Step 2: Choose Your Agent ──────────────────────────────────────

const AGENTS = [
  {
    icon: '\u{1F4D6}',
    name: 'Reader Agent',
    risk: 'low' as const,
    description: 'Read-only access to Gmail, Calendar, and Tasks. Cannot modify anything.',
    tools: ['Gmail Search', 'Calendar', 'Tasks'],
  },
  {
    icon: '\u{270D}\u{FE0F}',
    name: 'Writer Agent',
    risk: 'medium' as const,
    description: 'Creates drafts and tasks. Each write uses isolated credentials.',
    tools: ['Gmail Draft', 'Create Tasks'],
  },
  {
    icon: '\u{1F6D2}',
    name: 'Commerce Agent',
    risk: 'high' as const,
    description: 'Handles purchases. Every action requires step-up authentication.',
    tools: ['Shop Online'],
  },
];

const RISK_STYLES: Record<'low' | 'medium' | 'high', { border: string; bg: string; text: string; label: string }> = {
  low: { border: 'border-green-500/30', bg: 'bg-green-500/10', text: 'text-green-300', label: 'Low Risk' },
  medium: { border: 'border-amber-500/30', bg: 'bg-amber-500/10', text: 'text-amber-300', label: 'Medium Risk' },
  high: { border: 'border-red-500/30', bg: 'bg-red-500/10', text: 'text-red-300', label: 'High Risk' },
};

function StepAgents() {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Choose Your Agent</h2>
        <p className="text-sm text-white/50">
          Each agent has isolated credential boundaries.
          The Reader Agent literally <span className="text-white font-medium">CANNOT</span> write to your services.
        </p>
      </div>

      <div className="grid gap-3">
        {AGENTS.map((agent) => {
          const style = RISK_STYLES[agent.risk];
          return (
            <div
              key={agent.name}
              className={`flex items-start gap-3 p-3.5 rounded-lg border ${style.border} ${style.bg} transition-colors`}
            >
              <span className="text-xl mt-0.5">{agent.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-white">{agent.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium uppercase tracking-wider ${style.text} bg-white/5 border ${style.border}`}>
                    {style.label}
                  </span>
                </div>
                <p className="text-xs text-white/50 leading-relaxed">{agent.description}</p>
                <div className="flex gap-1.5 mt-2">
                  {agent.tools.map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/10">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Step 3: Progressive Authorization ──────────────────────────────

function AnimatedAuthFlow() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setPhase((p) => (p + 1) % 5);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const phases = [
    { label: 'User asks question', icon: <ArrowRight className="w-4 h-4" />, color: 'text-blue-300', active: phase >= 0 },
    { label: 'Agent explains scope needed', icon: <Shield className="w-4 h-4" />, color: 'text-white/80', active: phase >= 1 },
    { label: 'Branded consent card shown', icon: <Lock className="w-4 h-4" />, color: 'text-amber-300', active: phase >= 2 },
    { label: 'User grants scope', icon: <CheckCircle className="w-4 h-4" />, color: 'text-green-300', active: phase >= 3 },
    { label: 'Scopes bar fills', icon: <Unlock className="w-4 h-4" />, color: 'text-emerald-300', active: phase >= 4 },
  ];

  return (
    <div className="space-y-2">
      {phases.map((p, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-500"
          style={{
            opacity: p.active ? 1 : 0.25,
            transform: p.active ? 'translateX(0)' : 'translateX(-8px)',
          }}
        >
          <div className={`w-7 h-7 rounded-full flex items-center justify-center border transition-all duration-500 ${
            p.active
              ? `${p.color} bg-white/10 border-white/20`
              : 'text-white/20 bg-white/5 border-white/5'
          }`}>
            {p.icon}
          </div>
          <span className={`text-sm transition-colors duration-500 ${p.active ? p.color : 'text-white/20'}`}>
            {p.label}
          </span>
          {i < phases.length - 1 && (
            <ChevronRight className={`w-3 h-3 ml-auto transition-colors duration-500 ${p.active ? 'text-white/30' : 'text-white/10'}`} />
          )}
        </div>
      ))}

      {/* Scope progress bar */}
      <div className="mt-4 mx-3">
        <div className="flex items-center justify-between text-xs text-white/40 mb-1.5">
          <span>Active Scopes</span>
          <span>{Math.min(phase + 1, 5)} / 5</span>
        </div>
        <div className="h-2 rounded-full bg-white/5 border border-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-green-500 via-emerald-400 to-cyan-400 transition-all duration-700 ease-out"
            style={{ width: `${Math.min((phase + 1) * 20, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function StepProgressive() {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Progressive Authorization</h2>
        <p className="text-sm text-white/50 max-w-sm mx-auto">
          Every permission request includes the service, scope, risk level, and data access description.
        </p>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <AnimatedAuthFlow />
      </div>
    </div>
  );
}

// ─── Step 4: Full Transparency ──────────────────────────────────────

function StepTransparency() {
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white mb-2">Full Transparency</h2>
        <p className="text-sm text-white/50 max-w-sm mx-auto">
          Every API call is logged. Every scope decision is tracked.
        </p>
      </div>

      <div className="grid gap-3">
        {/* Dashboard card */}
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-md p-2 bg-emerald-500/10 text-emerald-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white mb-1">Security Dashboard</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Real-time security score, connected accounts with risk levels, full audit trail
                of every authorization decision and tool invocation.
              </p>
              <div className="flex gap-2 mt-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                  Security Score
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                  Audit Trail
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/20">
                  Scope Topology
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Insights card */}
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-md p-2 bg-blue-500/10 text-blue-400">
              <FileSearch className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white mb-1">Insights Page</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Patterns discovered, security gaps identified, and actionable recommendations
                for improving your authorization posture.
              </p>
              <div className="flex gap-2 mt-2">
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20">
                  Patterns
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20">
                  Pain Points
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20">
                  Recommendations
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Policy card */}
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-md p-2 bg-amber-500/10 text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-medium text-white mb-1">Risk-Tiered Policy Engine</h3>
              <p className="text-xs text-white/50 leading-relaxed">
                Reads auto-approve, writes warn, destructive actions require step-up auth.
                Every tool call is classified by risk before execution.
              </p>
              <div className="flex gap-2 mt-2">
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-300 border border-green-500/20">
                  <ShieldCheck className="w-2.5 h-2.5" />Auto-approve
                </span>
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/20">
                  <AlertTriangle className="w-2.5 h-2.5" />Warn
                </span>
                <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-300 border border-red-500/20">
                  <ShieldAlert className="w-2.5 h-2.5" />Step-up Auth
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Progress Dots ──────────────────────────────────────────────────

function ProgressDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current
              ? 'w-6 h-2 bg-white'
              : i < current
                ? 'w-2 h-2 bg-white/50'
                : 'w-2 h-2 bg-white/15'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Button Labels ──────────────────────────────────────────────────

const BUTTON_LABELS = [
  'See How It Works',
  'Next',
  'Next',
  'Start Using Scope Lock',
];

// ─── Main Component ─────────────────────────────────────────────────

export function OnboardingOverlay() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem(STORAGE_KEY);
      if (!seen) {
        setVisible(true);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      try {
        localStorage.setItem(STORAGE_KEY, 'true');
      } catch {
        // localStorage unavailable
      }
    }, 300);
  }, []);

  const advance = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  if (!visible) return null;

  const steps = [<StepWelcome key={0} />, <StepAgents key={1} />, <StepProgressive key={2} />, <StepTransparency key={3} />];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-300 ${
        exiting ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(4px)' }}
    >
      <div
        className={`relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#0d1117] shadow-2xl transition-all duration-300 ${
          exiting ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
        }`}
      >
        {/* Skip button */}
        <button
          onClick={dismiss}
          className="absolute top-4 right-4 text-xs text-white/30 hover:text-white/60 transition-colors z-10"
        >
          Skip
        </button>

        {/* Step content */}
        <div className="px-8 pt-8 pb-4 min-h-[360px] flex items-center">
          <div className="w-full">
            {steps[step]}
          </div>
        </div>

        {/* Footer: progress dots + action button */}
        <div className="px-8 pb-8 flex items-center justify-between">
          <ProgressDots current={step} total={TOTAL_STEPS} />

          <button
            onClick={advance}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white text-black text-sm font-medium hover:bg-white/90 transition-colors"
          >
            {BUTTON_LABELS[step]}
            {step < TOTAL_STEPS - 1 && <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
