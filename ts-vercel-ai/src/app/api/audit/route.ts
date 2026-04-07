import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getAuditLog } from '@/lib/audit';
import { getActiveAlerts } from '@/lib/anomaly-detection';
import { seedDemoData } from '@/lib/demo-data';

export async function GET(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.sub;
  let entries = getAuditLog(userId);

  // Auto-seed demo data after a cold start so the dashboard is never empty
  if (entries.length === 0) {
    await seedDemoData(userId);
    entries = getAuditLog(userId);
  }

  const anomalyAlerts = getActiveAlerts(userId);
  return NextResponse.json({ entries, anomalyAlerts });
}
