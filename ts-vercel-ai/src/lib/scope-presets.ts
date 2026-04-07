// Scope presets define privacy modes that control which tools the agent can access.
// Each preset gates the LLM's available tools, enforcing least-privilege at the UI layer.

export interface ScopePreset {
  id: string;
  name: string;
  icon: string;
  description: string;
  allowedTools: string[];
  riskThreshold: 'GREEN' | 'AMBER' | 'RED';
  color: string;
}

export const SCOPE_PRESETS: ScopePreset[] = [
  {
    id: 'lockdown',
    name: 'Lockdown',
    icon: 'shield',
    description: 'Maximum privacy — the agent cannot access any external services.',
    allowedTools: [],
    riskThreshold: 'GREEN',
    color: 'red',
  },
  {
    id: 'privacy',
    name: 'Privacy',
    icon: 'lock',
    description: 'Read-only access. The agent can view your data but never modify it.',
    allowedTools: ['gmailSearchTool', 'getCalendarEventsTool', 'getTasksTool', 'getUserInfoTool'],
    riskThreshold: 'GREEN',
    color: 'green',
  },
  {
    id: 'productivity',
    name: 'Productivity',
    icon: 'unlock',
    description: 'Full access including write operations. Write actions use isolated per-call credentials.',
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
    riskThreshold: 'RED',
    color: 'amber',
  },
];

export function getPreset(id: string): ScopePreset | undefined {
  return SCOPE_PRESETS.find((p) => p.id === id);
}

export function getToolNamesForPreset(id: string): string[] {
  const preset = getPreset(id);
  return preset?.allowedTools ?? [];
}
