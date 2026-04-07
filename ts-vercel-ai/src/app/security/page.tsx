import { redirect } from 'next/navigation';

import { auth0 } from '@/lib/auth0';
import SecurityTabs from '@/components/security/security-tabs';
import { ErrorBoundary } from '@/components/error-boundary';

export default async function SecurityPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await auth0.getSession();

  if (!session || !session.user) {
    redirect('/auth/login');
  }

  const { tab } = await searchParams;

  return (
    <div className="min-h-full bg-white/5 overflow-y-auto">
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Security</h1>
          <p className="text-white/70">
            Authorization matrix, attack simulations, and architecture insights
          </p>
        </div>

        <ErrorBoundary pageName="Security">
          <SecurityTabs initialTab={tab} />
        </ErrorBoundary>
      </div>
    </div>
  );
}
