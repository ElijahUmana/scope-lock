'use client';

import { useState } from 'react';
import {
  Shield,
  Lock,
  Unlock,
  Mail,
  Calendar,
  ListTodo,
  User,
  Search,
} from 'lucide-react';

// ─── Data model ─────────────────────────────────────────────────────

interface ToolInfo {
  id: string;
  label: string;
  icon: React.ReactNode;
  riskLevel: 'GREEN' | 'AMBER' | 'RED';
  action: string;
  requiredScopes: string[];
  credentialsContext: 'thread' | 'tool-call';
  connection: string;
}

interface AgentInfo {
  id: string;
  name: string;
  icon: string;
  tools: string[];
  colorClass: string;
  bgClass: string;
  borderClass: string;
}

interface PresetInfo {
  id: string;
  name: string;
  icon: React.ReactNode;
  description: string;
  allowedTools: string[];
  color: string;
}

// ─── Static data ────────────────────────────────────────────────────

const AGENTS: AgentInfo[] = [
  {
    id: 'reader',
    name: 'Reader',
    icon: '\u{1F4D6}',
    tools: ['gmailSearchTool', 'getCalendarEventsTool', 'getTasksTool', 'getUserInfoTool'],
    colorClass: 'text-emerald-300',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
  },
  {
    id: 'writer',
    name: 'Writer',
    icon: '\u{270D}\u{FE0F}',
    tools: ['gmailDraftTool', 'createTasksTool', 'deleteTaskTool', 'completeTaskTool'],
    colorClass: 'text-amber-300',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
  },
];

const TOOLS: ToolInfo[] = [
  {
    id: 'gmailSearchTool',
    label: 'Gmail Search',
    icon: <Search className="h-4 w-4 text-red-400" />,
    riskLevel: 'GREEN',
    action: 'auto-approve',
    requiredScopes: ['gmail.readonly'],
    credentialsContext: 'thread',
    connection: 'google-oauth2',
  },
  {
    id: 'getCalendarEventsTool',
    label: 'Calendar Events',
    icon: <Calendar className="h-4 w-4 text-blue-400" />,
    riskLevel: 'GREEN',
    action: 'auto-approve',
    requiredScopes: ['calendar.events'],
    credentialsContext: 'thread',
    connection: 'google-oauth2',
  },
  {
    id: 'getTasksTool',
    label: 'Get Tasks',
    icon: <ListTodo className="h-4 w-4 text-green-400" />,
    riskLevel: 'GREEN',
    action: 'auto-approve',
    requiredScopes: ['tasks'],
    credentialsContext: 'thread',
    connection: 'google-oauth2',
  },
  {
    id: 'getUserInfoTool',
    label: 'User Info',
    icon: <User className="h-4 w-4 text-cyan-400" />,
    riskLevel: 'GREEN',
    action: 'auto-approve',
    requiredScopes: ['openid'],
    credentialsContext: 'thread',
    connection: 'auth0-session',
  },
  {
    id: 'gmailDraftTool',
    label: 'Gmail Draft',
    icon: <Mail className="h-4 w-4 text-red-400" />,
    riskLevel: 'AMBER',
    action: 'warn-and-proceed',
    requiredScopes: ['gmail.compose'],
    credentialsContext: 'tool-call',
    connection: 'google-oauth2',
  },
  {
    id: 'createTasksTool',
    label: 'Create Task',
    icon: <ListTodo className="h-4 w-4 text-green-400" />,
    riskLevel: 'AMBER',
    action: 'warn-and-proceed',
    requiredScopes: ['tasks'],
    credentialsContext: 'tool-call',
    connection: 'google-oauth2',
  },
  {
    id: 'deleteTaskTool',
    label: 'Delete Task',
    icon: <ListTodo className="h-4 w-4 text-green-400" />,
    riskLevel: 'AMBER',
    action: 'warn-and-proceed',
    requiredScopes: ['tasks'],
    credentialsContext: 'tool-call',
    connection: 'google-oauth2',
  },
  {
    id: 'completeTaskTool',
    label: 'Complete Task',
    icon: <ListTodo className="h-4 w-4 text-green-400" />,
    riskLevel: 'AMBER',
    action: 'warn-and-proceed',
    requiredScopes: ['tasks'],
    credentialsContext: 'tool-call',
    connection: 'google-oauth2',
  },
];

const PRESETS: PresetInfo[] = [
  {
    id: 'lockdown',
    name: 'Lockdown',
    icon: <Shield className="h-4 w-4" />,
    description: 'Maximum privacy -- no external service access',
    allowedTools: [],
    color: 'red',
  },
  {
    id: 'privacy',
    name: 'Privacy',
    icon: <Lock className="h-4 w-4" />,
    description: 'Read-only access -- view data but never modify',
    allowedTools: ['gmailSearchTool', 'getCalendarEventsTool', 'getTasksTool', 'getUserInfoTool'],
    color: 'green',
  },
  {
    id: 'productivity',
    name: 'Productivity',
    icon: <Unlock className="h-4 w-4" />,
    description: 'Full access including write operations',
    allowedTools: [
      'gmailSearchTool',
      'getCalendarEventsTool',
      'getTasksTool',
      'getUserInfoTool',
      'gmailDraftTool',
      'createTasksTool',
      'deleteTaskTool',
      'completeTaskTool',
    ],
    color: 'amber',
  },
];

// ─── Risk level styling ─────────────────────────────────────────────

const RISK_STYLES: Record<string, { bg: string; text: string; border: string; label: string }> = {
  GREEN: {
    bg: 'bg-emerald-500/15',
    text: 'text-emerald-400',
    border: 'border-emerald-500/30',
    label: 'LOW',
  },
  AMBER: {
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
    label: 'MEDIUM',
  },
  RED: {
    bg: 'bg-red-500/15',
    text: 'text-red-400',
    border: 'border-red-500/30',
    label: 'HIGH',
  },
};

// ─── Cell component ─────────────────────────────────────────────────

function MatrixCell({
  tool,
  agent,
  isBlockedByPreset,
}: {
  tool: ToolInfo;
  agent: AgentInfo;
  isBlockedByPreset: boolean;
}) {
  const isAllowed = agent.tools.includes(tool.id);

  // Determine cell status
  let status: 'allowed-green' | 'allowed-amber' | 'blocked';
  if (!isAllowed) {
    status = 'blocked';
  } else if (tool.riskLevel === 'GREEN') {
    status = 'allowed-green';
  } else {
    status = 'allowed-amber';
  }

  const cellStyles = {
    'allowed-green': {
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      hoverBg: 'hover:bg-emerald-500/20',
    },
    'allowed-amber': {
      bg: tool.riskLevel === 'RED' ? 'bg-red-500/10' : 'bg-amber-500/10',
      border: tool.riskLevel === 'RED' ? 'border-red-500/20' : 'border-amber-500/20',
      hoverBg: tool.riskLevel === 'RED' ? 'hover:bg-red-500/20' : 'hover:bg-amber-500/20',
    },
    blocked: {
      bg: 'bg-white/[0.02]',
      border: 'border-white/5',
      hoverBg: 'hover:bg-white/[0.04]',
    },
  };

  const style = cellStyles[status];

  // Tooltip content
  let tooltipText: string;
  if (!isAllowed) {
    tooltipText = `${tool.label}: Blocked -- outside ${agent.name} Agent boundaries`;
  } else if (isBlockedByPreset) {
    tooltipText = `${tool.label}: Blocked by active scope preset`;
  } else if (tool.riskLevel === 'GREEN') {
    tooltipText = `${tool.label}: Auto-approved, read-only, ${tool.credentialsContext}-scoped credentials`;
  } else if (tool.riskLevel === 'AMBER') {
    tooltipText = `${tool.label}: Warned, write operation, per-call credential isolation`;
  } else {
    tooltipText = `${tool.label}: Requires CIBA step-up authentication via mobile push`;
  }

  return (
    <td className="p-0">
      <div
        className={`relative group border ${style.border} ${style.bg} ${style.hoverBg} transition-colors m-0.5 rounded-md`}
        title={tooltipText}
      >
        <div className="flex items-center justify-center h-14">
          {!isAllowed ? (
            <span className="text-lg text-red-400/80 select-none">&#10060;</span>
          ) : tool.riskLevel === 'GREEN' ? (
            <span className="text-lg text-emerald-400 select-none">&#9989;</span>
          ) : tool.riskLevel === 'AMBER' ? (
            <span className="text-lg text-amber-400 select-none">&#9888;&#65039;</span>
          ) : (
            <span className="text-lg text-red-400 select-none">&#9888;&#65039;</span>
          )}

          {/* Preset lock overlay */}
          {isAllowed && isBlockedByPreset && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-md">
              <span className="text-lg select-none">&#128274;</span>
            </div>
          )}
        </div>

        {/* Hover tooltip */}
        <div className="invisible group-hover:visible absolute z-20 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-black/95 border border-white/10 text-xs text-white/90 whitespace-normal max-w-[200px] md:whitespace-nowrap md:max-w-none shadow-xl pointer-events-none">
          {tooltipText}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
            <div className="border-4 border-transparent border-t-black/95" />
          </div>
        </div>
      </div>
    </td>
  );
}

// ─── Tool detail row ────────────────────────────────────────────────

function ToolDetailRow({ tool }: { tool: ToolInfo }) {
  const risk = RISK_STYLES[tool.riskLevel];
  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="py-3 px-4">
        <div className="flex items-center gap-2">
          {tool.icon}
          <span className="text-sm text-white/80 font-medium">{tool.label}</span>
        </div>
      </td>
      <td className="py-3 px-4">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono ${risk.bg} ${risk.text} ${risk.border} border`}>
          {risk.label}
        </span>
      </td>
      <td className="py-3 px-4">
        <div className="flex flex-wrap gap-1">
          {tool.requiredScopes.map((scope) => (
            <span
              key={scope}
              className="px-2 py-0.5 rounded text-[11px] font-mono bg-white/5 text-white/60 border border-white/10"
            >
              {scope}
            </span>
          ))}
        </div>
      </td>
      <td className="py-3 px-4">
        <span
          className={`text-xs font-mono ${
            tool.credentialsContext === 'thread' ? 'text-emerald-400/70' : 'text-amber-400/70'
          }`}
        >
          {tool.credentialsContext}
        </span>
      </td>
      <td className="py-3 px-4">
        <span className="text-xs text-white/50 font-mono">{tool.connection}</span>
      </td>
    </tr>
  );
}

// ─── Main component ─────────────────────────────────────────────────

export default function ScopeMatrix() {
  const [activePreset, setActivePreset] = useState<string>('productivity');

  const currentPreset = PRESETS.find((p) => p.id === activePreset);

  return (
    <div className="space-y-6 md:space-y-8 pb-8 md:pb-12">
      {/* ── Preset toggle ── */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 md:p-5">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-5 w-5 text-white/40" />
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Scope Preset</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          {PRESETS.map((preset) => {
            const isActive = activePreset === preset.id;
            const colorMap: Record<string, string> = {
              red: isActive
                ? 'bg-red-500/20 border-red-500/50 text-red-300'
                : 'bg-white/[0.03] border-white/10 text-white/50 hover:bg-white/[0.06] hover:border-white/20',
              green: isActive
                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                : 'bg-white/[0.03] border-white/10 text-white/50 hover:bg-white/[0.06] hover:border-white/20',
              amber: isActive
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-white/[0.03] border-white/10 text-white/50 hover:bg-white/[0.06] hover:border-white/20',
            };
            return (
              <button
                key={preset.id}
                onClick={() => setActivePreset(preset.id)}
                className={`flex items-center gap-2 px-3 md:px-4 py-2.5 rounded-lg border transition-all cursor-pointer min-h-[44px] ${colorMap[preset.color]}`}
              >
                {preset.icon}
                <div className="text-left min-w-0">
                  <div className="text-sm font-medium">{preset.name}</div>
                  <div className="text-[11px] text-white/40 hidden sm:block">{preset.description}</div>
                </div>
              </button>
            );
          })}
        </div>
        {currentPreset && (
          <div className="mt-3 text-xs text-white/40 flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/30" />
            Active: <span className="text-white/60 font-medium">{currentPreset.name}</span>
            &mdash; {currentPreset.allowedTools.length === 0
              ? 'all tools blocked'
              : currentPreset.allowedTools.length === TOOLS.length
                ? 'all tools permitted'
                : `${currentPreset.allowedTools.length} of ${TOOLS.length} tools permitted`}
          </div>
        )}
      </div>

      {/* ── Authorization matrix ── */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="p-4 md:p-5 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Authorization Matrix</h2>
          <p className="text-xs text-white/40 mt-1">
            Each cell shows whether an agent can invoke a tool. Hover for details.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left p-4 text-[10px] text-white/30 uppercase tracking-widest font-normal w-48">
                  Tool
                </th>
                {AGENTS.map((agent) => (
                  <th key={agent.id} className="p-4 text-center min-w-[120px]">
                    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${agent.bgClass} ${agent.borderClass}`}>
                      <span className="text-base leading-none">{agent.icon}</span>
                      <span className={`text-sm font-medium ${agent.colorClass}`}>{agent.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOOLS.map((tool) => {
                const risk = RISK_STYLES[tool.riskLevel];
                return (
                  <tr key={tool.id} className="border-b border-white/5 last:border-0">
                    <td className="p-4">
                      <div className="flex items-center gap-2.5">
                        <div className={`shrink-0 rounded-md p-1.5 ${risk.bg}`}>
                          {tool.icon}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm text-white/80 font-medium truncate">{tool.label}</div>
                          <div className={`text-[10px] font-mono ${risk.text}`}>{tool.riskLevel}</div>
                        </div>
                      </div>
                    </td>
                    {AGENTS.map((agent) => {
                      const isBlockedByPreset =
                        currentPreset != null && !currentPreset.allowedTools.includes(tool.id);
                      return (
                        <MatrixCell
                          key={agent.id}
                          tool={tool}
                          agent={agent}
                          isBlockedByPreset={isBlockedByPreset}
                        />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Tool details table ── */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] overflow-hidden">
        <div className="p-4 md:p-5 border-b border-white/10">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider">Tool Details</h2>
          <p className="text-xs text-white/40 mt-1">
            Risk level, required scopes, credential lifecycle, and OAuth connection for each tool
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-white/10">
                <th className="text-left py-3 px-4 text-[10px] text-white/30 uppercase tracking-widest font-normal">Tool</th>
                <th className="text-left py-3 px-4 text-[10px] text-white/30 uppercase tracking-widest font-normal">Risk Level</th>
                <th className="text-left py-3 px-4 text-[10px] text-white/30 uppercase tracking-widest font-normal">Required Scopes</th>
                <th className="text-left py-3 px-4 text-[10px] text-white/30 uppercase tracking-widest font-normal">Credential Context</th>
                <th className="text-left py-3 px-4 text-[10px] text-white/30 uppercase tracking-widest font-normal">Connection</th>
              </tr>
            </thead>
            <tbody>
              {TOOLS.map((tool) => (
                <ToolDetailRow key={tool.id} tool={tool} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Legend ── */}
      <div className="rounded-lg border border-white/10 bg-white/[0.02] p-4 md:p-5">
        <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3 md:mb-4">Legend</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
            <span className="text-lg leading-none mt-0.5 select-none">&#9989;</span>
            <div>
              <div className="text-xs font-semibold text-emerald-400">GREEN</div>
              <div className="text-[11px] text-white/50 mt-0.5">Auto-approved, read-only, thread-scoped credentials</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
            <span className="text-lg leading-none mt-0.5 select-none">&#9888;&#65039;</span>
            <div>
              <div className="text-xs font-semibold text-amber-400">AMBER</div>
              <div className="text-[11px] text-white/50 mt-0.5">Warned, write operation, per-call credential isolation</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
            <span className="text-lg leading-none mt-0.5 select-none">&#10060;</span>
            <div>
              <div className="text-xs font-semibold text-red-400">RED / BLOCKED</div>
              <div className="text-[11px] text-white/50 mt-0.5">Blocked by agent boundaries OR requires CIBA step-up</div>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/10">
            <span className="text-lg leading-none mt-0.5 select-none">&#128274;</span>
            <div>
              <div className="text-xs font-semibold text-white/70">PRESET LOCK</div>
              <div className="text-[11px] text-white/50 mt-0.5">Blocked by the active scope preset overlay</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
