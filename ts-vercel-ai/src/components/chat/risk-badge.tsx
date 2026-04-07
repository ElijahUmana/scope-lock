'use client';

import { ShieldCheck, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { RiskLevel } from '@/lib/policy-constants';

const RISK_CONFIG: Record<RiskLevel, {
  icon: React.ReactNode;
  label: string;
  className: string;
}> = {
  GREEN: {
    icon: <ShieldCheck className="w-3.5 h-3.5" />,
    label: 'Auto-approved — Read Only',
    className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  AMBER: {
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    label: 'Write Operation — Elevated Access',
    className: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  RED: {
    icon: <ShieldAlert className="w-3.5 h-3.5" />,
    label: 'High Risk — Step-up Auth Required',
    className: 'bg-red-500/15 text-red-300 border-red-500/30',
  },
};

export function RiskBadge({ level }: { level: RiskLevel }) {
  const config = RISK_CONFIG[level];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.className}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}
