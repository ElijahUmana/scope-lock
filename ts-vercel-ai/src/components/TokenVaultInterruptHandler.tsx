import { useId } from 'react';
import { TokenVaultInterrupt } from '@auth0/ai/interrupts';
import type { Auth0InterruptionUI } from '@auth0/ai-vercel';
import { Shield, Lock, AlertTriangle, CheckCircle } from 'lucide-react';

import { TokenVaultConsentPopup } from '@/components/auth0-ai/TokenVault/popup';

type PossibleInterrupt = Auth0InterruptionUI | Record<string, unknown>;

interface TokenVaultInterruptHandlerProps {
  interrupt: PossibleInterrupt | undefined | null;
  onFinish?: () => void;
}

const CONNECTION_INFO: Record<string, { name: string; icon: string; description: string }> = {
  'google-oauth2': { name: 'Google', icon: '🔵', description: 'Access to Google services' },
  'github': { name: 'GitHub', icon: '⚫', description: 'Access to GitHub repositories and activity' },
  'sign-in-with-slack': { name: 'Slack', icon: '🟣', description: 'Access to Slack workspace' },
};

const SCOPE_INFO: Record<string, { label: string; risk: 'low' | 'medium' | 'high'; dataAccess: string }> = {
  'https://www.googleapis.com/auth/gmail.readonly': { label: 'Gmail Read', risk: 'low', dataAccess: 'Read your email subjects, senders, and content' },
  'https://www.googleapis.com/auth/gmail.compose': { label: 'Gmail Write', risk: 'medium', dataAccess: 'Create and send email drafts on your behalf' },
  'https://www.googleapis.com/auth/calendar.events': { label: 'Calendar', risk: 'low', dataAccess: 'View your calendar events and schedules' },
  'https://www.googleapis.com/auth/tasks': { label: 'Tasks', risk: 'low', dataAccess: 'View and create tasks in Google Tasks' },
  'channels:read': { label: 'Slack Channels', risk: 'low', dataAccess: 'List your Slack channels' },
  'groups:read': { label: 'Slack Groups', risk: 'low', dataAccess: 'List your Slack private groups' },
};

function getRiskColor(risk: 'low' | 'medium' | 'high') {
  return { low: 'text-green-400 bg-green-500/20 border-green-500/30', medium: 'text-amber-400 bg-amber-500/20 border-amber-500/30', high: 'text-red-400 bg-red-500/20 border-red-500/30' }[risk];
}

function getRiskIcon(risk: 'low' | 'medium' | 'high') {
  return { low: <CheckCircle className="w-4 h-4 text-green-400" />, medium: <AlertTriangle className="w-4 h-4 text-amber-400" />, high: <Shield className="w-4 h-4 text-red-400" /> }[risk];
}

export function TokenVaultInterruptHandler({ interrupt, onFinish }: TokenVaultInterruptHandlerProps) {
  const id = useId();
  if (!interrupt || !TokenVaultInterrupt.isInterrupt(interrupt)) {
    return null;
  }

  const conn = CONNECTION_INFO[interrupt.connection] ?? { name: interrupt.connection, icon: '🔗', description: 'External service access' };
  const scopeDetails = (interrupt.requiredScopes ?? []).map(s => SCOPE_INFO[s] ?? { label: s.split('/').pop() ?? s, risk: 'medium' as const, dataAccess: 'Access to this service' });
  const maxRisk = scopeDetails.some(s => s.risk === 'high') ? 'high' : scopeDetails.some(s => s.risk === 'medium') ? 'medium' : 'low';

  return (
    <div key={id} className="max-w-lg">
      <div className="border border-white/15 rounded-xl overflow-hidden bg-gradient-to-b from-white/10 to-white/5 shadow-xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-white/10 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Scope Lock — Authorization Request</h3>
            <p className="text-xs text-white/50">The agent needs permission to continue</p>
          </div>
        </div>

        {/* Service */}
        <div className="px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{conn.icon}</span>
            <span className="text-sm font-semibold text-white">{conn.name}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full border ${getRiskColor(maxRisk)}`}>
              {maxRisk === 'low' ? 'Read Only' : maxRisk === 'medium' ? 'Write Access' : 'Elevated'}
            </span>
          </div>
          <p className="text-xs text-white/60">{conn.description}</p>
        </div>

        {/* Scopes */}
        <div className="px-5 py-3 space-y-2">
          <p className="text-xs font-medium text-white/40 uppercase tracking-wider">Requested Permissions</p>
          {scopeDetails.map((scope, i) => (
            <div key={i} className="flex items-start gap-2 py-1.5">
              {getRiskIcon(scope.risk)}
              <div>
                <p className="text-sm text-white">{scope.label}</p>
                <p className="text-xs text-white/50">{scope.dataAccess}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Security note */}
        <div className="px-5 py-3 bg-white/5 border-t border-white/5">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-white/50">
              Credentials are managed by Auth0 Token Vault. The AI agent never sees your raw tokens. You can revoke access anytime from the Dashboard.
            </p>
          </div>
        </div>

        {/* Action */}
        <div className="px-5 py-4 border-t border-white/10">
          <TokenVaultConsentPopup
            interrupt={interrupt}
            connectWidget={{
              title: '',
              description: '',
              action: { label: `Authorize ${conn.name} Access` },
              containerClassName: 'border-0 p-0',
            }}
            onFinish={onFinish}
          />
        </div>
      </div>
    </div>
  );
}
