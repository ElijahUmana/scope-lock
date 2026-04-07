import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getDelegationChain, getAgentSession } from '@/lib/agent-orchestrator';
import { seedDemoData } from '@/lib/demo-data';

export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.sub;
  let chain = getDelegationChain(userId);

  // Auto-seed demo data after a cold start so delegation chain is never empty
  if (chain.length === 0) {
    await seedDemoData(userId);
    chain = getDelegationChain(userId);
  }

  const agentSession = getAgentSession(userId);

  return NextResponse.json({ chain, session: agentSession });
}
