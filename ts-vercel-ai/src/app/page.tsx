import { Shield, Lock, Unlock, ChevronRight, Zap, Eye, ShieldCheck, FlaskConical, BarChart3 } from 'lucide-react';
import { AgentSelector } from '@/components/agent-selector';
import { OnboardingOverlay } from '@/components/onboarding/onboarding-overlay';
import { GuideInfoBox } from '@/components/guide/GuideInfoBox';
import { Button } from '@/components/ui/button';
import { auth0 } from '@/lib/auth0';

const FEATURES = [
  { icon: Shield, title: 'Multi-Agent Isolation', description: 'Reader, Writer, and Commerce agents with isolated credential boundaries. Each agent can ONLY access its authorized tools.', color: 'border-blue-500/30 bg-blue-500/10' },
  { icon: Zap, title: 'Risk-Tier Policy Engine', description: 'GREEN (auto-approve reads), AMBER (warn on writes), RED (require CIBA step-up). Every tool call classified.', color: 'border-amber-500/30 bg-amber-500/10' },
  { icon: Lock, title: 'Scope Presets', description: 'Lockdown (zero tools), Privacy (read-only), Productivity (full access). User controls what the agent can do.', color: 'border-purple-500/30 bg-purple-500/10' },
  { icon: Eye, title: 'Real-Time Audit Trail', description: 'SHA-256 hash-chained audit log. Every API call recorded with scopes, risk level, and credential context.', color: 'border-emerald-500/30 bg-emerald-500/10' },
  { icon: ShieldCheck, title: 'Progressive Authorization', description: 'Zero-trust start. Agent earns each scope individually, explaining what it needs and why.', color: 'border-cyan-500/30 bg-cyan-500/10' },
  { icon: FlaskConical, title: 'Security Sandbox', description: '5 attack simulations with 14 automated assertions. Prove the security model works under adversarial conditions.', color: 'border-red-500/30 bg-red-500/10' },
];

const STEPS = ['Zero Permissions', 'Select Agent', 'Request Action', 'Explain Scope', 'User Approves', 'Execute', 'Audit & Log'];

export default async function Home() {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <div className="min-h-full overflow-y-auto">
        {/* Hero */}
        <div className="flex flex-col items-center justify-center text-center px-4 pt-16 pb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/30 text-green-300 text-xs mb-6">
            <ShieldCheck className="w-3 h-3" />
            Zero-trust authorization for AI agents
          </div>
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-4 tracking-tight">Scope Lock</h1>
          <p className="text-xl md:text-2xl text-white/60 mb-2">AI agents should earn access, not assume it.</p>
          <p className="text-sm text-white/40 max-w-xl mb-8">Progressive authorization for AI agents. Every permission earned. Every action audited. Every credential isolated.</p>
          <div className="flex gap-4">
            <Button asChild size="lg">
              <a href="/auth/login" className="flex items-center gap-2 px-6">
                <Unlock className="w-4 h-4" />
                Try It Now
              </a>
            </Button>
            <Button asChild variant="outline" size="lg">
              <a href="/auth/login?screen_hint=signup" className="flex items-center gap-2 px-6">
                <BarChart3 className="w-4 h-4" />
                View Dashboard
              </a>
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="max-w-5xl mx-auto px-4 pb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {FEATURES.map((f) => (
              <div key={f.title} className={`border rounded-xl p-5 ${f.color} hover:shadow-lg transition-shadow`}>
                <f.icon className="w-6 h-6 text-white/80 mb-3" />
                <h3 className="text-sm font-bold text-white mb-1">{f.title}</h3>
                <p className="text-xs text-white/50">{f.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="max-w-5xl mx-auto px-4 pb-12">
          <h2 className="text-lg font-semibold text-white/80 text-center mb-6">How It Works</h2>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center gap-2">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                  <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center text-xs text-white font-bold">{i + 1}</span>
                  <span className="text-xs text-white/70">{step}</span>
                </div>
                {i < STEPS.length - 1 && <ChevronRight className="w-3 h-3 text-white/20" />}
              </div>
            ))}
          </div>
        </div>

        {/* Tech stack */}
        <div className="flex flex-wrap items-center justify-center gap-2 px-4 pb-16">
          {['Auth0 Token Vault', 'CIBA', 'Next.js', 'Vercel AI SDK', 'GPT-4o', 'TypeScript'].map((t) => (
            <span key={t} className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/50">{t}</span>
          ))}
        </div>
      </div>
    );
  }

  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="text-l">
          <span className="ml-2">
            Select an agent above, choose a scope preset, then start chatting. The agent will request permissions as needed.
          </span>
        </li>
      </ul>
    </GuideInfoBox>
  );

  return (
    <>
      <OnboardingOverlay />
      <AgentSelector userName={session?.user?.name ?? 'there'} infoCard={InfoCard} />
    </>
  );
}
