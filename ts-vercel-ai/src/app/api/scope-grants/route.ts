import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getAllGrants, revokeGrant, renewGrant, revokeExpiredScopes } from '@/lib/scope-ttl';

export async function GET(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.sub;

  // Clean up expired scopes on every fetch
  revokeExpiredScopes(userId);

  const grants = getAllGrants(userId);
  const now = Date.now();

  const grantsWithCountdown = grants.map((grant) => ({
    connection: grant.connection,
    scopes: grant.scopes,
    grantedAt: grant.grantedAt,
    expiresAt: grant.expiresAt,
    expired: grant.expired,
    remaining: Math.max(0, grant.expiresAt - now),
    totalTtl: grant.expiresAt - grant.grantedAt,
  }));

  return NextResponse.json({ grants: grantsWithCountdown });
}

export async function DELETE(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { connection } = await req.json();
  if (!connection || typeof connection !== 'string') {
    return NextResponse.json({ error: 'Missing connection' }, { status: 400 });
  }

  const removed = revokeGrant(session.user.sub, connection);
  return NextResponse.json({ success: removed });
}

export async function POST(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { connection, riskLevel } = await req.json();
  if (!connection || typeof connection !== 'string') {
    return NextResponse.json({ error: 'Missing connection' }, { status: 400 });
  }

  const grant = renewGrant(session.user.sub, connection, riskLevel ?? 'GREEN');
  if (!grant) {
    return NextResponse.json({ error: 'No existing grant to renew' }, { status: 404 });
  }

  return NextResponse.json({ grant });
}
