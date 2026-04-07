'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Lock,
  Eye,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Play,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/utils/cn';

// ── Types ─────────────────────────────────────────────────────────

interface SecurityAssertion {
  name: string;
  category: 'isolation' | 'policy' | 'credential' | 'audit';
  passed: boolean;
  details: string;
}

interface SecurityTestReport {
  passed: number;
  failed: number;
  total: number;
  assertions: SecurityAssertion[];
}

interface TestRunState {
  status: 'idle' | 'running' | 'done' | 'error';
  report: SecurityTestReport | null;
  error: string | null;
  lastRunAt: Date | null;
  durationMs: number | null;
}

type CategoryKey = SecurityAssertion['category'];

const CATEGORY_META: Record<CategoryKey, { label: string; description: string; icon: typeof ShieldCheck }> = {
  isolation: { label: 'Isolation', description: 'Agent tool boundary enforcement', icon: ShieldOff },
  policy: { label: 'Policy', description: 'Risk-tier classification rules', icon: Eye },
  credential: { label: 'Credential', description: 'Credential lifecycle scoping', icon: Lock },
  audit: { label: 'Audit', description: 'Audit trail functionality', icon: ShieldAlert },
};

const CATEGORY_ORDER: CategoryKey[] = ['isolation', 'policy', 'credential', 'audit'];

// ── Assertion row ─────────────────────────────────────────────────

function AssertionRow({ assertion, index }: { assertion: SecurityAssertion; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={cn(
        'rounded-lg border transition-colors',
        assertion.passed
          ? 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/[0.08]'
          : 'border-red-500/20 bg-red-500/5 hover:bg-red-500/[0.08]',
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center gap-3 p-3.5 text-left cursor-pointer"
      >
        <span className="shrink-0 text-[10px] font-mono text-white/30 bg-white/5 rounded px-1.5 py-0.5">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div
          className={cn(
            'shrink-0',
            assertion.passed ? 'text-emerald-400' : 'text-red-400',
          )}
        >
          {assertion.passed ? (
            <CheckCircle2 className="w-4 h-4" />
          ) : (
            <XCircle className="w-4 h-4" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-sm text-white">{assertion.name}</span>
        </div>
        <span
          className={cn(
            'shrink-0 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded',
            assertion.passed
              ? 'text-emerald-400 bg-emerald-500/10'
              : 'text-red-400 bg-red-500/10',
          )}
        >
          {assertion.passed ? 'PASS' : 'FAIL'}
        </span>
        <div className="shrink-0">
          {expanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-white/30" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-white/30" />
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-3.5 pb-3.5 border-t border-white/5 pt-3">
          <pre className="text-xs text-white/50 leading-relaxed whitespace-pre-wrap font-mono bg-white/[0.02] rounded-md p-3 border border-white/5">
            {assertion.details}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── Category section ──────────────────────────────────────────────

function CategorySection({
  category,
  assertions,
  startIndex,
}: {
  category: CategoryKey;
  assertions: SecurityAssertion[];
  startIndex: number;
}) {
  const meta = CATEGORY_META[category];
  const Icon = meta.icon;
  const passedCount = assertions.filter((a) => a.passed).length;
  const allPassed = passedCount === assertions.length;

  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('w-4 h-4', allPassed ? 'text-emerald-400' : 'text-amber-400')} />
          <div>
            <h3 className="text-sm font-semibold text-white">{meta.label}</h3>
            <p className="text-[11px] text-white/40">{meta.description}</p>
          </div>
        </div>
        <span
          className={cn(
            'text-[10px] font-mono font-semibold px-2 py-0.5 rounded border',
            allPassed
              ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
              : 'text-amber-400 bg-amber-500/10 border-amber-500/20',
          )}
        >
          {passedCount}/{assertions.length}
        </span>
      </div>
      <div className="space-y-2">
        {assertions.map((assertion, i) => (
          <AssertionRow
            key={assertion.name}
            assertion={assertion}
            index={startIndex + i}
          />
        ))}
      </div>
    </section>
  );
}

// ── Summary banner ────────────────────────────────────────────────

function SummaryBanner({
  report,
  lastRunAt,
  durationMs,
}: {
  report: SecurityTestReport;
  lastRunAt: Date;
  durationMs: number;
}) {
  const allPassed = report.failed === 0;

  return (
    <div
      className={cn(
        'rounded-lg border p-5',
        allPassed
          ? 'border-emerald-500/20 bg-emerald-500/5'
          : 'border-red-500/20 bg-red-500/5',
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {allPassed ? (
            <ShieldCheck className="h-6 w-6 text-emerald-400" />
          ) : (
            <ShieldAlert className="h-6 w-6 text-red-400" />
          )}
          <div>
            <h3 className="text-sm font-semibold text-white">
              {allPassed
                ? 'All Security Assertions Passed'
                : 'Security Assertion Failures Detected'}
            </h3>
            <p className="text-xs text-white/50 mt-0.5">
              {report.passed} passed, {report.failed} failed out of {report.total} total
            </p>
          </div>
        </div>
        <div
          className={cn(
            'rounded-full px-3 py-1 text-xs font-mono font-semibold',
            allPassed
              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              : 'bg-red-500/10 text-red-400 border border-red-500/20',
          )}
        >
          {report.passed}/{report.total}
        </div>
      </div>
      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-white/5">
        <div className="flex items-center gap-1.5 text-[11px] text-white/40">
          <Clock className="w-3 h-3" />
          <span>Last run: {lastRunAt.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-white/40">
          <Play className="w-3 h-3" />
          <span>Duration: {durationMs}ms</span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────

export default function SandboxContent() {
  const [state, setState] = useState<TestRunState>({
    status: 'idle',
    report: null,
    error: null,
    lastRunAt: null,
    durationMs: null,
  });
  const hasAutoRun = useRef(false);

  const runTests = useCallback(async () => {
    setState((prev) => ({
      ...prev,
      status: 'running',
      error: null,
    }));

    const start = performance.now();
    try {
      const res = await fetch('/api/security-test');
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }
      const data: SecurityTestReport = await res.json();
      const elapsed = Math.round(performance.now() - start);
      setState({
        status: 'done',
        report: data,
        error: null,
        lastRunAt: new Date(),
        durationMs: elapsed,
      });
    } catch (err) {
      const elapsed = Math.round(performance.now() - start);
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : 'Failed to fetch security test results',
        durationMs: elapsed,
      }));
    }
  }, []);

  // Auto-run on mount
  useEffect(() => {
    if (!hasAutoRun.current) {
      hasAutoRun.current = true;
      runTests();
    }
  }, [runTests]);

  // Build category groups from report
  const grouped =
    state.report
      ? CATEGORY_ORDER.map((category) => {
          const assertions = state.report!.assertions.filter((a) => a.category === category);
          return { category, assertions };
        }).filter((g) => g.assertions.length > 0)
      : [];

  // Calculate running startIndex for each group
  let runningIndex = 0;
  const groupsWithIndex = grouped.map((g) => {
    const startIndex = runningIndex;
    runningIndex += g.assertions.length;
    return { ...g, startIndex };
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Run All Tests button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={runTests}
          disabled={state.status === 'running'}
          className={cn(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer',
            state.status === 'running'
              ? 'bg-white/5 border border-white/10 text-white/40 cursor-not-allowed'
              : 'bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20',
          )}
        >
          {state.status === 'running' ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {state.status === 'running' ? 'Running 14 Assertions...' : 'Run All Tests'}
        </button>
        {state.lastRunAt && state.status !== 'running' && (
          <span className="text-[11px] text-white/30">
            {state.durationMs !== null && `${state.durationMs}ms`}
          </span>
        )}
      </div>

      {/* Loading state (initial load) */}
      {state.status === 'running' && !state.report && (
        <div className="flex items-center justify-center gap-3 py-16 text-white/40">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-sm">Running security assertions against live system...</span>
        </div>
      )}

      {/* Error state */}
      {state.status === 'error' && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-400 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-semibold text-red-300">Test execution failed</h3>
              <p className="text-xs text-white/50 mt-1">{state.error}</p>
              {state.durationMs !== null && (
                <p className="text-[11px] text-white/30 mt-2">Failed after {state.durationMs}ms</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Results */}
      {state.report && (
        <div className="space-y-6">
          {/* Summary banner */}
          <SummaryBanner
            report={state.report}
            lastRunAt={state.lastRunAt!}
            durationMs={state.durationMs!}
          />

          {/* Category sections */}
          {groupsWithIndex.map(({ category, assertions, startIndex }) => (
            <CategorySection
              key={category}
              category={category}
              assertions={assertions}
              startIndex={startIndex}
            />
          ))}
        </div>
      )}
    </div>
  );
}
