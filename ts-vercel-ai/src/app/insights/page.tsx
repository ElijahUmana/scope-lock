import { redirect } from 'next/navigation';

import { auth0 } from '@/lib/auth0';
import InsightsContent from '@/components/insights/insights-content';

export default async function InsightsPage() {
  const session = await auth0.getSession();

  if (!session || !session.user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-full bg-white/5 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Insights</h1>
          <p className="text-white/70">
            Patterns, pain points, and gaps discovered while building with Auth0 Token Vault
          </p>
        </div>

        <InsightsContent />
      </div>
    </div>
  );
}
