'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Activity,
  Lock,
  Unlock,
  Eye,
  RefreshCw,
  GitBranch,
  Mail,
  Calendar,
  ListTodo,
  Search,
  User,
  Globe,
  Network,
  ChevronDown,
  MessageCircle,
  ArrowRight,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

import ScopeTopology from './scope-topology';
import ConsentTimeline from './consent-timeline';
import ScopeAnalytics from './scope-analytics';
import DelegationChain from './delegation-chain';
import TokenInspector from './token-inspector';
import ScopeExpiry from './scope-expiry';
import TokenLifecycle from './token-lifecycle';
import AnomalyAlerts from './anomaly-alerts';

import {
  ConnectedAccount,
  fetchConnectedAccounts,
  deleteConnectedAccount,
} from '@/lib/actions/profile';
import { type AuditEntry } from '@/lib/audit';
import { type AnomalyAlert } from '@/lib/anomaly-detection';
import {
  type ScopeRequest,
  fetchAuditEntries,
  fetchScopeRequests,
  fetchAnomalyAlerts,
} from '@/lib/actions/audit';
import { POLICY_RULES, type PolicyRule } from '@/lib/policy-constants';

interface KeyValueMap {
  [key: string]: any;
}

// --- Connection metadata ---

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

const ALL_SERVICES = ['google-oauth2'] as const;

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

// --- Scope classification ---

type ScopeLevel = 'read' | 'write' | 'admin' | 'other';

function classifyScope(scope: string): ScopeLevel {
  const lower = scope.toLowerCase();
  if (
    lower.includes('admin') ||
    lower.includes('manage') ||
    lower.includes('delete')
  ) {
    return 'admin';
  }
  if (
    lower.includes('write') ||
    lower.includes('compose') ||
    lower.includes('create') ||
    lower.includes('send') ||
    lower.includes('insert') ||
    lower.includes('modify')
  ) {
    return 'write';
  }
  if (
    lower.includes('read') ||
    lower.includes('readonly') ||
    lower.includes('search') ||
    lower.includes('list') ||
    lower.includes('view') ||
    lower === 'openid' ||
    lower === 'profile' ||
    lower === 'email'
  ) {
    return 'read';
  }
  return 'other';
}

const SCOPE_BADGE_STYLES: Record<ScopeLevel, string> = {
  read: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  write: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  admin: 'bg-red-500/20 text-red-300 border-red-500/30',
  other: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

const SCOPE_LEVEL_LABELS: Record<ScopeLevel, string> = {
  read: 'READ',
  write: 'WRITE',
  admin: 'ADMIN',
  other: 'SCOPE',
};

// --- Tool icon mapping ---

const TOOL_ICONS: Record<string, React.ReactNode> = {
  gmailSearchTool: <Search className="h-4 w-4 text-red-400" />,
  gmailDraftTool: <Mail className="h-4 w-4 text-red-400" />,
  getCalendarEventsTool: <Calendar className="h-4 w-4 text-blue-400" />,
  getTasksTool: <ListTodo className="h-4 w-4 text-green-400" />,
  createTasksTool: <ListTodo className="h-4 w-4 text-green-400" />,
  deleteTaskTool: <ListTodo className="h-4 w-4 text-green-400" />,
  completeTaskTool: <ListTodo className="h-4 w-4 text-green-400" />,
  getUserInfoTool: <User className="h-4 w-4 text-blue-400" />,
  serpApiTool: <Search className="h-4 w-4 text-orange-400" />,
};

// --- Security score computation ---

function computeSecurityScore(accounts: ConnectedAccount[]): {
  score: number;
  isEmpty: boolean;
  factors: { label: string; impact: number; positive: boolean }[];
} {
  // When no accounts are connected, score is not yet meaningful
  if (accounts.length === 0) {
    return {
      score: 0,
      isEmpty: true,
      factors: [],
    };
  }

  let score = 100;
  const factors: { label: string; impact: number; positive: boolean }[] = [];

  // Count total scopes across all connections
  const totalScopes = accounts.reduce(
    (sum, a) => sum + (a.scopes?.length || 0),
    0,
  );

  // Fewer scopes is better (each scope above 3 costs 4 points)
  if (totalScopes > 3) {
    const penalty = Math.min((totalScopes - 3) * 4, 30);
    score -= penalty;
    factors.push({
      label: `${totalScopes} active scopes (fewer is better)`,
      impact: -penalty,
      positive: false,
    });
  } else {
    factors.push({
      label: 'Minimal scopes active',
      impact: 0,
      positive: true,
    });
  }

  // Check for write scopes
  const hasWrite = accounts.some((a) =>
    a.scopes?.some((s) => classifyScope(s) === 'write'),
  );
  if (hasWrite) {
    score -= 15;
    factors.push({
      label: 'Write scopes enabled',
      impact: -15,
      positive: false,
    });
  } else {
    factors.push({
      label: 'No write scopes active',
      impact: 0,
      positive: true,
    });
  }

  // Check for admin scopes
  const hasAdmin = accounts.some((a) =>
    a.scopes?.some((s) => classifyScope(s) === 'admin'),
  );
  if (hasAdmin) {
    score -= 25;
    factors.push({
      label: 'Admin scopes detected',
      impact: -25,
      positive: false,
    });
  } else {
    factors.push({
      label: 'No admin scopes active',
      impact: 0,
      positive: true,
    });
  }

  // Bonus for using progressive authorization (fewer connections than max)
  const connectedCount = accounts.length;
  if (connectedCount < ALL_SERVICES.length) {
    const bonus = (ALL_SERVICES.length - connectedCount) * 5;
    score += bonus;
    factors.push({
      label: `Only ${connectedCount}/${ALL_SERVICES.length} services connected`,
      impact: bonus,
      positive: true,
    });
  }

  // Token Vault usage bonus (always true in this app)
  factors.push({
    label: 'Auth0 Token Vault in use',
    impact: 0,
    positive: true,
  });

  // Progressive authorization bonus
  factors.push({
    label: 'Progressive scope requests enabled',
    impact: 0,
    positive: true,
  });

  return { score: Math.max(0, Math.min(100, score)), isEmpty: false, factors };
}

// --- Scope label formatting ---

function formatScopeLabel(scope: string): string {
  // Shorten long Google scope URLs
  if (scope.startsWith('https://www.googleapis.com/auth/')) {
    return scope.replace('https://www.googleapis.com/auth/', '');
  }
  return scope;
}

// --- Security Score Ring ---

function SecurityScoreRing({
  score,
  size = 160,
}: {
  score: number;
  size?: number;
}) {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  let color: string;
  if (score >= 80) color = '#34d399'; // emerald-400
  else if (score >= 60) color = '#fbbf24'; // amber-400
  else color = '#f87171'; // red-400

  let label: string;
  if (score >= 80) label = 'Excellent';
  else if (score >= 60) label = 'Good';
  else if (score >= 40) label = 'Fair';
  else label = 'At Risk';

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        className="-rotate-90"
      >
        {/* Background ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Score ring */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
        {/* Glow effect */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth + 4}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          opacity={0.15}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-4xl font-bold text-white">{score}</span>
        <span className="text-xs text-white/60 uppercase tracking-wider mt-1">{label}</span>
      </div>
    </div>
  );
}

// --- Main component ---

export default function DashboardContent({ user }: { user: KeyValueMap }) {
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [scopeRequests, setScopeRequests] = useState<ScopeRequest[]>([]);
  const [anomalyAlerts, setAnomalyAlerts] = useState<AnomalyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showDemoBanner, setShowDemoBanner] = useState(false);

  // --- localStorage cache helpers ---
  const CACHE_KEY_AUDIT = 'scope-lock-audit';
  const CACHE_KEY_REQUESTS = 'scope-lock-requests';

  const saveCacheToLocalStorage = useCallback((entries: AuditEntry[], requests: ScopeRequest[]) => {
    try {
      localStorage.setItem(CACHE_KEY_AUDIT, JSON.stringify(entries));
      localStorage.setItem(CACHE_KEY_REQUESTS, JSON.stringify(requests));
    } catch {
      // Storage full or unavailable — ignore
    }
  }, []);

  const loadCacheFromLocalStorage = useCallback((): { entries: AuditEntry[]; requests: ScopeRequest[] } | null => {
    try {
      const rawEntries = localStorage.getItem(CACHE_KEY_AUDIT);
      const rawRequests = localStorage.getItem(CACHE_KEY_REQUESTS);
      if (rawEntries && rawRequests) {
        return {
          entries: JSON.parse(rawEntries),
          requests: JSON.parse(rawRequests),
        };
      }
    } catch {
      // Corrupt or unavailable — ignore
    }
    return null;
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [accounts, auditResult, requests, alerts] = await Promise.all([
        fetchConnectedAccounts(),
        fetchAuditEntries(),
        fetchScopeRequests(),
        fetchAnomalyAlerts(),
      ]);
      const { entries, isDemoData } = auditResult;
      setConnectedAccounts(accounts);
      setAuditEntries(entries);
      setScopeRequests(requests);
      setAnomalyAlerts(alerts);
      if (isDemoData) {
        setShowDemoBanner(true);
      } else if (entries.length > 0) {
        setShowDemoBanner(false);
      }
      // Persist to localStorage so data survives cold starts
      saveCacheToLocalStorage(entries, requests);
      return { entries, requests };
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      return null;
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [saveCacheToLocalStorage]);

  useEffect(() => {
    // Immediately hydrate from localStorage cache so the dashboard
    // shows data before the server fetch completes
    const cached = loadCacheFromLocalStorage();
    if (cached && cached.entries.length > 0) {
      setAuditEntries(cached.entries);
      setScopeRequests(cached.requests);
      const allDemo = cached.entries.every((e: AuditEntry) =>
        e.toolName.startsWith('[demo] ')
      );
      setShowDemoBanner(allDemo);
      // Stop showing the loading spinner since we have cached data
      setLoading(false);
    }

    async function initDashboard() {
      const result = await loadData();

      // If no audit data exists, seed demo data so the dashboard is not empty
      if (result && result.entries.length === 0 && result.requests.length === 0) {
        try {
          const res = await fetch('/api/seed-demo', { method: 'POST' });
          if (res.ok) {
            const data = await res.json();
            if (data.seeded) {
              setShowDemoBanner(true);
              await loadData();
            }
          }
        } catch {
          // Seeding failed silently — dashboard stays empty
        }
      }
    }

    initDashboard();

    // Poll for audit entries every 10 seconds
    const interval = setInterval(async () => {
      try {
        const [auditResult, requests, alerts] = await Promise.all([
          fetchAuditEntries(),
          fetchScopeRequests(),
          fetchAnomalyAlerts(),
        ]);
        const { entries, isDemoData } = auditResult;
        setAuditEntries(entries);
        setScopeRequests(requests);
        setAnomalyAlerts(alerts);
        // Update localStorage cache on each poll
        saveCacheToLocalStorage(entries, requests);

        // Hide demo banner once real (non-demo) data appears
        if (isDemoData) {
          setShowDemoBanner(true);
        } else if (entries.length > 0) {
          setShowDemoBanner(false);
        }
      } catch {
        // Silently continue polling
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [loadData, loadCacheFromLocalStorage, saveCacheToLocalStorage]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
  };

  const handleRevoke = async (accountId: string) => {
    if (!confirm('Revoke this connection? The agent will need to re-request access.')) {
      return;
    }
    setDeletingId(accountId);
    try {
      const result = await deleteConnectedAccount(accountId);
      if (result.success) {
        await loadData();
      } else {
        alert(`Failed to revoke: ${result.error}`);
      }
    } catch {
      alert('An error occurred while revoking the connection');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-white/60" />
      </div>
    );
  }

  const { score, isEmpty: scoreIsEmpty, factors } = computeSecurityScore(connectedAccounts);

  // Build a set of connected service names for quick lookup
  const connectedServices = new Set(connectedAccounts.map((a) => a.connection));

  // Determine if the user has any activity at all
  const hasActivity = connectedAccounts.length > 0 || auditEntries.length > 0 || scopeRequests.length > 0;

  return (
    <div className="space-y-6">
      {/* Header row with refresh */}
      <div className="flex items-center justify-end">
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Demo data banner */}
      {showDemoBanner && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-indigo-500/10 border border-indigo-500/25">
          <Eye className="h-4 w-4 text-indigo-300 flex-shrink-0" />
          <p className="text-sm text-indigo-200/80">
            This is sample data. It will be replaced with your real activity as you interact with the agent.
          </p>
        </div>
      )}

      {/* Anomaly Alerts */}
      <AnomalyAlerts alerts={anomalyAlerts} />

      {/* Get Started Card — shown only when the dashboard is empty */}
      {!hasActivity && (
        <div className="bg-gradient-to-br from-indigo-500/15 via-purple-500/10 to-cyan-500/10 backdrop-blur-sm rounded-lg border border-indigo-500/30 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 rounded-xl bg-indigo-500/20 flex-shrink-0">
              <Sparkles className="h-6 w-6 text-indigo-300" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-white mb-2">Welcome to your Permission Dashboard</h2>
              <p className="text-sm text-white/70 leading-relaxed mb-4">
                Start by chatting with an agent on the Chat page. As you interact, your security data will populate here in real-time.
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <a
                  href="/chat"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-500/30 hover:bg-indigo-500/40 rounded-lg border border-indigo-500/40 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  Open Chat
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
                <span className="text-xs text-white/40">
                  Try selecting the Reader Agent and asking &quot;What are my recent emails?&quot;
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top row: Security Score + Active Scopes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Security Score Panel */}
        <div className="lg:col-span-1 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4 md:p-6">
          <div className="flex items-center gap-2 mb-6">
            <Shield className="h-5 w-5 text-white/80" />
            <h2 className="text-lg font-semibold text-white">Security Score</h2>
          </div>

          {scoreIsEmpty ? (
            <div className="flex flex-col items-center text-center py-4">
              <div className="relative flex items-center justify-center mb-4" style={{ width: 160, height: 160 }}>
                <svg width={160} height={160} className="-rotate-90">
                  <circle
                    cx={80}
                    cy={80}
                    r={75}
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={10}
                    fill="none"
                  />
                  <circle
                    cx={80}
                    cy={80}
                    r={75}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={10}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={2 * Math.PI * 75}
                    strokeDashoffset={2 * Math.PI * 75 * 0.75}
                    className="animate-pulse"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold text-white/30">--</span>
                  <span className="text-xs text-white/40 uppercase tracking-wider mt-1">Pending</span>
                </div>
              </div>
              <p className="text-sm text-white/50 max-w-[220px] leading-relaxed">
                Not yet calculated — interact with an agent to establish a security baseline.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col items-center mb-6">
                <SecurityScoreRing score={score} />
              </div>

              <div className="space-y-2">
                {factors.map((factor, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    {factor.positive ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                    ) : (
                      <ShieldAlert className="h-3.5 w-3.5 text-amber-400 mt-0.5 flex-shrink-0" />
                    )}
                    <span className={factor.positive ? 'text-white/60' : 'text-white/80'}>
                      {factor.label}
                      {factor.impact !== 0 && (
                        <span className={factor.impact > 0 ? 'text-emerald-400 ml-1' : 'text-amber-400 ml-1'}>
                          ({factor.impact > 0 ? '+' : ''}{factor.impact})
                        </span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Active Scopes Panel */}
        <div className="lg:col-span-2 bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-white/80" />
              <h2 className="text-lg font-semibold text-white">Active Scopes</h2>
            </div>
            <span className="text-sm text-white/50">
              {connectedAccounts.length} connection{connectedAccounts.length !== 1 ? 's' : ''} active
            </span>
          </div>

          <div className="space-y-4">
            {ALL_SERVICES.map((serviceKey) => {
              const meta = getServiceMeta(serviceKey);
              const account = connectedAccounts.find((a) => a.connection === serviceKey);
              const isConnected = !!account;

              return (
                <div
                  key={serviceKey}
                  className={`p-4 rounded-lg border transition-colors ${
                    isConnected
                      ? `${meta.bgColor} ${meta.borderColor}`
                      : 'bg-white/5 border-white/10 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${meta.bgColor} ${meta.color}`}>
                        {meta.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{meta.label}</span>
                          {isConnected ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-400">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                              </span>
                              Connected
                            </span>
                          ) : (
                            <span className="text-xs text-white/40">Not connected</span>
                          )}
                        </div>
                        {isConnected && account.created_at && (
                          <span className="text-xs text-white/40 mt-0.5">
                            Connected {formatDistanceToNow(new Date(account.created_at), { addSuffix: true })}
                          </span>
                        )}
                      </div>
                    </div>
                    {isConnected && (
                      <button
                        onClick={() => handleRevoke(account.id)}
                        disabled={deletingId === account.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-md border border-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                      >
                        {deletingId === account.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        Revoke
                      </button>
                    )}
                  </div>

                  {/* Scope badges */}
                  {isConnected && account.scopes && account.scopes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {account.scopes.map((scope) => {
                        const level = classifyScope(scope);
                        return (
                          <span
                            key={scope}
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${SCOPE_BADGE_STYLES[level]}`}
                            title={scope}
                          >
                            {level === 'read' && <Eye className="h-2.5 w-2.5" />}
                            {level === 'write' && <Unlock className="h-2.5 w-2.5" />}
                            {level === 'admin' && <ShieldAlert className="h-2.5 w-2.5" />}
                            {level === 'other' && <Lock className="h-2.5 w-2.5" />}
                            <span className="font-medium text-[10px] uppercase tracking-wider mr-0.5">
                              {SCOPE_LEVEL_LABELS[level]}
                            </span>
                            {formatScopeLabel(scope)}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {isConnected && (!account.scopes || account.scopes.length === 0) && (
                    <div className="mt-3 text-xs text-white/40 italic">
                      No explicit scopes (default access)
                    </div>
                  )}
                </div>
              );
            })}

            {/* Show any additional connections not in ALL_SERVICES */}
            {connectedAccounts
              .filter((a) => !ALL_SERVICES.includes(a.connection as any))
              .map((account) => {
                const meta = getServiceMeta(account.connection);
                return (
                  <div
                    key={account.id}
                    className={`p-4 rounded-lg border ${meta.bgColor} ${meta.borderColor}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg ${meta.bgColor} ${meta.color}`}>
                          {meta.icon}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-white">{meta.label}</span>
                            <span className="flex items-center gap-1 text-xs text-emerald-400">
                              <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                              </span>
                              Connected
                            </span>
                          </div>
                          {account.created_at && (
                            <span className="text-xs text-white/40 mt-0.5">
                              Connected {formatDistanceToNow(new Date(account.created_at), { addSuffix: true })}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRevoke(account.id)}
                        disabled={deletingId === account.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 rounded-md border border-red-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
                      >
                        {deletingId === account.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                        Revoke
                      </button>
                    </div>
                    {account.scopes && account.scopes.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {account.scopes.map((scope) => {
                          const level = classifyScope(scope);
                          return (
                            <span
                              key={scope}
                              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border ${SCOPE_BADGE_STYLES[level]}`}
                              title={scope}
                            >
                              {level === 'read' && <Eye className="h-2.5 w-2.5" />}
                              {level === 'write' && <Unlock className="h-2.5 w-2.5" />}
                              {level === 'admin' && <ShieldAlert className="h-2.5 w-2.5" />}
                              {level === 'other' && <Lock className="h-2.5 w-2.5" />}
                              <span className="font-medium text-[10px] uppercase tracking-wider mr-0.5">
                                {SCOPE_LEVEL_LABELS[level]}
                              </span>
                              {formatScopeLabel(scope)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* How Scope Lock Works (Scope Topology) */}
      <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4 md:p-6">
        <div className="flex items-center gap-2 mb-2">
          <Network className="h-5 w-5 text-white/80 shrink-0" />
          <h2 className="text-base md:text-lg font-semibold text-white">
            How Scope Lock Works
          </h2>
        </div>
        <p className="text-xs md:text-sm text-white/50 mb-4 md:mb-6">
          Each agent operates within strict permission boundaries. Scope Lock ensures agents only access what they need through the services shown below.
        </p>
        <ScopeTopology />
      </div>

      {/* Bottom row: Audit Trail + Scope Request History */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Audit Trail */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-white/80" />
              <h2 className="text-lg font-semibold text-white">Audit Trail</h2>
            </div>
            {auditEntries.length > 0 && (
              <span className="text-xs text-white/40">
                {auditEntries.length} event{auditEntries.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {auditEntries.length === 0 ? (
            <div>
              <p className="text-sm text-white/50 mb-4 leading-relaxed">
                Start chatting with an agent to see your authorization activity here. Try selecting the Reader Agent and asking &quot;What are my recent emails?&quot;
              </p>

              {/* Sample audit entry */}
              <div className="relative opacity-60">
                <div className="absolute -top-2 right-2 z-10">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium uppercase tracking-wider">
                    Example
                  </span>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="text-left">
                      <th className="text-xs font-medium text-white/50 uppercase tracking-wider pb-3 pl-3 pr-2">Tool</th>
                      <th className="text-xs font-medium text-white/50 uppercase tracking-wider pb-3 px-2">Scopes</th>
                      <th className="text-xs font-medium text-white/50 uppercase tracking-wider pb-3 px-2">Time</th>
                      <th className="text-xs font-medium text-white/50 uppercase tracking-wider pb-3 px-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <tr className="bg-white/[0.03]">
                      <td className="py-2.5 pl-3 pr-2">
                        <div className="flex items-center gap-2">
                          <Search className="h-4 w-4 text-red-400" />
                          <span className="text-sm text-white/80 font-mono">gmailSearchTool</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                          gmail.readonly
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="text-xs text-white/50">just now</span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className="flex items-center justify-end gap-1 text-xs text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          OK
                        </span>
                      </td>
                    </tr>
                    <tr className="bg-white/[0.03]">
                      <td className="py-2.5 pl-3 pr-2">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-blue-400" />
                          <span className="text-sm text-white/80 font-mono">getCalendarEvents</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="text-[10px] px-1.5 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                          calendar.events
                        </span>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="text-xs text-white/50">2 min ago</span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <span className="flex items-center justify-end gap-1 text-xs text-emerald-400">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          OK
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto space-y-0 hide-scrollbar">
              <table className="w-full">
                <thead className="sticky top-0 bg-white/10 backdrop-blur-sm z-10">
                  <tr className="text-left">
                    <th className="text-xs font-medium text-white/50 uppercase tracking-wider pb-3 pl-3 pr-2">Tool</th>
                    <th className="text-xs font-medium text-white/50 uppercase tracking-wider pb-3 px-2">Scopes</th>
                    <th className="text-xs font-medium text-white/50 uppercase tracking-wider pb-3 px-2">Time</th>
                    <th className="text-xs font-medium text-white/50 uppercase tracking-wider pb-3 px-2 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {auditEntries.map((entry) => {
                    const displayName = entry.toolName.startsWith('[demo] ')
                      ? entry.toolName.slice(7)
                      : entry.toolName;
                    return (
                    <tr key={entry.id} className="group hover:bg-white/5 transition-colors">
                      <td className="py-2.5 pl-3 pr-2">
                        <div className="flex items-center gap-2">
                          {TOOL_ICONS[displayName] || <Activity className="h-4 w-4 text-white/40" />}
                          <span className="text-sm text-white/80 font-mono truncate max-w-[120px]" title={displayName}>
                            {displayName}
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <div className="flex flex-wrap gap-1">
                          {entry.scopes.slice(0, 2).map((scope) => {
                            const level = classifyScope(scope);
                            return (
                              <span
                                key={scope}
                                className={`text-[10px] px-1.5 py-0.5 rounded border ${SCOPE_BADGE_STYLES[level]}`}
                                title={scope}
                              >
                                {formatScopeLabel(scope).slice(0, 20)}
                              </span>
                            );
                          })}
                          {entry.scopes.length > 2 && (
                            <span className="text-[10px] text-white/40">
                              +{entry.scopes.length - 2}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 px-2">
                        <span className="text-xs text-white/50" title={format(new Date(entry.timestamp), 'PPpp')}>
                          {formatDistanceToNow(new Date(entry.timestamp), { addSuffix: true })}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {entry.success ? (
                            <span className="flex items-center gap-1 text-xs text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              OK
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-red-400">
                              <XCircle className="h-3.5 w-3.5" />
                              Fail
                            </span>
                          )}
                          {entry.duration > 0 && (
                            <span className="text-[10px] text-white/30 ml-1">
                              {entry.duration}ms
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Scope Request History */}
        <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-white/80" />
              <h2 className="text-lg font-semibold text-white">Scope Request History</h2>
            </div>
            {scopeRequests.length > 0 && (
              <span className="text-xs text-white/40">
                {scopeRequests.length} request{scopeRequests.length !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {scopeRequests.length === 0 ? (
            <div>
              <p className="text-sm text-white/50 mb-4 leading-relaxed">
                When the AI agent requests access to a service, the progressive authorization flow will be tracked here.
              </p>

              {/* Sample scope request entry */}
              <div className="relative opacity-60">
                <div className="absolute -top-2 right-2 z-10">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium uppercase tracking-wider">
                    Example
                  </span>
                </div>
                <div className="relative">
                  <div className="absolute left-[15px] top-0 bottom-0 w-px bg-white/10" />
                  <div className="space-y-4">
                    <div className="relative flex items-start gap-4 pl-1">
                      <div className="relative z-10 flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center bg-emerald-500/20 border border-emerald-500/40">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      </div>
                      <div className="flex-1 min-w-0 pb-2">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium text-red-400">Google</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium bg-emerald-500/20 text-emerald-300">
                            granted
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1 mb-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded border bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
                            gmail.readonly
                          </span>
                        </div>
                        <span className="text-[10px] text-white/40">Requested just now</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto hide-scrollbar">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-[15px] top-0 bottom-0 w-px bg-white/10" />

                <div className="space-y-4">
                  {scopeRequests.map((request) => {
                    const meta = getServiceMeta(request.connection);
                    return (
                      <div key={request.id} className="relative flex items-start gap-4 pl-1">
                        {/* Timeline dot */}
                        <div className={`relative z-10 flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center ${
                          request.status === 'granted'
                            ? 'bg-emerald-500/20 border border-emerald-500/40'
                            : request.status === 'denied'
                            ? 'bg-red-500/20 border border-red-500/40'
                            : 'bg-amber-500/20 border border-amber-500/40'
                        }`}>
                          {request.status === 'granted' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
                          {request.status === 'denied' && <XCircle className="h-3.5 w-3.5 text-red-400" />}
                          {request.status === 'pending' && <Clock className="h-3.5 w-3.5 text-amber-400" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-medium ${meta.color}`}>{meta.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wider font-medium ${
                              request.status === 'granted'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : request.status === 'denied'
                                ? 'bg-red-500/20 text-red-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}>
                              {request.status}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1 mb-1.5">
                            {request.scopes.map((scope) => {
                              const level = classifyScope(scope);
                              return (
                                <span
                                  key={scope}
                                  className={`text-[10px] px-1.5 py-0.5 rounded border ${SCOPE_BADGE_STYLES[level]}`}
                                  title={scope}
                                >
                                  {formatScopeLabel(scope)}
                                </span>
                              );
                            })}
                          </div>

                          <div className="flex items-center gap-3 text-[10px] text-white/40">
                            <span>
                              Requested {formatDistanceToNow(new Date(request.requestedAt), { addSuffix: true })}
                            </span>
                            {request.grantedAt && (
                              <span>
                                Granted {formatDistanceToNow(new Date(request.grantedAt), { addSuffix: true })}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Advanced Section — expandable */}
      <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="w-full flex items-center justify-between p-4 md:p-6 text-left hover:bg-white/5 transition-colors rounded-lg min-h-[44px]"
        >
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="h-5 w-5 text-white/80 shrink-0" />
            <h2 className="text-base md:text-lg font-semibold text-white">Advanced Panels</h2>
            <span className="text-xs text-white/40 ml-2 hidden sm:inline truncate">
              Policy Rules, Token Inspector, Scope Analytics, Delegation Chain, and more
            </span>
          </div>
          <ChevronDown className={`h-5 w-5 text-white/50 transition-transform duration-200 shrink-0 ${showAdvanced ? 'rotate-180' : ''}`} />
        </button>

        {showAdvanced && (
          <div className="px-4 pb-4 md:px-6 md:pb-6 space-y-4 md:space-y-6">
            {/* Policy Rules */}
            <div className="bg-white/5 rounded-lg border border-white/10 p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <Shield className="h-5 w-5 text-white/80" />
                <h2 className="text-lg font-semibold text-white">Policy Rules</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-white/10">
                      <th className="text-xs font-medium text-white/50 uppercase tracking-wider pb-3 pr-4">Tool</th>
                      <th className="text-xs font-medium text-white/50 uppercase tracking-wider pb-3 px-4">Risk Level</th>
                      <th className="text-xs font-medium text-white/50 uppercase tracking-wider pb-3 px-4">Action</th>
                      <th className="text-xs font-medium text-white/50 uppercase tracking-wider pb-3 pl-4">Reason</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {POLICY_RULES.map((rule) => (
                      <tr
                        key={rule.toolName}
                        className={`${
                          rule.level === 'GREEN'
                            ? 'bg-emerald-500/5'
                            : rule.level === 'AMBER'
                            ? 'bg-amber-500/5'
                            : 'bg-red-500/5'
                        }`}
                      >
                        <td className="py-2.5 pr-4">
                          <div className="flex items-center gap-2">
                            {TOOL_ICONS[rule.toolName] || <Activity className="h-4 w-4 text-white/40" />}
                            <span className="text-sm text-white/80 font-mono">{rule.toolName}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full border font-medium ${
                              rule.level === 'GREEN'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : rule.level === 'AMBER'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-red-500/20 text-red-300 border-red-500/30'
                            }`}
                          >
                            {rule.level === 'GREEN' && <ShieldCheck className="h-3 w-3" />}
                            {rule.level === 'AMBER' && <ShieldAlert className="h-3 w-3" />}
                            {rule.level === 'RED' && <ShieldAlert className="h-3 w-3" />}
                            {rule.level}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="text-sm text-white/60">{rule.action}</span>
                        </td>
                        <td className="py-2.5 pl-4">
                          <span className="text-sm text-white/60">{rule.reason}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Token Inspector */}
            <TokenInspector />

            {/* Scope Analytics */}
            <ScopeAnalytics entries={auditEntries} />

            {/* Delegation Chain */}
            <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <GitBranch className="h-5 w-5 text-white/80" />
                <h2 className="text-lg font-semibold text-white">Delegation Chain</h2>
              </div>
              <DelegationChain />
            </div>

            {/* Consent History Timeline */}
            <div className="bg-white/5 rounded-lg border border-white/10 p-4 md:p-6">
              <div className="flex items-center gap-2 mb-6">
                <Clock className="h-5 w-5 text-white/80" />
                <h2 className="text-lg font-semibold text-white">Consent History Timeline</h2>
              </div>
              <ConsentTimeline scopeRequests={scopeRequests} />
            </div>

            {/* Scope Expiry */}
            <ScopeExpiry />

            {/* Token Lifecycle */}
            <TokenLifecycle connectedAccounts={connectedAccounts} auditEntries={auditEntries} />
          </div>
        )}
      </div>
    </div>
  );
}
