'use client';

import { useState, useEffect } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Activity,
  RefreshCw,
  GitBranch,
  Mail,
  MessageSquare,
  Globe,
  CheckCircle2,
  XCircle,
  Timer,
  Zap,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

import type { ConnectedAccount } from '@/lib/actions/profile';
import type { AuditEntry } from '@/lib/actions/audit';

// --- Service icon/color mapping (mirrors dashboard-content.tsx) ---

interface ServiceMeta {
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

const SERVICE_MAP: Record<string, ServiceMeta> = {
  'google-oauth2': {
    label: 'Google',
    icon: <Mail className="h-5 w-5" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  github: {
    label: 'GitHub',
    icon: <GitBranch className="h-5 w-5" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  'sign-in-with-slack': {
    label: 'Slack',
    icon: <MessageSquare className="h-5 w-5" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  slack: {
    label: 'Slack',
    icon: <MessageSquare className="h-5 w-5" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  auth0: {
    label: 'Auth0',
    icon: <Shield className="h-5 w-5" />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  ciba: {
    label: 'Step-Up Auth',
    icon: <ShieldCheck className="h-5 w-5" />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
  },
};

function getServiceMeta(connection: string): ServiceMeta {
  return (
    SERVICE_MAP[connection] || {
      label: connection,
      icon: <Globe className="h-5 w-5" />,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
    }
  );
}

// --- Token status derivation ---

type TokenStatus = 'active' | 'expiring-soon' | 'expired' | 'not-connected';

function getTokenStatus(account: ConnectedAccount): TokenStatus {
  if (!account.expires_at) return 'active'; // No expiry means long-lived token
  const now = Date.now();
  const expiresAt = new Date(account.expires_at).getTime();
  if (expiresAt <= now) return 'expired';
  const totalLifetime = expiresAt - new Date(account.created_at).getTime();
  const remaining = expiresAt - now;
  const percentRemaining = totalLifetime > 0 ? (remaining / totalLifetime) * 100 : 0;
  if (percentRemaining <= 10) return 'expiring-soon';
  return 'active';
}

function getLifetimePercent(account: ConnectedAccount): number {
  if (!account.expires_at) return 50; // No expiry, show midpoint
  const now = Date.now();
  const createdAt = new Date(account.created_at).getTime();
  const expiresAt = new Date(account.expires_at).getTime();
  const totalLifetime = expiresAt - createdAt;
  if (totalLifetime <= 0) return 100;
  const elapsed = now - createdAt;
  const percent = (elapsed / totalLifetime) * 100;
  return Math.max(0, Math.min(100, percent));
}

function getRemainingPercent(account: ConnectedAccount): number {
  return Math.max(0, 100 - getLifetimePercent(account));
}

function getProgressColor(remaining: number): string {
  if (remaining > 50) return 'bg-emerald-400';
  if (remaining >= 10) return 'bg-amber-400';
  return 'bg-red-400';
}

function getProgressGlow(remaining: number): string {
  if (remaining > 50) return 'shadow-emerald-400/30';
  if (remaining >= 10) return 'shadow-amber-400/30';
  return 'shadow-red-400/30';
}

const STATUS_STYLES: Record<TokenStatus, { label: string; className: string }> = {
  active: {
    label: 'Active',
    className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  'expiring-soon': {
    label: 'Expiring Soon',
    className: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  expired: {
    label: 'Expired',
    className: 'bg-red-500/20 text-red-300 border-red-500/30',
  },
  'not-connected': {
    label: 'Not Connected',
    className: 'bg-white/10 text-white/40 border-white/20',
  },
};

// --- Format remaining time ---

function formatTimeRemaining(account: ConnectedAccount): string {
  if (!account.expires_at) return 'No expiry set';
  const expiresAt = new Date(account.expires_at);
  const now = new Date();
  if (expiresAt <= now) return 'Expired';
  return formatDistanceToNow(expiresAt, { addSuffix: false }) + ' remaining';
}

// --- Credential context label ---

function formatCredentialContext(context: string): { label: string; icon: React.ReactNode } {
  switch (context) {
    case 'thread':
      return { label: 'Thread', icon: <Activity className="h-3 w-3" /> };
    case 'tool-call':
      return { label: 'Tool Call', icon: <Zap className="h-3 w-3" /> };
    default:
      return { label: context || 'Default', icon: <Shield className="h-3 w-3" /> };
  }
}

// --- Component ---

interface TokenLifecycleProps {
  connectedAccounts: ConnectedAccount[];
  auditEntries: AuditEntry[];
}

export default function TokenLifecycle({
  connectedAccounts,
  auditEntries,
}: TokenLifecycleProps) {
  // Re-render every 30 seconds to update countdown timers
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(interval);
  }, []);

  // Count API calls per connection from audit trail
  function getCallCount(connection: string): number {
    return auditEntries.filter((e) => e.connection === connection).length;
  }

  // Find the most-used credential context for a connection
  function getPrimaryCredentialContext(connection: string): string {
    const entries = auditEntries.filter((e) => e.connection === connection);
    if (entries.length === 0) return '';
    const counts = new Map<string, number>();
    for (const entry of entries) {
      const ctx = entry.credentialsContext || 'default';
      counts.set(ctx, (counts.get(ctx) || 0) + 1);
    }
    let maxCtx = '';
    let maxCount = 0;
    for (const [ctx, count] of counts) {
      if (count > maxCount) {
        maxCtx = ctx;
        maxCount = count;
      }
    }
    return maxCtx;
  }

  // Determine if token rotation is available (refresh tokens from OAuth providers)
  function hasTokenRotation(account: ConnectedAccount): boolean {
    // OAuth2 providers with refresh token support
    const rotationProviders = ['google-oauth2', 'github', 'sign-in-with-slack', 'slack'];
    return rotationProviders.includes(account.connection);
  }

  if (connectedAccounts.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Timer className="h-5 w-5 text-white/80" />
          <h2 className="text-lg font-semibold text-white">Token Lifecycle</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-3 rounded-full bg-white/5 mb-4">
            <Clock className="h-8 w-8 text-white/20" />
          </div>
          <p className="text-white/40 text-sm mb-1">No connected accounts</p>
          <p className="text-white/30 text-xs max-w-[260px]">
            Connect a service through the AI agent to see token lifecycle tracking here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-white/80" />
          <h2 className="text-lg font-semibold text-white">Token Lifecycle</h2>
        </div>
        <span className="text-xs text-white/40">
          {connectedAccounts.length} token{connectedAccounts.length !== 1 ? 's' : ''} tracked
        </span>
      </div>

      <div className="space-y-5">
        {connectedAccounts.map((account) => {
          const meta = getServiceMeta(account.connection);
          const status = getTokenStatus(account);
          const statusStyle = STATUS_STYLES[status];
          const remainingPct = getRemainingPercent(account);
          const consumedPct = getLifetimePercent(account);
          const progressColor = getProgressColor(remainingPct);
          const progressGlow = getProgressGlow(remainingPct);
          const callCount = getCallCount(account.connection);
          const credCtx = getPrimaryCredentialContext(account.connection);
          const credMeta = formatCredentialContext(credCtx);
          const rotation = hasTokenRotation(account);

          return (
            <div
              key={account.id}
              className={`p-4 rounded-lg border transition-colors ${meta.bgColor} ${meta.borderColor}`}
            >
              {/* Row 1: Name, icon, status badge */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${meta.bgColor} ${meta.color}`}>
                    {meta.icon}
                  </div>
                  <div>
                    <span className="text-sm font-medium text-white">{meta.label}</span>
                  </div>
                </div>
                <span
                  className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-medium ${statusStyle.className}`}
                >
                  {status === 'active' && <CheckCircle2 className="h-3 w-3" />}
                  {status === 'expiring-soon' && <ShieldAlert className="h-3 w-3" />}
                  {status === 'expired' && <XCircle className="h-3 w-3" />}
                  {status === 'not-connected' && <Clock className="h-3 w-3" />}
                  {statusStyle.label}
                </span>
              </div>

              {/* Row 2: Token timestamps */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3 text-xs">
                <div>
                  <span className="text-white/40 block mb-0.5">Created</span>
                  <span className="text-white/70">
                    {account.created_at
                      ? format(new Date(account.created_at), 'MMM d, HH:mm')
                      : 'N/A'}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block mb-0.5">Expires</span>
                  <span className="text-white/70">
                    {account.expires_at
                      ? format(new Date(account.expires_at), 'MMM d, HH:mm')
                      : 'No expiry'}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block mb-0.5">Time Remaining</span>
                  <span className={`font-medium ${
                    status === 'expired' ? 'text-red-400' :
                    status === 'expiring-soon' ? 'text-amber-400' :
                    'text-emerald-400'
                  }`}>
                    {formatTimeRemaining(account)}
                  </span>
                </div>
                <div>
                  <span className="text-white/40 block mb-0.5">API Calls</span>
                  <span className="text-white/70 font-mono">{callCount}</span>
                </div>
              </div>

              {/* Row 3: Visual timeline progress bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between text-[10px] text-white/40 mb-1.5">
                  <span>Created</span>
                  <span>Current</span>
                  <span>Expiry</span>
                </div>
                <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`absolute left-0 top-0 h-full rounded-full transition-all duration-500 ${progressColor} shadow-sm ${progressGlow}`}
                    style={{ width: `${Math.min(consumedPct, 100)}%` }}
                  />
                  {/* Current position marker */}
                  {account.expires_at && consumedPct < 100 && (
                    <div
                      className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white border-2 border-current shadow-md transition-all duration-500"
                      style={{
                        left: `calc(${Math.min(consumedPct, 100)}% - 6px)`,
                        borderColor: remainingPct > 50 ? '#34d399' : remainingPct >= 10 ? '#fbbf24' : '#f87171',
                      }}
                    />
                  )}
                </div>
                {account.expires_at && (
                  <div className="flex justify-end mt-1">
                    <span className="text-[10px] text-white/30">
                      {Math.round(consumedPct)}% consumed
                    </span>
                  </div>
                )}
              </div>

              {/* Row 4: Context + Rotation status */}
              <div className="flex items-center gap-4 flex-wrap">
                {credCtx && (
                  <div className="flex items-center gap-1.5 text-xs text-white/50">
                    {credMeta.icon}
                    <span>Context: <span className="text-white/70">{credMeta.label}</span></span>
                  </div>
                )}
                <div className="flex items-center gap-1.5 text-xs">
                  <RefreshCw className={`h-3 w-3 ${rotation ? 'text-emerald-400' : 'text-white/30'}`} />
                  <span className={rotation ? 'text-emerald-400' : 'text-white/40'}>
                    Token Rotation: {rotation ? 'Auto' : 'Manual'}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
