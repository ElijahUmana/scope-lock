'use client';

import {
  Lightbulb,
  ShieldCheck,
  Layers,
  FileText,
  AlertTriangle,
  MessageSquareWarning,
  Settings2,
  Bug,
  Ban,
  Timer,
  Fingerprint,
  Gavel,
  Rocket,
} from 'lucide-react';

// ─── Section wrapper ────────────────────────────────────────────────

function SectionHeader({ number, title, subtitle }: { number: string; title: string; subtitle: string }) {
  return (
    <div className="mb-4 md:mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span className="text-xs font-mono text-white/40 bg-white/5 rounded px-2 py-0.5 shrink-0">{number}</span>
        <h2 className="text-lg md:text-xl font-semibold text-white">{title}</h2>
      </div>
      <p className="text-sm text-white/50 ml-0 md:ml-12">{subtitle}</p>
    </div>
  );
}

// ─── Card variants ──────────────────────────────────────────────────

interface InsightCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  variant?: 'default' | 'warning' | 'critical';
}

function InsightCard({ icon, title, description, variant = 'default' }: InsightCardProps) {
  const styles = {
    default: {
      border: 'border-emerald-500/20',
      bg: 'bg-emerald-500/5',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-400',
      titleColor: 'text-white',
    },
    warning: {
      border: 'border-amber-500/20',
      bg: 'bg-amber-500/5',
      iconBg: 'bg-amber-500/10',
      iconColor: 'text-amber-400',
      titleColor: 'text-white',
    },
    critical: {
      border: 'border-red-500/20',
      bg: 'bg-red-500/5',
      iconBg: 'bg-red-500/10',
      iconColor: 'text-red-400',
      titleColor: 'text-white',
    },
  };

  const s = styles[variant];

  return (
    <div className={`rounded-lg border ${s.border} ${s.bg} p-5 transition-colors hover:bg-white/[0.04]`}>
      <div className="flex items-start gap-4">
        <div className={`shrink-0 rounded-md p-2 ${s.iconBg} ${s.iconColor}`}>{icon}</div>
        <div className="min-w-0">
          <h3 className={`font-medium ${s.titleColor} mb-1.5 text-sm`}>{title}</h3>
          <p className="text-sm leading-relaxed text-white/60">{description}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Recommendation item ────────────────────────────────────────────

function RecommendationItem({ number, text }: { number: number; text: string }) {
  return (
    <div className="flex items-start gap-4 py-3">
      <span className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full bg-blue-500/10 text-blue-400 text-xs font-mono font-semibold border border-blue-500/20">
        {number}
      </span>
      <p className="text-sm leading-relaxed text-white/70 pt-0.5">{text}</p>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────

export default function InsightsContent() {
  return (
    <div className="space-y-8 md:space-y-12 pb-8 md:pb-12">
      {/* ── Section 1: Patterns Discovered ── */}
      <section>
        <SectionHeader
          number="01"
          title="Patterns Discovered"
          subtitle="Effective approaches that emerged during implementation"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <InsightCard
            icon={<Lightbulb className="h-5 w-5" />}
            title="Progressive Authorization > Upfront Consent"
            description="Requesting scopes incrementally as needed, rather than asking for everything at login, builds user trust and follows least-privilege. Token Vault's interrupt system makes this natural."
          />
          <InsightCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="credentialsContext is the Missing Security Primitive"
            description="The ability to scope credential lifetime to 'tool-call' vs 'thread' vs 'agent' is critical but underdocumented. Write operations MUST use 'tool-call' isolation to prevent credential reuse across invocations."
          />
          <InsightCard
            icon={<Layers className="h-5 w-5" />}
            title="Risk-Tiered Policy Engines"
            description="Not all tool calls are equal. Reads should auto-approve, writes should warn, destructive actions should require step-up auth. This classification should be a first-class feature of agent authorization frameworks."
          />
          <InsightCard
            icon={<FileText className="h-5 w-5" />}
            title="Audit Trails Are Not Optional"
            description="Every credential exchange, every tool call, every scope grant must be logged. Without audit trails, there's no accountability for agent actions."
          />
        </div>
      </section>

      {/* ── Section 2: Pain Points ── */}
      <section>
        <SectionHeader
          number="02"
          title="Pain Points"
          subtitle="Friction encountered during development that slowed progress"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <InsightCard
            variant="warning"
            icon={<Settings2 className="h-5 w-5" />}
            title="Google OAuth Scope Configuration"
            description="Getting the right scopes enabled in Auth0's Google connection, while avoiding the 'invalid_scope' error, required trial-and-error. The mapping between Auth0 scope names and Google's actual API scopes is not always obvious."
          />
          <InsightCard
            variant="warning"
            icon={<MessageSquareWarning className="h-5 w-5" />}
            title="Token Vault Interrupt UX"
            description="The default consent popup is functional but generic. Building a branded, informative consent experience required understanding the interrupt internals (TokenVaultInterrupt, requiredScopes, connection, resume). Better documentation and customization hooks would help."
          />
          <InsightCard
            variant="warning"
            icon={<AlertTriangle className="h-5 w-5" />}
            title="CIBA Channel Configuration"
            description="Setting up Guardian push notifications for CIBA requires multiple steps across different Auth0 dashboard sections. A unified setup wizard would reduce friction significantly."
          />
          <InsightCard
            variant="warning"
            icon={<Bug className="h-5 w-5" />}
            title="Raw API Responses in Chat"
            description="LangChain's Gmail tool returns raw JSON with HTML email bodies. Agent frameworks need a response-sanitization layer between tool output and LLM context to prevent data leakage into the UI."
          />
        </div>
      </section>

      {/* ── Section 3: Gaps Identified ── */}
      <section>
        <SectionHeader
          number="03"
          title="Gaps Identified"
          subtitle="Missing capabilities that would materially improve agent authorization"
        />
        <div className="grid gap-4 md:grid-cols-2">
          <InsightCard
            variant="critical"
            icon={<Ban className="h-5 w-5" />}
            title="No Standard for Agent Audit Trails"
            description="There's no industry standard for logging agent authorization decisions. Each framework rolls its own. Auth0 could define a standard audit event schema."
          />
          <InsightCard
            variant="critical"
            icon={<Timer className="h-5 w-5" />}
            title="No Scope Expiry / Auto-Revocation"
            description="Once a scope is granted via Token Vault, it persists until the user manually revokes it. Time-bound scopes (e.g., 'grant gmail.readonly for 1 hour') would significantly improve security posture."
          />
          <InsightCard
            variant="critical"
            icon={<Fingerprint className="h-5 w-5" />}
            title="No Per-Agent Credential Boundaries in SDK"
            description="The Auth0 AI SDK doesn't natively support isolating credentials per agent in a multi-agent system. credentialsContext helps but operates at the tool level, not the agent level."
          />
          <InsightCard
            variant="critical"
            icon={<Gavel className="h-5 w-5" />}
            title="No Built-in Policy Engine"
            description="Risk classification of tool calls should be a framework feature, not something each developer builds from scratch. A declarative policy DSL would enable standardized security policies across agent applications."
          />
        </div>
      </section>

      {/* ── Section 4: Recommendations for Auth0 ── */}
      <section>
        <SectionHeader
          number="04"
          title="Recommendations for Auth0"
          subtitle="Concrete, actionable improvements for the platform and SDKs"
        />
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-md p-2 bg-blue-500/10 text-blue-400">
              <Rocket className="h-5 w-5" />
            </div>
            <h3 className="font-medium text-white text-sm">Platform & SDK Enhancements</h3>
          </div>
          <div className="divide-y divide-white/5">
            <RecommendationItem
              number={1}
              text="Add a scopeExpiry parameter to withTokenVault for time-bound scopes"
            />
            <RecommendationItem
              number={2}
              text="Add an agentId parameter to credential stores for per-agent isolation"
            />
            <RecommendationItem
              number={3}
              text="Ship a built-in PolicyEngine class in @auth0/ai with configurable risk tiers"
            />
            <RecommendationItem
              number={4}
              text="Define an AuditEvent schema standard for agent authorization logging"
            />
            <RecommendationItem
              number={5}
              text="Add consent card customization hooks to the interrupt system"
            />
            <RecommendationItem
              number={6}
              text="Provide a dashboard widget SDK for embedding scope visualization in any app"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
