'use client';

import { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Zap,
  Lock,
  Eye,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Ban,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { cn } from '@/utils/cn';

// ─── Types ─────────────────────────────────────────────────────────

type ScenarioStatus = 'idle' | 'running' | 'done';

interface ScenarioProps {
  number: string;
  title: string;
  question: string;
  resultVerdict: 'BLOCKED' | 'PROTECTED';
  resultMessage: string;
  children: React.ReactNode;
}

// ─── Flow diagram building blocks ──────────────────────────────────

function FlowArrow() {
  return (
    <div className="flex items-center justify-center px-1 shrink-0">
      <ArrowRight className="w-4 h-4 text-white/30" />
    </div>
  );
}

function FlowNode({
  label,
  sublabel,
  variant = 'default',
}: {
  label: string;
  sublabel?: string;
  variant?: 'default' | 'blocked' | 'safe' | 'highlight';
}) {
  const styles = {
    default: 'border-white/15 bg-white/5 text-white/70',
    blocked: 'border-red-500/30 bg-red-500/10 text-red-300',
    safe: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    highlight: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  };

  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2 text-center min-w-0 shrink-0',
        styles[variant],
      )}
    >
      <div className="text-xs font-medium whitespace-nowrap">{label}</div>
      {sublabel && (
        <div className="text-[10px] opacity-60 mt-0.5 whitespace-nowrap">
          {sublabel}
        </div>
      )}
    </div>
  );
}

function FlowDiagram({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2 px-1">
      {children}
    </div>
  );
}

// ─── Tool list display ─────────────────────────────────────────────

function ToolList({
  title,
  tools,
  variant = 'default',
}: {
  title: string;
  tools: string[];
  variant?: 'default' | 'blocked' | 'safe';
}) {
  const borderColor = {
    default: 'border-white/10',
    blocked: 'border-red-500/20',
    safe: 'border-emerald-500/20',
  };
  const titleColor = {
    default: 'text-white/50',
    blocked: 'text-red-400',
    safe: 'text-emerald-400',
  };

  return (
    <div className={cn('rounded-lg border p-3', borderColor[variant])}>
      <div
        className={cn('text-[10px] uppercase tracking-wider mb-2 font-medium', titleColor[variant])}
      >
        {title}
      </div>
      {tools.length === 0 ? (
        <div className="text-xs text-white/30 italic">No tools available</div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {tools.map((tool) => (
            <span
              key={tool}
              className={cn(
                'text-[10px] px-1.5 py-0.5 rounded border font-mono',
                variant === 'blocked'
                  ? 'bg-red-500/5 border-red-500/20 text-red-300/60 line-through'
                  : variant === 'safe'
                    ? 'bg-emerald-500/5 border-emerald-500/20 text-emerald-300'
                    : 'bg-white/5 border-white/10 text-white/50',
              )}
            >
              {tool.replace(/Tool$/, '')}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Scenario card ─────────────────────────────────────────────────

function ScenarioCard({
  number,
  title,
  question,
  resultVerdict,
  resultMessage,
  children,
}: ScenarioProps) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<ScenarioStatus>('idle');

  function handleSimulate() {
    setExpanded(true);
    setStatus('running');
    // Animate the transition from running to done
    setTimeout(() => setStatus('done'), 800);
  }

  function handleReset() {
    setStatus('idle');
    setExpanded(false);
  }

  const isBlocked = resultVerdict === 'BLOCKED';

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] transition-colors hover:bg-white/[0.04]">
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-start gap-3 p-5 text-left cursor-pointer"
      >
        <span className="shrink-0 text-xs font-mono text-white/30 bg-white/5 rounded px-2 py-0.5 mt-0.5">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-white text-sm mb-1">{title}</h3>
          <p className="text-xs text-white/50 italic">&quot;{question}&quot;</p>
        </div>
        <div className="shrink-0 mt-0.5">
          {expanded ? (
            <ChevronDown className="w-4 h-4 text-white/30" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white/30" />
          )}
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/5 pt-4 space-y-4">
          {/* Simulate button */}
          {status === 'idle' && (
            <button
              type="button"
              onClick={handleSimulate}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-sm font-medium transition-all hover:bg-red-500/20 cursor-pointer"
            >
              <Zap className="w-4 h-4" />
              Simulate Attack
            </button>
          )}

          {/* Running state */}
          {status === 'running' && (
            <div className="flex items-center gap-3 text-sm text-white/60">
              <div className="w-4 h-4 rounded-full border-2 border-red-400 border-t-transparent animate-spin" />
              Simulating attack vector...
            </div>
          )}

          {/* Results */}
          {status === 'done' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              {/* Visual explanation */}
              <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4">
                <div className="text-[10px] uppercase tracking-wider text-white/40 mb-3 font-medium">
                  Attack Trace
                </div>
                {children}
              </div>

              {/* Result card */}
              <div
                className={cn(
                  'rounded-lg border p-4 flex items-start gap-3',
                  isBlocked
                    ? 'border-red-500/30 bg-red-500/5'
                    : 'border-emerald-500/30 bg-emerald-500/5',
                )}
              >
                <div
                  className={cn(
                    'shrink-0 rounded-md p-1.5',
                    isBlocked
                      ? 'bg-red-500/10 text-red-400'
                      : 'bg-emerald-500/10 text-emerald-400',
                  )}
                >
                  {isBlocked ? (
                    <XCircle className="w-5 h-5" />
                  ) : (
                    <CheckCircle2 className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <div
                    className={cn(
                      'text-xs font-bold uppercase tracking-wider mb-1',
                      isBlocked ? 'text-red-400' : 'text-emerald-400',
                    )}
                  >
                    {resultVerdict}
                  </div>
                  <p className="text-sm text-white/70 leading-relaxed">
                    {resultMessage}
                  </p>
                </div>
              </div>

              {/* Reset */}
              <button
                type="button"
                onClick={handleReset}
                className="text-xs text-white/30 hover:text-white/50 transition-colors cursor-pointer"
              >
                Reset simulation
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Scenario data ─────────────────────────────────────────────────

const ALL_TOOLS = [
  'gmailSearchTool',
  'getCalendarEventsTool',
  'getTasksTool',
  'getUserInfoTool',
  'gmailDraftTool',
  'createTasksTool',
  'shopOnlineTool',
];

const READER_TOOLS = ['gmailSearchTool', 'getCalendarEventsTool', 'getTasksTool', 'getUserInfoTool'];
const WRITER_TOOLS = ['gmailDraftTool', 'createTasksTool'];
const WRITE_TOOLS_FULL = ['gmailDraftTool', 'createTasksTool', 'shopOnlineTool'];

const LOCKDOWN_TOOLS: string[] = [];
const PRIVACY_TOOLS = ['gmailSearchTool', 'getCalendarEventsTool', 'getTasksTool', 'getUserInfoTool'];

// ─── Main component ────────────────────────────────────────────────

export default function SandboxContent() {
  return (
    <div className="space-y-4 pb-12">
      {/* Scenario 1: Privilege Escalation */}
      <ScenarioCard
        number="01"
        title="Privilege Escalation"
        question="What happens when the Reader Agent tries to write?"
        resultVerdict="BLOCKED"
        resultMessage="Tool not available to Reader Agent. Credential boundary enforced at API layer, not prompt level."
      >
        <div className="space-y-4">
          <FlowDiagram>
            <FlowNode label="Reader Agent" sublabel="Requests gmailDraft" variant="highlight" />
            <FlowArrow />
            <FlowNode label="Tool Registry" sublabel="Filter by agent.tools" variant="default" />
            <FlowArrow />
            <FlowNode label="gmailDraftTool" sublabel="NOT IN LIST" variant="blocked" />
          </FlowDiagram>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ToolList
              title="Reader Agent tools (available)"
              tools={READER_TOOLS}
              variant="safe"
            />
            <ToolList
              title="Write tools (denied)"
              tools={WRITE_TOOLS_FULL}
              variant="blocked"
            />
          </div>
          <p className="text-xs text-white/40 leading-relaxed">
            The Reader Agent&apos;s tool dictionary only contains read-only tools.
            The LLM literally cannot call <code className="text-orange-400">gmailDraftTool</code> because
            it does not exist in the tools passed to the model invocation.
          </p>
        </div>
      </ScenarioCard>

      {/* Scenario 2: Scope Creep */}
      <ScenarioCard
        number="02"
        title="Scope Creep"
        question="What happens when an agent requests more scopes than its preset allows?"
        resultVerdict="BLOCKED"
        resultMessage="Preset filter removed unauthorized tools before LLM invocation."
      >
        <div className="space-y-4">
          <FlowDiagram>
            <FlowNode label="LLM Request" sublabel="All 7 tools" variant="highlight" />
            <FlowArrow />
            <FlowNode label="Preset Filter" sublabel="Lockdown: 0 allowed" variant="default" />
            <FlowArrow />
            <FlowNode label="Tool Dictionary" sublabel="EMPTY" variant="blocked" />
          </FlowDiagram>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-red-500/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-red-400 mb-2 font-medium flex items-center gap-1.5">
                <ShieldOff className="w-3 h-3" />
                Lockdown
              </div>
              <div className="text-xs text-white/30 italic">0 tools allowed</div>
            </div>
            <div className="rounded-lg border border-emerald-500/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-400 mb-2 font-medium flex items-center gap-1.5">
                <Lock className="w-3 h-3" />
                Privacy
              </div>
              <div className="flex flex-wrap gap-1">
                {PRIVACY_TOOLS.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/5 border border-emerald-500/20 text-emerald-300 font-mono">
                    {t.replace(/Tool$/, '')}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-amber-500/20 p-3">
              <div className="text-[10px] uppercase tracking-wider text-amber-400 mb-2 font-medium flex items-center gap-1.5">
                <Eye className="w-3 h-3" />
                Productivity
              </div>
              <div className="flex flex-wrap gap-1">
                {ALL_TOOLS.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/5 border border-amber-500/20 text-amber-300 font-mono">
                    {t.replace(/Tool$/, '')}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <p className="text-xs text-white/40 leading-relaxed">
            Scope presets act as a second filter layer. Even if an agent profile includes tools,
            the active preset can restrict them further. <code className="text-orange-400">Lockdown</code> reduces
            every agent to zero tools regardless of their profile.
          </p>
        </div>
      </ScenarioCard>

      {/* Scenario 3: Credential Leakage */}
      <ScenarioCard
        number="03"
        title="Credential Leakage"
        question="Can the LLM see raw OAuth tokens?"
        resultVerdict="PROTECTED"
        resultMessage="Tokens managed by Auth0 Token Vault. LLM never receives raw credentials."
      >
        <div className="space-y-4">
          <FlowDiagram>
            <FlowNode label="User" sublabel="Authenticates" variant="highlight" />
            <FlowArrow />
            <FlowNode label="Auth0" sublabel="Issues session" variant="default" />
            <FlowArrow />
            <FlowNode label="Token Vault" sublabel="Stores OAuth tokens" variant="safe" />
            <FlowArrow />
            <FlowNode label="Google API" sublabel="Receives token" variant="default" />
          </FlowDiagram>
          <div className="rounded-lg border border-white/10 p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-wider text-white/40 font-medium">
              credentialsContext lifecycle
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded border border-white/10 p-2.5">
                <div className="text-[10px] text-blue-400 font-medium mb-1">1. Tool invoked</div>
                <div className="text-[10px] text-white/40">
                  Token Vault fetches stored OAuth token for the connection
                </div>
              </div>
              <div className="rounded border border-white/10 p-2.5">
                <div className="text-[10px] text-blue-400 font-medium mb-1">2. API call</div>
                <div className="text-[10px] text-white/40">
                  Token injected into the HTTP request header server-side
                </div>
              </div>
              <div className="rounded border border-white/10 p-2.5">
                <div className="text-[10px] text-blue-400 font-medium mb-1">3. Response</div>
                <div className="text-[10px] text-white/40">
                  LLM receives only the API response body, never the token
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded border border-emerald-500/20 bg-emerald-500/5 p-3">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <p className="text-xs text-white/50 leading-relaxed">
              The LLM context window never contains raw access tokens or refresh tokens.
              Token Vault operates as an opaque credential store — the agent framework
              injects credentials at the HTTP layer, outside the LLM&apos;s visibility.
            </p>
          </div>
        </div>
      </ScenarioCard>

      {/* Scenario 4: Unauthorized Cross-Service Access */}
      <ScenarioCard
        number="04"
        title="Unauthorized Cross-Service Access"
        question="What happens when Writer Agent tries to access Slack?"
        resultVerdict="BLOCKED"
        resultMessage="Writer Agent has no Slack tools. Each agent has isolated service boundaries."
      >
        <div className="space-y-4">
          <FlowDiagram>
            <FlowNode label="Writer Agent" sublabel="Requests Slack" variant="highlight" />
            <FlowArrow />
            <FlowNode label="Tool Registry" sublabel="Filter by agent.tools" variant="default" />
            <FlowArrow />
            <FlowNode label="listSlackChannels" sublabel="NOT IN LIST" variant="blocked" />
          </FlowDiagram>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ToolList
              title="Writer Agent tools (available)"
              tools={WRITER_TOOLS}
              variant="safe"
            />
            <ToolList
              title="Slack tools (denied)"
              tools={['listSlackChannels']}
              variant="blocked"
            />
          </div>
          <div className="rounded-lg border border-white/10 p-4">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-3 font-medium">
              Agent service boundaries
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                <div className="text-[10px] text-emerald-400 font-medium mb-1">Reader Agent</div>
                <div className="text-[10px] text-white/40">Gmail (read), Calendar, Tasks, Profile</div>
              </div>
              <div className="rounded border border-amber-500/20 bg-amber-500/5 p-2.5">
                <div className="text-[10px] text-amber-400 font-medium mb-1">Writer Agent</div>
                <div className="text-[10px] text-white/40">Gmail (draft), Tasks (create)</div>
              </div>
              <div className="rounded border border-red-500/20 bg-red-500/5 p-2.5">
                <div className="text-[10px] text-red-400 font-medium mb-1">Commerce Agent</div>
                <div className="text-[10px] text-white/40">Shop Online (CIBA required)</div>
              </div>
            </div>
          </div>
          <p className="text-xs text-white/40 leading-relaxed">
            Each agent profile defines an explicit tool whitelist. There is no cross-agent tool sharing.
            The Writer Agent can only use <code className="text-orange-400">gmailDraftTool</code> and{' '}
            <code className="text-orange-400">createTasksTool</code>. Slack tools are not registered for any agent.
          </p>
        </div>
      </ScenarioCard>

      {/* Scenario 5: Risk Tier Bypass */}
      <ScenarioCard
        number="05"
        title="Risk Tier Bypass"
        question="What happens with a RED-level action?"
        resultVerdict="PROTECTED"
        resultMessage="RED actions require CIBA step-up authentication on a separate trusted device."
      >
        <div className="space-y-4">
          <FlowDiagram>
            <FlowNode label="shopOnlineTool" sublabel="Invoked" variant="highlight" />
            <FlowArrow />
            <FlowNode label="Policy Engine" sublabel="Classifies RED" variant="blocked" />
            <FlowArrow />
            <FlowNode label="CIBA Flow" sublabel="Push notification" variant="default" />
            <FlowArrow />
            <FlowNode label="User Approves" sublabel="Trusted device" variant="safe" />
          </FlowDiagram>
          <div className="rounded-lg border border-white/10 p-4">
            <div className="text-[10px] uppercase tracking-wider text-white/40 mb-3 font-medium">
              Risk tier classification
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-3 rounded border border-emerald-500/20 bg-emerald-500/5 p-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">GREEN</span>
                  <span className="text-[10px] text-white/40 ml-2">Auto-approve — Read-only operations</span>
                </div>
                <div className="flex gap-1">
                  {['gmailSearch', 'getCalendarEvents', 'getTasks', 'getUserInfo'].map((t) => (
                    <span key={t} className="text-[10px] px-1 py-0.5 rounded bg-emerald-500/5 border border-emerald-500/20 text-emerald-300/60 font-mono hidden md:inline">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 rounded border border-amber-500/20 bg-amber-500/5 p-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">AMBER</span>
                  <span className="text-[10px] text-white/40 ml-2">Warn and proceed — Write operations</span>
                </div>
                <div className="flex gap-1">
                  {['gmailDraft', 'createTasks'].map((t) => (
                    <span key={t} className="text-[10px] px-1 py-0.5 rounded bg-amber-500/5 border border-amber-500/20 text-amber-300/60 font-mono hidden md:inline">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-3 rounded border border-red-500/20 bg-red-500/5 p-2.5">
                <Ban className="w-4 h-4 text-red-400 shrink-0" />
                <div className="flex-1">
                  <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">RED</span>
                  <span className="text-[10px] text-white/40 ml-2">Require step-up auth — Financial transactions</span>
                </div>
                <div className="flex gap-1">
                  <span className="text-[10px] px-1 py-0.5 rounded bg-red-500/5 border border-red-500/20 text-red-300/60 font-mono hidden md:inline">
                    shopOnline
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-start gap-2 rounded border border-red-500/20 bg-red-500/5 p-3">
            <Lock className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <p className="text-xs text-white/50 leading-relaxed">
              The policy engine classifies <code className="text-orange-400">shopOnlineTool</code> as RED.
              This triggers the CIBA (Client Initiated Backchannel Authentication) flow, which sends a
              push notification to the user&apos;s enrolled mobile device via Auth0 Guardian.
              Without explicit approval on a separate trusted device, the action cannot proceed.
            </p>
          </div>
        </div>
      </ScenarioCard>
    </div>
  );
}
