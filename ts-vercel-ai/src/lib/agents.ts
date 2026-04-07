export interface AgentProfile {
  id: string;
  name: string;
  description: string;
  icon: string;
  tools: string[];
  riskLevel: 'low' | 'medium' | 'high';
  credentialsContext: 'thread' | 'tool-call';
  systemPromptAddition: string;
  canDelegateTo: string[];
  cannotAccess: string[];
}

export const AGENT_PROFILES: AgentProfile[] = [
  {
    id: 'reader',
    name: 'Reader Agent',
    description: 'I can read your emails, calendar, and tasks. I never modify anything.',
    icon: '📖',
    tools: ['gmailSearchTool', 'getCalendarEventsTool', 'getTasksTool', 'getUserInfoTool'],
    riskLevel: 'low',
    credentialsContext: 'thread',
    systemPromptAddition:
      'You are the READER agent. You have READ-ONLY access. You can search Gmail, view calendar events, list tasks, and retrieve user profile info. You CANNOT create drafts or create tasks. If the user asks you to write or modify anything, explain that they need to switch to the Writer agent.',
    canDelegateTo: ['writer'],
    cannotAccess: ['gmailDraftTool', 'createTasksTool', 'deleteTaskTool', 'completeTaskTool'],
  },
  {
    id: 'writer',
    name: 'Writer Agent',
    description: 'I can create drafts and tasks on your behalf. Each write operation uses isolated credentials.',
    icon: '✍️',
    tools: ['gmailDraftTool', 'createTasksTool', 'deleteTaskTool', 'completeTaskTool'],
    riskLevel: 'medium',
    credentialsContext: 'tool-call',
    systemPromptAddition:
      'You are the WRITER agent. You can create Gmail drafts and Google Tasks. Each write operation uses isolated, per-tool-call credentials. You CANNOT read emails or view calendars. If the user asks to read data, explain that they need to switch to the Reader agent.',
    canDelegateTo: [],
    cannotAccess: ['gmailSearchTool', 'getCalendarEventsTool', 'getTasksTool'],
  },
];

export function getAgentProfile(id: string): AgentProfile | undefined {
  return AGENT_PROFILES.find((a) => a.id === id);
}

export function getToolsForAgent(id: string): string[] {
  const profile = getAgentProfile(id);
  return profile?.tools ?? [];
}
