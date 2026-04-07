import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getAuditLog } from '@/lib/audit';
import { getActiveAlerts } from '@/lib/anomaly-detection';

export async function GET(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const entries = getAuditLog(session.user.sub);
  const anomalyAlerts = getActiveAlerts(session.user.sub);
  return NextResponse.json({ entries, anomalyAlerts });
}
