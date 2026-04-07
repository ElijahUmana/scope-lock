import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getAuditLog, verifyAuditChain, GENESIS_HASH } from '@/lib/audit';

export async function GET() {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.sub;
  const entries = getAuditLog(userId);
  const result = verifyAuditChain(userId);

  if (result.valid) {
    return NextResponse.json({
      valid: true,
      chainLength: entries.length,
      genesisHash: GENESIS_HASH,
      latestHash: entries.length > 0 ? entries[entries.length - 1].hash : GENESIS_HASH,
    });
  }

  return NextResponse.json({
    valid: false,
    brokenAt: result.brokenAt,
    chainLength: entries.length,
  });
}
