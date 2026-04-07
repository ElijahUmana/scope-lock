'use client';

import { useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';

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

const CATEGORY_META: Record<
  SecurityAssertion['category'],
  { label: string; description: string }
> = {
  isolation: { label: 'Isolation', description: 'Agent tool boundary enforcement' },
  policy: { label: 'Policy', description: 'Risk-tier classification rules' },
  credential: { label: 'Credential', description: 'Credential lifecycle scoping' },
  audit: { label: 'Audit', description: 'Audit trail functionality' },
};

const CATEGORY_ORDER: SecurityAssertion['category'][] = [
  'isolation',
  'policy',
  'credential',
  'audit',
];

function AssertionCard({ assertion }: { assertion: SecurityAssertion }) {
  return (
    <div
      className={`rounded-lg border p-4 transition-colors ${
        assertion.passed
          ? 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10'
          : 'border-red-500/20 bg-red-500/5 hover:bg-red-500/10'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`shrink-0 mt-0.5 ${
            assertion.passed ? 'text-emerald-400' : 'text-red-400'
          }`}
        >
          {assertion.passed ? (
            <ShieldCheck className="h-5 w-5" />
          ) : (
            <ShieldAlert className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-medium text-white">{assertion.name}</h4>
          <p className="mt-1 text-xs leading-relaxed text-white/50">
            {assertion.details}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SecurityTestResults() {
  const [report, setReport] = useState<SecurityTestReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchResults() {
      try {
        const res = await fetch('/api/security-test');
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }
        const data: SecurityTestReport = await res.json();
        if (!cancelled) {
          setReport(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch security test results');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchResults();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-16 text-white/40">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-sm">Running security assertions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-5 w-5 text-red-400" />
          <p className="text-sm text-red-300">Failed to run security tests: {error}</p>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    meta: CATEGORY_META[category],
    assertions: report.assertions.filter((a) => a.category === category),
  })).filter((g) => g.assertions.length > 0);

  const allPassed = report.failed === 0;

  return (
    <div className="space-y-8">
      {/* Summary banner */}
      <div
        className={`rounded-lg border p-5 ${
          allPassed
            ? 'border-emerald-500/20 bg-emerald-500/5'
            : 'border-red-500/20 bg-red-500/5'
        }`}
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
                {allPassed ? 'All Security Assertions Passed' : 'Security Assertion Failures Detected'}
              </h3>
              <p className="text-xs text-white/50 mt-0.5">
                {report.passed} passed, {report.failed} failed out of {report.total} total
              </p>
            </div>
          </div>
          <div
            className={`rounded-full px-3 py-1 text-xs font-mono font-semibold ${
              allPassed
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-400 border border-red-500/20'
            }`}
          >
            {report.passed}/{report.total}
          </div>
        </div>
      </div>

      {/* Grouped assertion cards */}
      {grouped.map(({ category, meta, assertions }) => (
        <section key={category}>
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-white">{meta.label}</h3>
            <p className="text-xs text-white/40">{meta.description}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {assertions.map((assertion) => (
              <AssertionCard key={assertion.name} assertion={assertion} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
