import { redirect } from 'next/navigation';

import { auth0 } from '@/lib/auth0';
import ScopeMatrix from '@/components/matrix/scope-matrix';

export default async function MatrixPage() {
  const session = await auth0.getSession();

  if (!session || !session.user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-full bg-white/5 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Scope Comparison Matrix</h1>
          <p className="text-white/70">
            Complete authorization model at a glance — which agent can access which tool, at what risk level
          </p>
        </div>

        <ScopeMatrix />
      </div>
    </div>
  );
}
