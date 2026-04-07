'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Timer,
  Shield,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  XCircle,
  Clock,
  Loader2,
  Mail,
  GitBranch,
  MessageSquare,
  Globe,
} from 'lucide-react';

// --- Service metadata (mirrors dashboard-content.tsx) ---

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
    icon: <Mail className="h-4 w-4" />,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
  },
  github: {
    label: 'GitHub',
    icon: <GitBranch className="h-4 w-4" />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
  'sign-in-with-slack': {
    label: 'Slack',
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  slack: {
    label: 'Slack',
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
  },
  auth0: {
    label: 'Auth0',
    icon: <Shield className="h-4 w-4" />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/10',
    borderColor: 'border-orange-500/30',
  },
  ciba: {
    label: 'Step-Up Auth',
    icon: <ShieldCheck className="h-4 w-4" />,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-500/10',
    borderColor: 'border-cyan-500/30',
  },
};

function getServiceMeta(connection: string): ServiceMeta {
  return (
    SERVICE_MAP[connection] || {
      label: connection,
      icon: <Globe className="h-4 w-4" />,
      color: 'text-blue-400',
      bgColor: 'bg-blue-500/10',
      borderColor: 'border-blue-500/30',
    }
  );
}

// --- Types ---

interface GrantWithCountdown {
  connection: string;
  scopes: string[];
  grantedAt: number;
  expiresAt: number;
  expired: boolean;
  remaining: number;
  totalTtl: number;
}

// --- Helpers ---

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getProgressColor(remaining: number, totalTtl: number): string {
  if (totalTtl <= 0) return 'bg-white/20';
  const ratio = remaining / totalTtl;
  if (ratio > 0.5) return 'bg-emerald-400';
  if (ratio > 0.2) return 'bg-amber-400';
  return 'bg-red-400';
}

function getProgressGlow(remaining: number, totalTtl: number): string {
  if (totalTtl <= 0) return '';
  const ratio = remaining / totalTtl;
  if (ratio > 0.5) return 'shadow-emerald-400/30 shadow-sm';
  if (ratio > 0.2) return 'shadow-amber-400/30 shadow-sm';
  return 'shadow-red-400/40 shadow-md';
}

function getRiskBadge(totalTtl: number): { label: string; className: string } {
  // Derive risk level from TTL duration
  if (totalTtl >= 25 * 60 * 1000) {
    return { label: 'GREEN', className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
  }
  if (totalTtl >= 8 * 60 * 1000) {
    return { label: 'AMBER', className: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
  }
  return { label: 'RED', className: 'bg-red-500/20 text-red-300 border-red-500/30' };
}

// --- Component ---

export default function ScopeExpiry() {
  const [grants, setGrants] = useState<GrantWithCountdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchGrants = useCallback(async () => {
    try {
      const res = await fetch('/api/scope-grants');
      if (!res.ok) return;
      const data = await res.json();
      setGrants(data.grants ?? []);
    } catch {
      // Silently continue — dashboard will show empty state
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + polling every 5 seconds for live countdown
  useEffect(() => {
    fetchGrants();
    const interval = setInterval(fetchGrants, 5000);
    return () => clearInterval(interval);
  }, [fetchGrants]);

  // Client-side countdown tick every second for smooth countdowns
  useEffect(() => {
    const tick = setInterval(() => {
      setGrants((prev) =>
        prev.map((g) => {
          const remaining = Math.max(0, g.expiresAt - Date.now());
          return {
            ...g,
            remaining,
            expired: remaining <= 0 ? true : g.expired,
          };
        }),
      );
    }, 1000);
    return () => clearInterval(tick);
  }, []);

  const handleRevoke = async (connection: string) => {
    setActionLoading(connection);
    try {
      await fetch('/api/scope-grants', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection }),
      });
      await fetchGrants();
    } catch {
      // Fetch again to get current state
      await fetchGrants();
    } finally {
      setActionLoading(null);
    }
  };

  const handleRenew = async (connection: string) => {
    setActionLoading(connection);
    try {
      const grant = grants.find((g) => g.connection === connection);
      const risk = grant ? getRiskBadge(grant.totalTtl).label : 'GREEN';
      await fetch('/api/scope-grants', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection, riskLevel: risk }),
      });
      await fetchGrants();
    } catch {
      await fetchGrants();
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-6">
        <div className="flex items-center gap-2 mb-6">
          <Timer className="h-5 w-5 text-white/80" />
          <h2 className="text-lg font-semibold text-white">Scope Expiry</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      </div>
    );
  }

  const activeGrants = grants.filter((g) => !g.expired);
  const expiredGrants = grants.filter((g) => g.expired);

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-white/80" />
          <h2 className="text-lg font-semibold text-white">Scope Expiry</h2>
        </div>
        {grants.length > 0 && (
          <span className="text-xs text-white/40">
            {activeGrants.length} active, {expiredGrants.length} expired
          </span>
        )}
      </div>

      {grants.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-3 rounded-full bg-white/5 mb-4">
            <Clock className="h-8 w-8 text-white/20" />
          </div>
          <p className="text-white/40 text-sm mb-1">No scope grants yet</p>
          <p className="text-white/30 text-xs max-w-[280px]">
            When the AI agent accesses a service, scope grants with time-to-live
            will appear here with live countdowns.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active grants */}
          {activeGrants.map((grant) => {
            const meta = getServiceMeta(grant.connection);
            const risk = getRiskBadge(grant.totalTtl);
            const progressPercent = grant.totalTtl > 0
              ? (grant.remaining / grant.totalTtl) * 100
              : 0;
            const progressColor = getProgressColor(grant.remaining, grant.totalTtl);
            const progressGlow = getProgressGlow(grant.remaining, grant.totalTtl);
            const isActioning = actionLoading === grant.connection;

            return (
              <div
                key={grant.connection}
                className={`p-4 rounded-lg border transition-colors ${meta.bgColor} ${meta.borderColor}`}
              >
                {/* Header row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-1.5 rounded-lg ${meta.bgColor} ${meta.color}`}>
                      {meta.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{meta.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${risk.className}`}>
                          {risk.label}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Time remaining */}
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-white/50" />
                    <span className="text-sm font-mono text-white/80 tabular-nums">
                      {formatTimeRemaining(grant.remaining)}
                    </span>
                  </div>
                </div>

                {/* Scopes */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {grant.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="text-[10px] px-1.5 py-0.5 rounded border bg-white/5 border-white/10 text-white/60"
                    >
                      {scope}
                    </span>
                  ))}
                </div>

                {/* Progress bar */}
                <div className="relative h-1.5 bg-white/10 rounded-full overflow-hidden mb-3">
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-linear ${progressColor} ${progressGlow}`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRenew(grant.connection)}
                    disabled={isActioning}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-emerald-400 hover:text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 rounded-md border border-emerald-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isActioning ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                    Renew
                  </button>
                  <button
                    onClick={() => handleRevoke(grant.connection)}
                    disabled={isActioning}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-md border border-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isActioning ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <XCircle className="h-3 w-3" />
                    )}
                    Revoke Now
                  </button>
                </div>
              </div>
            );
          })}

          {/* Expired grants */}
          {expiredGrants.map((grant) => {
            const meta = getServiceMeta(grant.connection);

            return (
              <div
                key={grant.connection}
                className="p-4 rounded-lg border bg-white/5 border-white/10 opacity-60"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-white/5 text-white/30">
                      {meta.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white/50 line-through">
                          {meta.label}
                        </span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border bg-white/5 border-white/10 text-white/40 font-medium">
                          EXPIRED
                        </span>
                      </div>
                    </div>
                  </div>
                  <ShieldAlert className="h-4 w-4 text-white/30" />
                </div>

                <div className="flex flex-wrap gap-1.5 mb-2">
                  {grant.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="text-[10px] px-1.5 py-0.5 rounded border bg-white/5 border-white/10 text-white/30 line-through"
                    >
                      {scope}
                    </span>
                  ))}
                </div>

                {/* Dead progress bar */}
                <div className="h-1.5 bg-white/5 rounded-full mb-2" />

                <p className="text-[10px] text-white/30 italic">
                  Expired — re-authorization required
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
