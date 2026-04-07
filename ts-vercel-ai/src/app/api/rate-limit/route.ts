import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getRateLimitStatus } from '@/lib/rate-limiter';

export async function GET(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const agentId = req.nextUrl.searchParams.get('agentId');
  const status = getRateLimitStatus(session.user.sub, agentId);

  return NextResponse.json(status);
}
