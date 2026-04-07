import { redirect } from 'next/navigation';

import { auth0 } from '@/lib/auth0';
import SandboxContent from '@/components/sandbox/sandbox-content';

export default async function SandboxPage() {
  const session = await auth0.getSession();

  if (!session || !session.user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-full bg-white/5 overflow-y-auto">
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Security Sandbox</h1>
          <p className="text-white/70">
            Simulate authorization attacks and see how Scope Lock blocks them in real time
          </p>
        </div>

        <SandboxContent />
      </div>
    </div>
  );
}
