'use client';

import { useState } from 'react';
import {
  AlertTriangle,
  ShieldAlert,
  Zap,
  Radio,
  Eye,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { AnomalyAlert } from '@/lib/anomaly-detection';

const SEVERITY_STYLES: Record<
  AnomalyAlert['severity'],
  { bg: string; border: string; icon: string; badge: string }
> = {
  low: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    icon: 'text-blue-400',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  medium: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: 'text-amber-400',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  high: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'text-red-400',
    badge: 'bg-red-500/20 text-red-300 border-red-500/30',
  },
};

const TYPE_ICONS: Record<AnomalyAlert['type'], React.ReactNode> = {
  RAPID_ESCALATION: <Zap className="h-4 w-4" />,
  HIGH_FREQUENCY: <Radio className="h-4 w-4" />,
  SCOPE_HOPPING: <ShieldAlert className="h-4 w-4" />,
  UNUSUAL_SCOPE: <Eye className="h-4 w-4" />,
};

const TYPE_LABELS: Record<AnomalyAlert['type'], string> = {
  RAPID_ESCALATION: 'Rapid Escalation',
  HIGH_FREQUENCY: 'High Frequency',
  SCOPE_HOPPING: 'Scope Hopping',
  UNUSUAL_SCOPE: 'Unusual Scope',
};

interface AnomalyAlertsProps {
  alerts: AnomalyAlert[];
}

export default function AnomalyAlerts({ alerts }: AnomalyAlertsProps) {
  const [dismissedTimestamps, setDismissedTimestamps] = useState<Set<string>>(new Set());

  const visibleAlerts = alerts.filter((a) => !dismissedTimestamps.has(a.timestamp + a.type));

  const handleDismiss = (alert: AnomalyAlert) => {
    setDismissedTimestamps((prev) => {
      const next = new Set(prev);
      next.add(alert.timestamp + alert.type);
      return next;
    });
  };

  if (visibleAlerts.length === 0) return null;

  // Sort by severity (high first), then by timestamp (newest first)
  const SEVERITY_ORDER: Record<AnomalyAlert['severity'], number> = { high: 0, medium: 1, low: 2 };
  const sorted = [...visibleAlerts].sort((a, b) => {
    const sevDiff = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sevDiff !== 0) return sevDiff;
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-amber-400" />
        <h2 className="text-lg font-semibold text-white">Anomaly Alerts</h2>
        <span className="text-xs text-white/40">
          {visibleAlerts.length} active
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {sorted.map((alert) => {
          const style = SEVERITY_STYLES[alert.severity];
          return (
            <div
              key={alert.timestamp + alert.type}
              className={`relative p-4 rounded-lg border ${style.bg} ${style.border} transition-all`}
            >
              {/* Dismiss button */}
              <button
                onClick={() => handleDismiss(alert)}
                className="absolute top-3 right-3 p-1 rounded-md text-white/30 hover:text-white/60 hover:bg-white/10 transition-colors"
                aria-label="Dismiss alert"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              <div className="flex items-start gap-3 pr-8">
                {/* Icon */}
                <div className={`mt-0.5 ${style.icon}`}>
                  {TYPE_ICONS[alert.type]}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium uppercase tracking-wider ${style.badge}`}>
                      {alert.severity}
                    </span>
                    <span className="text-xs font-medium text-white/70">
                      {TYPE_LABELS[alert.type]}
                    </span>
                  </div>

                  <p className="text-sm text-white/80 leading-relaxed">
                    {alert.message}
                  </p>

                  <span className="text-[10px] text-white/40 mt-1.5 block">
                    {formatDistanceToNow(new Date(alert.timestamp), { addSuffix: true })}
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
