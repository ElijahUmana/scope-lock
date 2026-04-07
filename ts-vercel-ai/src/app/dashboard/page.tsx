import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import { auth0 } from '@/lib/auth0';
import DashboardContent from '@/components/dashboard/dashboard-content';
import { ErrorBoundary } from '@/components/error-boundary';

export default async function DashboardPage() {
  const session = await auth0.getSession();

  if (!session || !session.user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-full bg-white/5 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-4 py-4 md:p-6">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Permission Dashboard</h1>
          <p className="text-sm md:text-base text-white/70">
            Monitor active scopes, security posture, and audit trail for your AI agent connections
          </p>
        </div>

        <ErrorBoundary pageName="Dashboard">
          <Suspense
            fallback={
              <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-white/60" />
              </div>
            }
          >
            <DashboardContent user={session.user} />
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}
