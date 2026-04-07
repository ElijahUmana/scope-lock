'use client';

import { useMemo } from 'react';
import {
  BarChart3,
  PieChart,
  Activity,
  TrendingUp,
  Server,
  ShieldCheck,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import type { AuditEntry } from '@/lib/audit';

// --- Helpers ---

const RISK_WEIGHTS: Record<string, number> = {
  GREEN: 1,
  AMBER: 2,
  RED: 3,
};

const RISK_COLORS: Record<string, { bg: string; text: string; bar: string }> = {
  GREEN: { bg: 'bg-emerald-500/20', text: 'text-emerald-300', bar: '#34d399' },
  AMBER: { bg: 'bg-amber-500/20', text: 'text-amber-300', bar: '#fbbf24' },
  RED: { bg: 'bg-red-500/20', text: 'text-red-300', bar: '#f87171' },
};

/** Map connection IDs to human-readable service names. */
const CONNECTION_LABELS: Record<string, string> = {
  'google-oauth2': 'Google',
  github: 'GitHub',
  slack: 'Slack',
  'sign-in-with-slack': 'Slack',
  auth0: 'Auth0',
  ciba: 'Step-Up Auth',
};

function connectionLabel(conn: string): string {
  return CONNECTION_LABELS[conn] ?? conn;
}

/** Derive a friendly service name from tool name when connection is missing. */
function serviceFromTool(toolName: string): string {
  if (toolName.toLowerCase().includes('gmail')) return 'Google';
  if (toolName.toLowerCase().includes('calendar')) return 'Google';
  if (toolName.toLowerCase().includes('task')) return 'Google';
  if (toolName.toLowerCase().includes('github') || toolName.toLowerCase().includes('repositories')) return 'GitHub';
  if (toolName.toLowerCase().includes('slack')) return 'Slack';
  if (toolName.toLowerCase().includes('shop')) return 'Shopping';
  if (toolName.toLowerCase().includes('serp')) return 'Search';
  if (toolName.toLowerCase().includes('user')) return 'Auth0';
  return 'Other';
}

function resolveService(entry: AuditEntry): string {
  if (entry.connection) return connectionLabel(entry.connection);
  return serviceFromTool(entry.toolName);
}

// --- Stat card ---

function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white/5 rounded-lg border border-white/10 p-4 flex items-start gap-3">
      <div className="p-2 rounded-lg bg-white/5 text-white/60 flex-shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs text-white/50 uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-bold text-white leading-none">{value}</p>
        {sub && <p className="text-xs text-white/40 mt-1">{sub}</p>}
      </div>
    </div>
  );
}

// --- Pure CSS pie (conic-gradient) ---

function RatioRing({
  readCount,
  writeCount,
  size = 64,
}: {
  readCount: number;
  writeCount: number;
  size?: number;
}) {
  const total = readCount + writeCount;
  if (total === 0) {
    return (
      <div
        className="rounded-full border-2 border-white/10"
        style={{ width: size, height: size }}
      />
    );
  }
  const readPct = (readCount / total) * 100;
  return (
    <div
      className="rounded-full"
      style={{
        width: size,
        height: size,
        background: `conic-gradient(#34d399 0% ${readPct}%, #fbbf24 ${readPct}% 100%)`,
      }}
      title={`Read: ${readCount} (${readPct.toFixed(0)}%) / Write: ${writeCount} (${(100 - readPct).toFixed(0)}%)`}
    >
      {/* Inner cutout for donut effect */}
      <div
        className="rounded-full bg-white/10 backdrop-blur-sm flex items-center justify-center"
        style={{
          width: size - 16,
          height: size - 16,
          margin: 8,
        }}
      >
        <span className="text-[10px] font-medium text-white/70">
          {readPct.toFixed(0)}%
        </span>
      </div>
    </div>
  );
}

// --- Bar chart (time buckets) ---

function TimeBucketChart({
  entries,
}: {
  entries: AuditEntry[];
}) {
  const buckets = useMemo(() => {
    if (entries.length === 0) return [];

    const sorted = [...entries].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );

    const earliest = new Date(sorted[0].timestamp).getTime();
    const latest = new Date(sorted[sorted.length - 1].timestamp).getTime();
    const spanMs = latest - earliest;

    // Choose bucket size: if span < 10 min use 1 min, else use 1 hr
    const useMinutes = spanMs < 10 * 60 * 1000;
    const bucketMs = useMinutes ? 60 * 1000 : 60 * 60 * 1000;
    const bucketLabel = useMinutes ? 'min' : 'hr';

    const map = new Map<
      number,
      { green: number; amber: number; red: number; label: string }
    >();

    for (const entry of sorted) {
      const ts = new Date(entry.timestamp).getTime();
      const key = Math.floor((ts - earliest) / bucketMs);
      if (!map.has(key)) {
        const offset = key * bucketMs;
        const d = new Date(earliest + offset);
        const lbl = useMinutes
          ? `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
          : `${d.getHours().toString().padStart(2, '0')}:00`;
        map.set(key, { green: 0, amber: 0, red: 0, label: lbl });
      }
      const b = map.get(key)!;
      const lvl = (entry.riskLevel || 'GREEN').toUpperCase();
      if (lvl === 'RED') b.red++;
      else if (lvl === 'AMBER') b.amber++;
      else b.green++;
    }

    return { buckets: Array.from(map.values()), bucketLabel };
  }, [entries]);

  if (!buckets || (Array.isArray(buckets) && buckets.length === 0)) return null;

  const { buckets: data, bucketLabel } = buckets as {
    buckets: { green: number; amber: number; red: number; label: string }[];
    bucketLabel: string;
  };

  const maxTotal = Math.max(...data.map((b) => b.green + b.amber + b.red), 1);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-white/60" />
          <h3 className="text-sm font-medium text-white/80">Scope Usage Over Time</h3>
        </div>
        <span className="text-[10px] text-white/40 uppercase tracking-wider">
          per {bucketLabel}
        </span>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-3">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#34d399' }} />
          <span className="text-[10px] text-white/50">Green</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#fbbf24' }} />
          <span className="text-[10px] text-white/50">Amber</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#f87171' }} />
          <span className="text-[10px] text-white/50">Red</span>
        </div>
      </div>

      {/* Bars */}
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {data.map((b, i) => {
          const total = b.green + b.amber + b.red;
          const heightPct = (total / maxTotal) * 100;
          const greenPct = total > 0 ? (b.green / total) * 100 : 0;
          const amberPct = total > 0 ? (b.amber / total) * 100 : 0;

          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-0.5" style={{ height: '100%' }}>
              <div className="w-full flex-1 flex flex-col justify-end">
                <div
                  className="w-full rounded-t-sm overflow-hidden transition-all duration-300"
                  style={{ height: `${heightPct}%`, minHeight: total > 0 ? 4 : 0 }}
                  title={`${b.label}: ${total} calls (G:${b.green} A:${b.amber} R:${b.red})`}
                >
                  {/* Stacked segments */}
                  <div className="w-full h-full flex flex-col">
                    {b.red > 0 && (
                      <div style={{ flex: b.red, backgroundColor: '#f87171' }} />
                    )}
                    {b.amber > 0 && (
                      <div style={{ flex: b.amber, backgroundColor: '#fbbf24' }} />
                    )}
                    {b.green > 0 && (
                      <div style={{ flex: b.green, backgroundColor: '#34d399' }} />
                    )}
                  </div>
                </div>
              </div>
              <span className="text-[8px] text-white/30 leading-none whitespace-nowrap">
                {b.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Service breakdown horizontal bars ---

function ServiceBreakdown({ entries }: { entries: AuditEntry[] }) {
  const services = useMemo(() => {
    const map = new Map<
      string,
      { total: number; green: number; amber: number; red: number }
    >();

    for (const entry of entries) {
      const svc = resolveService(entry);
      if (!map.has(svc)) map.set(svc, { total: 0, green: 0, amber: 0, red: 0 });
      const s = map.get(svc)!;
      s.total++;
      const lvl = (entry.riskLevel || 'GREEN').toUpperCase();
      if (lvl === 'RED') s.red++;
      else if (lvl === 'AMBER') s.amber++;
      else s.green++;
    }

    return Array.from(map.entries())
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.total - a.total);
  }, [entries]);

  if (services.length === 0) return null;

  const maxCount = services[0].total;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Server className="h-4 w-4 text-white/60" />
        <h3 className="text-sm font-medium text-white/80">Service Breakdown</h3>
      </div>

      <div className="space-y-2.5">
        {services.map((svc) => {
          const widthPct = (svc.total / maxCount) * 100;
          const greenPct = (svc.green / svc.total) * 100;
          const amberPct = (svc.amber / svc.total) * 100;

          return (
            <div key={svc.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-white/70 font-medium">{svc.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/50">{svc.total} calls</span>
                  {/* Risk distribution pills */}
                  <div className="flex items-center gap-1">
                    {svc.green > 0 && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/20 text-emerald-300">
                        {svc.green}
                      </span>
                    )}
                    {svc.amber > 0 && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-300">
                        {svc.amber}
                      </span>
                    )}
                    {svc.red > 0 && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-red-500/20 text-red-300">
                        {svc.red}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {/* Bar */}
              <div className="w-full h-2.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full overflow-hidden flex transition-all duration-500"
                  style={{ width: `${widthPct}%` }}
                >
                  {svc.green > 0 && (
                    <div
                      style={{
                        width: `${greenPct}%`,
                        backgroundColor: '#34d399',
                      }}
                    />
                  )}
                  {svc.amber > 0 && (
                    <div
                      style={{
                        width: `${amberPct}%`,
                        backgroundColor: '#fbbf24',
                      }}
                    />
                  )}
                  {svc.red > 0 && (
                    <div
                      style={{
                        width: `${100 - greenPct - amberPct}%`,
                        backgroundColor: '#f87171',
                      }}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --- Credential context distribution ---

function CredentialContextBar({ entries }: { entries: AuditEntry[] }) {
  const { thread, toolCall, total } = useMemo(() => {
    let thread = 0;
    let toolCall = 0;
    for (const e of entries) {
      const ctx = (e.credentialsContext || '').toLowerCase();
      if (ctx === 'thread') thread++;
      else if (ctx === 'tool-call') toolCall++;
      else toolCall++; // default bucket
    }
    return { thread, toolCall, total: thread + toolCall };
  }, [entries]);

  if (total === 0) return null;

  const threadPct = (thread / total) * 100;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-4 w-4 text-white/60" />
        <h3 className="text-sm font-medium text-white/80">Credential Context</h3>
      </div>

      <div className="flex items-center gap-3 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#818cf8' }} />
          <span className="text-[10px] text-white/50">thread ({thread})</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: '#22d3ee' }} />
          <span className="text-[10px] text-white/50">tool-call ({toolCall})</span>
        </div>
      </div>

      <div className="w-full h-4 rounded-full bg-white/5 overflow-hidden flex">
        {thread > 0 && (
          <div
            className="h-full transition-all duration-500 flex items-center justify-center"
            style={{ width: `${threadPct}%`, backgroundColor: '#818cf8' }}
          >
            {threadPct >= 15 && (
              <span className="text-[9px] font-medium text-white">{threadPct.toFixed(0)}%</span>
            )}
          </div>
        )}
        {toolCall > 0 && (
          <div
            className="h-full transition-all duration-500 flex items-center justify-center"
            style={{ width: `${100 - threadPct}%`, backgroundColor: '#22d3ee' }}
          >
            {(100 - threadPct) >= 15 && (
              <span className="text-[9px] font-medium text-white">{(100 - threadPct).toFixed(0)}%</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main analytics component ---

export default function ScopeAnalytics({ entries }: { entries: AuditEntry[] }) {
  const stats = useMemo(() => {
    const total = entries.length;
    let readCount = 0;
    let writeCount = 0;
    let riskSum = 0;

    const serviceCounts = new Map<string, number>();

    for (const entry of entries) {
      const lvl = (entry.riskLevel || 'GREEN').toUpperCase();
      riskSum += RISK_WEIGHTS[lvl] ?? 1;

      // Read vs write: GREEN = read, AMBER/RED = write
      if (lvl === 'GREEN') readCount++;
      else writeCount++;

      const svc = resolveService(entry);
      serviceCounts.set(svc, (serviceCounts.get(svc) || 0) + 1);
    }

    const avgRisk = total > 0 ? riskSum / total : 0;

    let avgRiskLabel: string;
    let avgRiskColor: string;
    if (avgRisk < 1.5) {
      avgRiskLabel = 'Low';
      avgRiskColor = 'text-emerald-400';
    } else if (avgRisk < 2.5) {
      avgRiskLabel = 'Medium';
      avgRiskColor = 'text-amber-400';
    } else {
      avgRiskLabel = 'High';
      avgRiskColor = 'text-red-400';
    }

    // Most used service
    let topService = 'None';
    let topServiceCount = 0;
    for (const [svc, count] of serviceCounts) {
      if (count > topServiceCount) {
        topService = svc;
        topServiceCount = count;
      }
    }

    return {
      total,
      readCount,
      writeCount,
      avgRisk: avgRisk.toFixed(1),
      avgRiskLabel,
      avgRiskColor,
      topService,
      topServiceCount,
    };
  }, [entries]);

  if (entries.length === 0) {
    return (
      <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="h-5 w-5 text-white/80" />
          <h2 className="text-lg font-semibold text-white">Scope Usage Analytics</h2>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="p-3 rounded-full bg-white/5 mb-4">
            <BarChart3 className="h-8 w-8 text-white/20" />
          </div>
          <p className="text-white/40 text-sm mb-1">No analytics data yet</p>
          <p className="text-white/30 text-xs max-w-[280px]">
            Analytics will appear here once the agent starts making tool calls through the chat.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-lg border border-white/20 p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="h-5 w-5 text-white/80" />
        <h2 className="text-lg font-semibold text-white">Scope Usage Analytics</h2>
      </div>

      {/* Stats Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total API Calls"
          value={stats.total}
          sub={`${stats.total} audit entries`}
          icon={<Activity className="h-4 w-4" />}
        />

        {/* Read vs Write with pie */}
        <div className="bg-white/5 rounded-lg border border-white/10 p-4 flex items-start gap-3">
          <RatioRing readCount={stats.readCount} writeCount={stats.writeCount} />
          <div className="min-w-0">
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Read / Write</p>
            <p className="text-sm font-semibold text-white">
              {stats.readCount}
              <span className="text-white/40 mx-1">/</span>
              {stats.writeCount}
            </p>
            <p className="text-[10px] text-white/40 mt-0.5">
              <span className="text-emerald-400">Read</span>
              {' vs '}
              <span className="text-amber-400">Write</span>
            </p>
          </div>
        </div>

        <div className="bg-white/5 rounded-lg border border-white/10 p-4 flex items-start gap-3">
          <div className="p-2 rounded-lg bg-white/5 text-white/60 flex-shrink-0">
            {parseFloat(stats.avgRisk) < 1.5 ? (
              <ShieldCheck className="h-4 w-4" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1">Avg Risk</p>
            <p className={`text-2xl font-bold leading-none ${stats.avgRiskColor}`}>
              {stats.avgRisk}
            </p>
            <p className="text-xs text-white/40 mt-1">{stats.avgRiskLabel}</p>
          </div>
        </div>

        <StatCard
          label="Top Service"
          value={stats.topService}
          sub={`${stats.topServiceCount} calls`}
          icon={<Server className="h-4 w-4" />}
        />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Time buckets + Credential context */}
        <div className="space-y-6">
          <div className="bg-white/5 rounded-lg border border-white/10 p-4">
            <TimeBucketChart entries={entries} />
          </div>
          <div className="bg-white/5 rounded-lg border border-white/10 p-4">
            <CredentialContextBar entries={entries} />
          </div>
        </div>

        {/* Right: Service breakdown */}
        <div className="bg-white/5 rounded-lg border border-white/10 p-4">
          <ServiceBreakdown entries={entries} />
        </div>
      </div>
    </div>
  );
}
