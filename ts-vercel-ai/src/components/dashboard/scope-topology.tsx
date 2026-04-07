'use client';

import {
  Mail,
  Calendar,
  ListTodo,
  Search,
  Shield,
} from 'lucide-react';

// --- Topology data types ---

interface TopologyAgent {
  id: string;
  name: string;
  icon: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  dotClass: string;
  lineClass: string;
  active: boolean;
}

interface TopologyTool {
  id: string;
  label: string;
  icon: React.ReactNode;
  scope: string;
  agentId: string;
  serviceId: string;
  riskColor: string;
}

interface TopologyService {
  id: string;
  label: string;
  icon: React.ReactNode;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  active: boolean;
}

// --- Static topology data ---

const AGENTS: TopologyAgent[] = [
  {
    id: 'reader',
    name: 'Reader Agent',
    icon: '\u{1F4D6}',
    colorClass: 'text-emerald-300',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/30',
    dotClass: 'bg-emerald-400',
    lineClass: 'bg-emerald-500/40',
    active: true,
  },
  {
    id: 'writer',
    name: 'Writer Agent',
    icon: '\u{270D}\u{FE0F}',
    colorClass: 'text-amber-300',
    bgClass: 'bg-amber-500/10',
    borderClass: 'border-amber-500/30',
    dotClass: 'bg-amber-400',
    lineClass: 'bg-amber-500/40',
    active: true,
  },
];

const TOOLS: TopologyTool[] = [
  // Reader tools
  {
    id: 'gmailSearch',
    label: 'Gmail',
    icon: <Search className="h-3.5 w-3.5 text-red-400" />,
    scope: 'gmail.readonly',
    agentId: 'reader',
    serviceId: 'google-oauth2',
    riskColor: 'bg-emerald-500/40',
  },
  {
    id: 'calendar',
    label: 'Calendar',
    icon: <Calendar className="h-3.5 w-3.5 text-blue-400" />,
    scope: 'calendar.events',
    agentId: 'reader',
    serviceId: 'google-oauth2',
    riskColor: 'bg-emerald-500/40',
  },
  {
    id: 'tasks',
    label: 'Tasks',
    icon: <ListTodo className="h-3.5 w-3.5 text-green-400" />,
    scope: 'tasks',
    agentId: 'reader',
    serviceId: 'google-oauth2',
    riskColor: 'bg-emerald-500/40',
  },
  // Writer tools
  {
    id: 'gmailDraft',
    label: 'Gmail Draft',
    icon: <Mail className="h-3.5 w-3.5 text-red-400" />,
    scope: 'gmail.compose',
    agentId: 'writer',
    serviceId: 'google-oauth2',
    riskColor: 'bg-amber-500/40',
  },
  {
    id: 'createTask',
    label: 'Create Task',
    icon: <ListTodo className="h-3.5 w-3.5 text-green-400" />,
    scope: 'tasks',
    agentId: 'writer',
    serviceId: 'google-oauth2',
    riskColor: 'bg-amber-500/40',
  },
];

const SERVICES: TopologyService[] = [
  {
    id: 'google-oauth2',
    label: 'Google OAuth2',
    icon: <Shield className="h-4 w-4" />,
    colorClass: 'text-red-300',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/30',
    active: true,
  },
];

// --- Edge label mapping (agent -> tool) ---

const EDGE_LABELS: Record<string, string> = {
  reader: 'read',
  writer: 'write',
};

// --- Component ---

function AgentNode({ agent }: { agent: TopologyAgent }) {
  return (
    <div
      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border ${agent.bgClass} ${agent.borderClass}`}
    >
      <span className="text-base leading-none">{agent.icon}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <span className={`text-sm font-medium ${agent.colorClass}`}>{agent.name}</span>
          <span className={`h-1.5 w-1.5 rounded-full ${agent.active ? agent.dotClass : 'bg-white/20'}`} />
        </div>
        <span className="text-[10px] text-white/40 uppercase tracking-wider">
          {EDGE_LABELS[agent.id]}
        </span>
      </div>
    </div>
  );
}

function ToolNode({ tool }: { tool: TopologyTool }) {
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/5 border border-white/10">
      {tool.icon}
      <span className="text-xs text-white/70">{tool.label}</span>
      <span className="text-[9px] text-white/30 font-mono">{tool.scope}</span>
    </div>
  );
}

function ServiceNode({ service }: { service: TopologyService }) {
  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 rounded-full border ${service.bgClass} ${service.borderClass}`}
    >
      <span className={service.colorClass}>{service.icon}</span>
      <span className={`text-xs font-medium ${service.colorClass}`}>{service.label}</span>
      <span className={`h-1.5 w-1.5 rounded-full ${service.active ? 'bg-emerald-400' : 'bg-white/20'}`} />
    </div>
  );
}

function ConnectionRow({
  agent,
  tool,
  service,
}: {
  agent: TopologyAgent;
  tool: TopologyTool;
  service: TopologyService;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-0">
      {/* Agent */}
      <div className="flex justify-end">
        <AgentNode agent={agent} />
      </div>

      {/* Line: Agent -> Tool */}
      <div className="flex items-center w-8 md:w-12">
        <div className={`h-px flex-1 ${tool.riskColor}`} />
        <div
          className={`h-0 w-0 border-y-[3px] border-y-transparent border-l-[5px] ${
            tool.riskColor === 'bg-emerald-500/40'
              ? 'border-l-emerald-500/60'
              : tool.riskColor === 'bg-amber-500/40'
              ? 'border-l-amber-500/60'
              : 'border-l-red-500/60'
          }`}
        />
      </div>

      {/* Tool */}
      <div className="flex justify-center">
        <ToolNode tool={tool} />
      </div>

      {/* Line: Tool -> Service */}
      <div className="flex items-center w-8 md:w-12">
        <div className={`h-px flex-1 ${tool.riskColor}`} />
        <div
          className={`h-0 w-0 border-y-[3px] border-y-transparent border-l-[5px] ${
            tool.riskColor === 'bg-emerald-500/40'
              ? 'border-l-emerald-500/60'
              : tool.riskColor === 'bg-amber-500/40'
              ? 'border-l-amber-500/60'
              : 'border-l-red-500/60'
          }`}
        />
      </div>

      {/* Service */}
      <div className="flex justify-start">
        <ServiceNode service={service} />
      </div>
    </div>
  );
}

function MobileConnectionRow({
  agent,
  tool,
  service,
}: {
  agent: TopologyAgent;
  tool: TopologyTool;
  service: TopologyService;
}) {
  return (
    <div className="flex flex-col items-center gap-0">
      <AgentNode agent={agent} />
      {/* Vertical line */}
      <div className="flex flex-col items-center">
        <div className={`w-px h-4 ${tool.riskColor}`} />
        <div
          className={`h-0 w-0 border-x-[3px] border-x-transparent border-t-[5px] ${
            tool.riskColor === 'bg-emerald-500/40'
              ? 'border-t-emerald-500/60'
              : tool.riskColor === 'bg-amber-500/40'
              ? 'border-t-amber-500/60'
              : 'border-t-red-500/60'
          }`}
        />
      </div>
      <ToolNode tool={tool} />
      <div className="flex flex-col items-center">
        <div className={`w-px h-4 ${tool.riskColor}`} />
        <div
          className={`h-0 w-0 border-x-[3px] border-x-transparent border-t-[5px] ${
            tool.riskColor === 'bg-emerald-500/40'
              ? 'border-t-emerald-500/60'
              : tool.riskColor === 'bg-amber-500/40'
              ? 'border-t-amber-500/60'
              : 'border-t-red-500/60'
          }`}
        />
      </div>
      <ServiceNode service={service} />
    </div>
  );
}

export default function ScopeTopology() {
  // Build rows by matching agent -> tool -> service
  const rows = TOOLS.map((tool) => ({
    agent: AGENTS.find((a) => a.id === tool.agentId)!,
    tool,
    service: SERVICES.find((s) => s.id === tool.serviceId)!,
  }));

  // Group by agent for visual separation
  const groupedByAgent = AGENTS.map((agent) => ({
    agent,
    connections: rows.filter((r) => r.agent.id === agent.id),
  }));

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-6 text-xs text-white/50">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full bg-emerald-500/40" />
          <span>Read (auto-approve)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-6 rounded-full bg-amber-500/40" />
          <span>Write (warn &amp; proceed)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span>Active</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-white/20" />
          <span>Inactive</span>
        </div>
      </div>

      {/* Desktop layout */}
      <div className="hidden md:block space-y-6">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-0">
          <div className="flex justify-end">
            <span className="text-[10px] text-white/30 uppercase tracking-widest">Agents</span>
          </div>
          <div className="w-8 md:w-12" />
          <div className="flex justify-center">
            <span className="text-[10px] text-white/30 uppercase tracking-widest">Tools / Scopes</span>
          </div>
          <div className="w-8 md:w-12" />
          <div className="flex justify-start">
            <span className="text-[10px] text-white/30 uppercase tracking-widest">Services</span>
          </div>
        </div>

        {groupedByAgent.map((group) => (
          <div key={group.agent.id} className="space-y-2">
            {group.connections.map((conn) => (
              <ConnectionRow
                key={conn.tool.id}
                agent={conn.agent}
                tool={conn.tool}
                service={conn.service}
              />
            ))}
            {/* Separator between agent groups */}
            <div className="border-b border-white/5 last:border-0" />
          </div>
        ))}
      </div>

      {/* Mobile layout */}
      <div className="md:hidden space-y-6">
        {groupedByAgent.map((group) => (
          <div key={group.agent.id} className="space-y-4">
            {group.connections.map((conn) => (
              <MobileConnectionRow
                key={conn.tool.id}
                agent={conn.agent}
                tool={conn.tool}
                service={conn.service}
              />
            ))}
            <div className="border-b border-white/5 last:border-0" />
          </div>
        ))}
      </div>
    </div>
  );
}
