import { NextRequest, NextResponse } from 'next/server';
import { auth0 } from '@/lib/auth0';
import { resolveScopes } from '@/lib/scope-resolver';

export async function POST(req: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const toolNames: unknown = body.toolNames;

  if (!Array.isArray(toolNames) || !toolNames.every((t) => typeof t === 'string')) {
    return NextResponse.json(
      { error: 'toolNames must be an array of strings' },
      { status: 400 },
    );
  }

  if (toolNames.length === 0) {
    return NextResponse.json(
      { error: 'toolNames must contain at least one tool' },
      { status: 400 },
    );
  }

  const plan = resolveScopes(toolNames as string[]);
  return NextResponse.json(plan);
}
