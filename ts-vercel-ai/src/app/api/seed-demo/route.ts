import { NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { seedDemoData } from '@/lib/demo-data';

export async function POST() {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const seeded = await seedDemoData(session.user.sub);
  return NextResponse.json({ seeded });
}
