import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getDelegationChain, getAgentSession } from '@/lib/agent-orchestrator';

export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.sub;
  const chain = getDelegationChain(userId);
  const agentSession = getAgentSession(userId);

  return NextResponse.json({ chain, session: agentSession });
}
