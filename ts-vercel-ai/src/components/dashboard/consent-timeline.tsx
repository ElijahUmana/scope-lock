'use client';

import {
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Timer,
  Shield,
  Eye,
  Unlock,
  ShieldAlert,
  Lock,
  Mail,
  GitBranch,
  MessageSquare,
  Globe,
  ShieldCheck,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

import type { ScopeRequest } from '@/lib/actions/audit';

// --- Event type styling ---

type EventType = 'granted' | 'denied' | 'pending' | 'revoked' | 'expired';

interface EventStyle {
  dotColor: string;
  dotBorder: string;
  badgeBg: string;
  badgeText: string;
  icon: React.ReactNode;
  label: string;
}

const EVENT_STYLES: Record<EventType, EventStyle> = {
  granted: {
    dotColor: 'bg-emerald-400',
    dotBorder: 'border-emerald-500/40',
    badgeBg: 'bg-emerald-500/20',
    badgeText: 'text-emerald-300',
    icon: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />,
    label: 'GRANTED',
  },
  denied: {
    dotColor: 'bg-red-400',
    dotBorder: 'border-red-500/40',
    badgeBg: 'bg-red-500/20',
    badgeText: 'text-red-300',
    icon: <XCircle className="h-3.5 w-3.5 text-red-400" />,
    label: 'DENIED',
  },
  pending: {
    dotColor: 'bg-amber-400',
    dotBorder: 'border-amber-500/40',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    icon: <Clock className="h-3.5 w-3.5 text-amber-400" />,
    label: 'PENDING',
  },
  revoked: {
    dotColor: 'bg-zinc-400',
    dotBorder: 'border-zinc-500/40',
    badgeBg: 'bg-zinc-500/20',
    badgeText: 'text-zinc-300',
    icon: <Ban className="h-3.5 w-3.5 text-zinc-400" />,
    label: 'REVOKED',
  },
  expired: {
    dotColor: 'bg-amber-400',
    dotBorder: 'border-amber-500/40',
    badgeBg: 'bg-amber-500/20',
    badgeText: 'text-amber-300',
    icon: <Timer className="h-3.5 w-3.5 text-amber-400" />,
    label: 'EXPIRED',
  },
};

// --- Service metadata ---

interface ServiceMeta {
  label: string;
  icon: React.ReactNode;
  color: string;
}

const SERVICE_MAP: Record<string, ServiceMeta> = {
  'google-oauth2': {
    label: 'Google',
    icon: <Mail className="h-4 w-4" />,
    color: 'text-red-400',
  },
  github: {
    label: 'GitHub',
    icon: <GitBranch className="h-4 w-4" />,
    color: 'text-purple-400',
  },
  'sign-in-with-slack': {
    label: 'Slack',
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'text-emerald-400',
  },
  slack: {
    label: 'Slack',
    icon: <MessageSquare className="h-4 w-4" />,
    color: 'text-emerald-400',
  },
  auth0: {
    label: 'Auth0',
    icon: <Shield className="h-4 w-4" />,
    color: 'text-orange-400',
  },
  ciba: {
    label: 'Step-Up Auth',
    icon: <ShieldCheck className="h-4 w-4" />,
    color: 'text-cyan-400',
  },
};

function getServiceMeta(connection: string): ServiceMeta {
  return (
    SERVICE_MAP[connection] || {
      label: connection,
      icon: <Globe className="h-4 w-4" />,
      color: 'text-blue-400',
    }
  );
}

// --- Agent inference from connection + scopes ---

const TOOL_AGENT_MAP: Record<string, { agent: string; icon: string }> = {
  'gmail.readonly': { agent: 'Reader Agent', icon: '\u{1F4D6}' },
  'calendar.events': { agent: 'Reader Agent', icon: '\u{1F4D6}' },
  tasks: { agent: 'Reader Agent', icon: '\u{1F4D6}' },
  'gmail.compose': { agent: 'Writer Agent', icon: '\u{270D}\u{FE0F}' },
  'product:buy': { agent: 'Commerce Agent', icon: '\u{1F6D2}' },
};

function inferAgent(scopes: string[]): { agent: string; icon: string } | null {
  for (const scope of scopes) {
    const shortScope = scope.startsWith('https://www.googleapis.com/auth/')
      ? scope.replace('https://www.googleapis.com/auth/', '')
      : scope;
    if (TOOL_AGENT_MAP[shortScope]) {
      return TOOL_AGENT_MAP[shortScope];
    }
  }
  return null;
}

// --- Scope classification (matching dashboard-content.tsx pattern) ---

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

function formatScopeLabel(scope: string): string {
  if (scope.startsWith('https://www.googleapis.com/auth/')) {
    return scope.replace('https://www.googleapis.com/auth/', '');
  }
  return scope;
}

// --- Timeline event card ---

function TimelineEvent({
  request,
  position,
}: {
  request: ScopeRequest;
  position: 'left' | 'right';
}) {
  const eventType = request.status as EventType;
  const style = EVENT_STYLES[eventType] || EVENT_STYLES.pending;
  const service = getServiceMeta(request.connection);
  const agent = inferAgent(request.scopes);
  const timestamp = new Date(request.requestedAt);

  return (
    <div
      className={`relative flex items-start gap-0 ${
        position === 'left' ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      {/* Card */}
      <div
        className={`w-[calc(50%-24px)] p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors ${
          position === 'left' ? 'mr-6' : 'ml-6'
        }`}
      >
        {/* Header: event type badge + timestamp */}
        <div className="flex items-center justify-between mb-2.5">
          <span
            className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase tracking-wider ${style.badgeBg} ${style.badgeText}`}
          >
            {style.icon}
            {style.label}
          </span>
          <span
            className="text-[10px] text-white/35"
            title={format(timestamp, 'PPpp')}
          >
            {formatDistanceToNow(timestamp, { addSuffix: true })}
          </span>
        </div>

        {/* Service + connection type */}
        <div className="flex items-center gap-2 mb-2">
          <span className={service.color}>{service.icon}</span>
          <span className={`text-sm font-medium ${service.color}`}>
            {service.label}
          </span>
          <span className="text-[10px] text-white/30 font-mono">
            {request.connection}
          </span>
        </div>

        {/* Scope badges */}
        <div className="flex flex-wrap gap-1 mb-2">
          {request.scopes.map((scope) => {
            const level = classifyScope(scope);
            return (
              <span
                key={scope}
                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${SCOPE_BADGE_STYLES[level]}`}
                title={scope}
              >
                {level === 'read' && <Eye className="h-2.5 w-2.5" />}
                {level === 'write' && <Unlock className="h-2.5 w-2.5" />}
                {level === 'admin' && <ShieldAlert className="h-2.5 w-2.5" />}
                {level === 'other' && <Lock className="h-2.5 w-2.5" />}
                {formatScopeLabel(scope)}
              </span>
            );
          })}
        </div>

        {/* Agent info */}
        {agent && (
          <div className="flex items-center gap-1.5 text-[10px] text-white/40">
            <span>{agent.icon}</span>
            <span>{agent.agent}</span>
          </div>
        )}

        {/* Granted timestamp (if different from requested) */}
        {request.grantedAt && (
          <div className="mt-1.5 text-[10px] text-white/30">
            Approved {format(new Date(request.grantedAt), 'HH:mm:ss')}
          </div>
        )}
      </div>

      {/* Spacer for the dot (positioned via the timeline line) */}
      <div className="w-0 flex-shrink-0" />

      {/* Empty space on the opposite side */}
      <div className="w-[calc(50%-24px)]" />
    </div>
  );
}

// --- Mobile timeline event (single column) ---

function MobileTimelineEvent({ request }: { request: ScopeRequest }) {
  const eventType = request.status as EventType;
  const style = EVENT_STYLES[eventType] || EVENT_STYLES.pending;
  const service = getServiceMeta(request.connection);
  const agent = inferAgent(request.scopes);
  const timestamp = new Date(request.requestedAt);

  return (
    <div className="relative flex items-start gap-4 pl-1">
      {/* Timeline dot */}
      <div
        className={`relative z-10 flex-shrink-0 w-[30px] h-[30px] rounded-full flex items-center justify-center border ${style.dotColor}/20 ${style.dotBorder}`}
        style={{ backgroundColor: `color-mix(in srgb, currentColor 10%, transparent)` }}
      >
        {style.icon}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span
            className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wider ${style.badgeBg} ${style.badgeText}`}
          >
            {style.label}
          </span>
          <span
            className="text-[10px] text-white/35"
            title={format(timestamp, 'PPpp')}
          >
            {formatDistanceToNow(timestamp, { addSuffix: true })}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-1.5">
          <span className={service.color}>{service.icon}</span>
          <span className={`text-sm font-medium ${service.color}`}>
            {service.label}
          </span>
        </div>

        <div className="flex flex-wrap gap-1 mb-1.5">
          {request.scopes.map((scope) => {
            const level = classifyScope(scope);
            return (
              <span
                key={scope}
                className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${SCOPE_BADGE_STYLES[level]}`}
                title={scope}
              >
                {level === 'read' && <Eye className="h-2.5 w-2.5" />}
                {level === 'write' && <Unlock className="h-2.5 w-2.5" />}
                {level === 'admin' && <ShieldAlert className="h-2.5 w-2.5" />}
                {level === 'other' && <Lock className="h-2.5 w-2.5" />}
                {formatScopeLabel(scope)}
              </span>
            );
          })}
        </div>

        {agent && (
          <div className="flex items-center gap-1.5 text-[10px] text-white/40">
            <span>{agent.icon}</span>
            <span>{agent.agent}</span>
          </div>
        )}

        {request.grantedAt && (
          <div className="mt-1 text-[10px] text-white/30">
            Approved {format(new Date(request.grantedAt), 'HH:mm:ss')}
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main component ---

export default function ConsentTimeline({
  scopeRequests,
}: {
  scopeRequests: ScopeRequest[];
}) {
  if (scopeRequests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="p-3 rounded-full bg-white/5 mb-4">
          <Shield className="h-8 w-8 text-white/20" />
        </div>
        <p className="text-white/40 text-sm mb-1">No consent events yet</p>
        <p className="text-white/30 text-xs max-w-[300px]">
          Start chatting with an agent to see authorization decisions appear
          here.
        </p>
      </div>
    );
  }

  // Sort chronologically (newest first -- already comes that way from fetchScopeRequests)
  const events = scopeRequests;

  return (
    <div>
      {/* Summary stats */}
      <div className="flex flex-wrap gap-4 mb-6">
        {(['granted', 'denied', 'pending'] as const).map((type) => {
          const count = events.filter((e) => e.status === type).length;
          if (count === 0) return null;
          const style = EVENT_STYLES[type];
          return (
            <div key={type} className="flex items-center gap-2 text-xs">
              <span
                className={`h-2 w-2 rounded-full ${style.dotColor}`}
              />
              <span className="text-white/50">
                {count} {style.label.toLowerCase()}
              </span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 text-xs">
          <span className="text-white/30">
            {events.length} total event{events.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Desktop timeline: alternating left/right with vertical line */}
      <div className="hidden md:block relative">
        {/* Vertical center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-white/10 -translate-x-px" />

        <div className="space-y-6">
          {events.map((request, index) => {
            const style =
              EVENT_STYLES[request.status as EventType] ||
              EVENT_STYLES.pending;
            return (
              <div key={request.id} className="relative">
                {/* Center dot on the vertical line */}
                <div className="absolute left-1/2 top-4 -translate-x-1/2 z-10">
                  <div
                    className={`h-3 w-3 rounded-full border-2 ${style.dotColor} ${style.dotBorder}`}
                  />
                </div>

                <TimelineEvent
                  request={request}
                  position={index % 2 === 0 ? 'left' : 'right'}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile timeline: single column with vertical line */}
      <div className="md:hidden relative">
        <div className="absolute left-[15px] top-0 bottom-0 w-px bg-white/10" />
        <div className="space-y-2">
          {events.map((request) => (
            <MobileTimelineEvent key={request.id} request={request} />
          ))}
        </div>
      </div>
    </div>
  );
}
