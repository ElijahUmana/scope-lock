import { useId, useState } from 'react';
import { TokenVaultInterrupt } from '@auth0/ai/interrupts';
import type { Auth0InterruptionUI } from '@auth0/ai-vercel';
import { Shield, Lock, AlertTriangle, CheckCircle, ChevronRight, Clock } from 'lucide-react';

import { TokenVaultConsentPopup } from '@/components/auth0-ai/TokenVault/popup';

type PossibleInterrupt = Auth0InterruptionUI | Record<string, unknown>;

interface TokenVaultInterruptHandlerProps {
  interrupt: PossibleInterrupt | undefined | null;
  onFinish?: () => void;
  onCancel?: () => void;
}

type ScopeRisk = 'low' | 'medium' | 'high';

interface ScopeDetail {
  label: string;
  risk: ScopeRisk;
  dataAccess: string;
  detailedAccess?: string;
}

const CONNECTION_INFO: Record<string, { name: string; icon: string; description: string }> = {
  'google-oauth2': { name: 'Google', icon: '🔵', description: 'Access to Google services' },
  'github': { name: 'GitHub', icon: '⚫', description: 'Access to GitHub repositories and activity' },
  'sign-in-with-slack': { name: 'Slack', icon: '🟣', description: 'Access to Slack workspace' },
};

const SCOPE_INFO: Record<string, ScopeDetail> = {
  'https://www.googleapis.com/auth/gmail.readonly': {
    label: 'Gmail Read',
    risk: 'low',
    dataAccess: 'Read your email subjects, senders, and content',
    detailedAccess: 'Subject lines, sender addresses, and email snippets. Full email content is NOT accessed.',
  },
  'https://www.googleapis.com/auth/gmail.compose': {
    label: 'Gmail Write',
    risk: 'medium',
    dataAccess: 'Create and send email drafts on your behalf',
    detailedAccess: 'Ability to create draft emails in your Gmail account.',
  },
  'https://www.googleapis.com/auth/calendar.events': {
    label: 'Calendar',
    risk: 'low',
    dataAccess: 'View your calendar events and schedules',
    detailedAccess: 'Event titles, times, and attendee lists.',
  },
  'https://www.googleapis.com/auth/tasks': {
    label: 'Tasks',
    risk: 'low',
    dataAccess: 'View and create tasks in Google Tasks',
    detailedAccess: 'Task titles, due dates, and completion status.',
  },
  'channels:read': { label: 'Slack Channels', risk: 'low', dataAccess: 'List your Slack channels' },
  'groups:read': { label: 'Slack Groups', risk: 'low', dataAccess: 'List your Slack private groups' },
};

/**
 * Fuzzy-match a scope string against known scope patterns.
 * Handles cases where the Token Vault passes scope URLs that don't exactly
 * match the keys in SCOPE_INFO (e.g. partial URLs, different versions).
 */
function matchScope(scope: string): ScopeDetail | null {
  // Exact match first
  if (SCOPE_INFO[scope]) return SCOPE_INFO[scope];

  const lower = scope.toLowerCase();

  // Hide openid — not user-relevant
  if (lower === 'openid' || lower === 'profile' || lower === 'email') return null;

  // Fuzzy patterns for Google scopes
  if (lower.includes('gmail') && lower.includes('compose')) {
    return SCOPE_INFO['https://www.googleapis.com/auth/gmail.compose'];
  }
  if (lower.includes('gmail.readonly') || (lower.includes('gmail') && lower.includes('read'))) {
    return SCOPE_INFO['https://www.googleapis.com/auth/gmail.readonly'];
  }
  if (lower.includes('calendar')) {
    return SCOPE_INFO['https://www.googleapis.com/auth/calendar.events'];
  }
  if (lower.includes('tasks')) {
    return SCOPE_INFO['https://www.googleapis.com/auth/tasks'];
  }

  return null;
}

const GOOGLE_DEFAULT_SCOPES: ScopeDetail[] = [
  {
    label: 'Google Account — General Access',
    risk: 'low',
    dataAccess: 'View your email address and profile information',
    detailedAccess: 'This is the minimum required to connect your Google account.',
  },
];

function getRiskColor(risk: ScopeRisk) {
  return { low: 'text-green-400 bg-green-500/20 border-green-500/30', medium: 'text-amber-400 bg-amber-500/20 border-amber-500/30', high: 'text-red-400 bg-red-500/20 border-red-500/30' }[risk];
}

function getRiskIcon(risk: ScopeRisk) {
  return { low: <CheckCircle className="w-4 h-4 text-green-400" />, medium: <AlertTriangle className="w-4 h-4 text-amber-400" />, high: <Shield className="w-4 h-4 text-red-400" /> }[risk];
}

function DataAccessSection({ scopes }: { scopes: ScopeDetail[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const detailedScopes = scopes.filter(s => s.detailedAccess);

  if (detailedScopes.length === 0) return null;

  return (
    <div className="px-5 py-2 border-t border-white/5">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-1.5 text-xs text-white/50 hover:text-white/70 transition-colors w-full"
      >
        <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} />
        <span className="font-medium">What data will be accessed?</span>
      </button>
      {isOpen && (
        <div className="mt-2 space-y-1.5 pl-4.5">
          {detailedScopes.map((scope, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className="text-white/70 font-medium shrink-0">{scope.label}:</span>
              <span className="text-white/50">{scope.detailedAccess}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScopeTTLSection({ scopes }: { scopes: ScopeDetail[] }) {
  const hasWrite = scopes.some(s => s.risk === 'medium' || s.risk === 'high');
  const hasRead = scopes.some(s => s.risk === 'low');

  let ttlText: string;
  if (hasWrite && hasRead) {
    ttlText = 'This permission will automatically expire after 30 minutes (read operations) or 10 minutes (write operations).';
  } else if (hasWrite) {
    ttlText = 'This permission will automatically expire after 10 minutes.';
  } else {
    ttlText = 'This permission will automatically expire after 30 minutes.';
  }

  return (
    <div className="px-5 py-2 border-t border-white/5">
      <div className="flex items-start gap-2">
        <Clock className="w-3.5 h-3.5 text-white/40 mt-0.5 shrink-0" />
        <p className="text-xs text-white/40">{ttlText}</p>
      </div>
    </div>
  );
}

export function TokenVaultInterruptHandler({ interrupt, onFinish, onCancel }: TokenVaultInterruptHandlerProps) {
  const id = useId();
  if (!interrupt || !TokenVaultInterrupt.isInterrupt(interrupt)) {
    return null;
  }

  const conn = CONNECTION_INFO[interrupt.connection] ?? { name: interrupt.connection, icon: '🔗', description: 'External service access' };

  // Resolve scopes: fuzzy-match each scope, filter out hidden ones (openid, profile, email)
  const rawScopes = interrupt.requiredScopes ?? [];
  const resolvedScopes: ScopeDetail[] = [];
  for (const s of rawScopes) {
    const matched = matchScope(s);
    if (matched) {
      // Deduplicate by label
      if (!resolvedScopes.some(existing => existing.label === matched.label)) {
        resolvedScopes.push(matched);
      }
    }
  }

  // When scopes are empty (or all filtered) and connection is Google, show default scopes
  const scopeDetails = resolvedScopes.length > 0
    ? resolvedScopes
    : interrupt.connection === 'google-oauth2'
      ? GOOGLE_DEFAULT_SCOPES
      : [{ label: 'General Access', risk: 'low' as const, dataAccess: 'Basic access to this service' }];

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

        {/* Expandable data access details */}
        <DataAccessSection scopes={scopeDetails} />

        {/* Scope TTL */}
        <ScopeTTLSection scopes={scopeDetails} />

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
            onCancel={onCancel}
          />
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="mt-2 text-xs text-white/40 hover:text-white/60 underline underline-offset-2 transition-colors"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
