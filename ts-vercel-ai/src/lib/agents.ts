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
    tools: ['gmailSearchTool', 'getCalendarEventsTool', 'getTasksTool', 'getUserInfoTool', 'listRepositories', 'listGitHubEvents'],
    riskLevel: 'low',
    credentialsContext: 'thread',
    systemPromptAddition:
      'You are the READER agent. You have READ-ONLY access. You can search Gmail, view calendar events, list tasks, retrieve user profile info, list GitHub repositories, and view GitHub activity. You CANNOT create drafts, create tasks, or make purchases. If the user asks you to write or modify anything, explain that they need to switch to the Writer or Commerce agent.',
    canDelegateTo: ['writer'],
    cannotAccess: ['gmailDraftTool', 'createTasksTool', 'shopOnlineTool'],
  },
  {
    id: 'writer',
    name: 'Writer Agent',
    description: 'I can create drafts and tasks on your behalf. Each write operation uses isolated credentials.',
    icon: '✍️',
    tools: ['gmailDraftTool', 'createTasksTool'],
    riskLevel: 'medium',
    credentialsContext: 'tool-call',
    systemPromptAddition:
      'You are the WRITER agent. You can create Gmail drafts and Google Tasks. Each write operation uses isolated, per-tool-call credentials. You CANNOT read emails, view calendars, or make purchases. If the user asks to read data or shop, explain that they need to switch to the Reader or Commerce agent.',
    canDelegateTo: ['commerce'],
    cannotAccess: ['gmailSearchTool', 'getCalendarEventsTool', 'getTasksTool', 'shopOnlineTool', 'listRepositories', 'listGitHubEvents'],
  },
  {
    id: 'commerce',
    name: 'Commerce Agent',
    description: 'I handle purchases and financial transactions. Every action requires explicit step-up authentication via mobile push.',
    icon: '🛒',
    tools: ['shopOnlineTool'],
    riskLevel: 'high',
    credentialsContext: 'tool-call',
    systemPromptAddition:
      'You are the COMMERCE agent. You handle purchases and financial transactions via the shopOnlineTool. Every action requires explicit step-up authentication via CIBA mobile push notification. You CANNOT read emails, view calendars, create drafts, or manage tasks. If the user asks for non-commerce actions, explain that they need to switch to the Reader or Writer agent.',
    canDelegateTo: [],
    cannotAccess: ['gmailSearchTool', 'gmailDraftTool', 'getCalendarEventsTool', 'getTasksTool', 'createTasksTool', 'listRepositories', 'listGitHubEvents'],
  },
];

export function getAgentProfile(id: string): AgentProfile | undefined {
  return AGENT_PROFILES.find((a) => a.id === id);
}

export function getToolsForAgent(id: string): string[] {
  const profile = getAgentProfile(id);
  return profile?.tools ?? [];
}
