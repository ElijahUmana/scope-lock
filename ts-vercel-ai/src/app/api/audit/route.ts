import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { getAuditLog, hasRealEntries, removeDemoEntries } from '@/lib/audit';
import { getActiveAlerts } from '@/lib/anomaly-detection';
import { seedDemoData } from '@/lib/demo-data';
import { clearScopeRequests } from '@/lib/actions/audit';

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

  // If real entries exist alongside demo entries, purge the demo entries
  if (hasRealEntries(userId)) {
    removeDemoEntries(userId);
    await clearScopeRequests(userId);
    entries = getAuditLog(userId);
  }

  const isDemoData = entries.length > 0 && entries.every((e) => e.toolName.startsWith('[demo] '));
  const anomalyAlerts = getActiveAlerts(userId);
  return NextResponse.json({ entries, anomalyAlerts, isDemoData });
}
