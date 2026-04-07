'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  KeyRound,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Loader2,
  AlertTriangle,
} from 'lucide-react';

interface TokenClaims {
  iss: string | null;
  sub: string | null;
  aud: string | string[] | null;
  exp: number | null;
  iat: number | null;
  azp: string | null;
  scope: string | null;
}

interface TokenPresence {
  hasAccessToken: boolean;
  hasRefreshToken: boolean;
  hasIdToken: boolean;
  accessTokenExpiry: number | null;
}

interface TokenInfo {
  claims: TokenClaims;
  tokenPresence: TokenPresence;
}

// --- Claim display helpers ---

const CLAIM_LABELS: Record<string, string> = {
  iss: 'Issuer',
  sub: 'Subject (User ID)',
  aud: 'Audience',
  exp: 'Expires At',
  iat: 'Issued At',
  azp: 'Authorized Party',
  scope: 'Scopes',
};

function formatClaimValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return '\u2014';

  if ((key === 'exp' || key === 'iat') && typeof value === 'number') {
    const date = new Date(value * 1000);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
  }

  if (Array.isArray(value)) {
    return value.join(', ');
  }

  return String(value);
}

// --- Expiry countdown ---

function useExpiryCountdown(exp: number | null): string {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (exp === null) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [exp]);

  if (exp === null) return 'No expiry set';

  const expiresAtMs = exp * 1000;
  const diff = expiresAtMs - now;

  if (diff <= 0) return 'Expired';

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

function ExpiryCountdown({ exp }: { exp: number | null }) {
  const countdown = useExpiryCountdown(exp);

  if (exp === null) {
    return <span className="text-white/40">No expiry set</span>;
  }

  const expiresAtMs = exp * 1000;
  const diff = expiresAtMs - Date.now();
  const isExpired = diff <= 0;
  const isExpiringSoon = !isExpired && diff < 5 * 60 * 1000; // < 5 min

  return (
    <span
      className={`font-mono text-sm font-medium ${
        isExpired
          ? 'text-red-400'
          : isExpiringSoon
          ? 'text-amber-400'
          : 'text-emerald-400'
      }`}
    >
      {countdown}
    </span>
  );
}

// --- Presence indicator ---

function PresenceIndicator({
  label,
  present,
}: {
  label: string;
  present: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      {present ? (
        <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
      ) : (
        <XCircle className="h-4 w-4 text-red-400 flex-shrink-0" />
      )}
      <span className="text-sm text-white/70">{label}</span>
      <span
        className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full border ${
          present
            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
            : 'bg-red-500/20 text-red-300 border-red-500/30'
        }`}
      >
        {present ? 'Present' : 'Absent'}
      </span>
    </div>
  );
}

// --- Main component ---

export default function TokenInspector() {
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTokenInfo = useCallback(async () => {
    try {
      const res = await fetch('/api/token-info');
      if (!res.ok) {
        if (res.status === 401) {
          setError('Not authenticated');
        } else {
          setError(`Failed to fetch token info (${res.status})`);
        }
        return;
      }
      const data: TokenInfo = await res.json();
      setTokenInfo(data);
      setError(null);
    } catch {
      setError('Failed to connect to token info endpoint');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTokenInfo();
  }, [fetchTokenInfo]);

  if (loading) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-6">
        <div className="flex items-center gap-2 mb-6">
          <KeyRound className="h-5 w-5 text-white/80" />
          <h2 className="text-lg font-semibold text-white">JWT Token Inspector</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-white/40" />
        </div>
      </div>
    );
  }

  if (error || !tokenInfo) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-6">
        <div className="flex items-center gap-2 mb-6">
          <KeyRound className="h-5 w-5 text-white/80" />
          <h2 className="text-lg font-semibold text-white">JWT Token Inspector</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-3 rounded-full bg-white/5 mb-4">
            <AlertTriangle className="h-8 w-8 text-white/20" />
          </div>
          <p className="text-white/40 text-sm mb-1">{error || 'No token data available'}</p>
          <p className="text-white/30 text-xs max-w-[260px]">
            Token inspection requires an authenticated session with Auth0.
          </p>
        </div>
      </div>
    );
  }

  const { claims, tokenPresence } = tokenInfo;
  const claimEntries = Object.entries(claims).filter(
    ([, value]) => value !== null,
  );

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-white/80" />
          <h2 className="text-lg font-semibold text-white">JWT Token Inspector</h2>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-white/40">
          <ShieldCheck className="h-3.5 w-3.5" />
          <span>Decoded claims only</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Claims table */}
        <div>
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">
            ID Token Claims
          </h3>

          {claimEntries.length === 0 ? (
            <p className="text-sm text-white/40 italic">No claims available</p>
          ) : (
            <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
              <table className="w-full">
                <tbody className="divide-y divide-white/5">
                  {claimEntries.map(([key, value]) => (
                    <tr key={key} className="hover:bg-white/5 transition-colors">
                      <td className="py-2.5 px-3 text-xs text-white/50 font-medium whitespace-nowrap align-top w-[140px]">
                        <div>
                          <span className="font-mono text-white/40">{key}</span>
                          <span className="block text-[10px] text-white/30 mt-0.5">
                            {CLAIM_LABELS[key] || key}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 text-sm text-white/80 font-mono break-all">
                        {formatClaimValue(key, value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Token presence + expiry countdown */}
        <div className="space-y-6">
          {/* Token presence indicators */}
          <div>
            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">
              Token Presence
            </h3>
            <div className="bg-white/5 rounded-lg border border-white/10 p-4 space-y-3">
              <PresenceIndicator
                label="ID Token"
                present={tokenPresence.hasIdToken}
              />
              <PresenceIndicator
                label="Access Token"
                present={tokenPresence.hasAccessToken}
              />
              <PresenceIndicator
                label="Refresh Token"
                present={tokenPresence.hasRefreshToken}
              />
            </div>
          </div>

          {/* Expiry countdown */}
          <div>
            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider mb-3">
              Token Expiry Countdown
            </h3>
            <div className="bg-white/5 rounded-lg border border-white/10 p-4">
              <div className="flex items-center gap-3 mb-3">
                <Clock className="h-5 w-5 text-white/50" />
                <ExpiryCountdown exp={claims.exp} />
              </div>
              {claims.exp && (
                <p className="text-xs text-white/40">
                  Expires: {formatClaimValue('exp', claims.exp)}
                </p>
              )}
              {tokenPresence.accessTokenExpiry && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-white/40" />
                    <div>
                      <span className="text-xs text-white/50 block">Access Token Expiry</span>
                      <span className="text-sm font-mono text-white/70">
                        {new Date(tokenPresence.accessTokenExpiry * 1000).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Security note */}
          <div className="bg-amber-500/5 rounded-lg border border-amber-500/20 p-3">
            <div className="flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-amber-400 mt-0.5 flex-shrink-0" />
              <p className="text-xs text-amber-300/70 leading-relaxed">
                Raw token values are never exposed. Only decoded claims from the
                ID token are shown. The token was verified by Auth0 during
                session establishment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
