import { LogIn, UserPlus } from 'lucide-react';
import { ChatWindow } from '@/components/chat-window';
import { AgentSelector } from '@/components/agent-selector';
import { GuideInfoBox } from '@/components/guide/GuideInfoBox';
import { Button } from '@/components/ui/button';
import { auth0 } from '@/lib/auth0';

export default async function Home() {
  const session = await auth0.getSession();

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] my-auto gap-4">
        <h2 className="text-xl">You are not logged in</h2>
        <div className="flex gap-4">
          <Button asChild variant="default" size="default">
            <a href="/auth/login" className="flex items-center gap-2">
              <LogIn />
              <span>Login</span>
            </a>
          </Button>
          <Button asChild variant="default" size="default">
            <a href="/auth/login?screen_hint=signup">
              <UserPlus />
              <span>Sign up</span>
            </a>
          </Button>
        </div>
      </div>
    );
  }

  const InfoCard = (
    <GuideInfoBox>
      <ul>
        <li className="text-l">
          🔒
          <span className="ml-2">
            Scope Lock demonstrates progressive authorization for AI agents using{' '}
            <a className="text-blue-500" href="https://auth0.com/docs/secure/tokens/token-vault" target="_blank">
              Auth0 Token Vault
            </a>{' '}
            with the{' '}
            <a className="text-blue-500" href="https://sdk.vercel.ai/docs" target="_blank">
              Vercel AI SDK
            </a>
            .
          </span>
        </li>
        <li className="hidden text-l md:block">
          💻
          <span className="ml-2">
            You can find the prompt and model logic for this use-case in <code>app/api/chat/route.ts</code>.
          </span>
        </li>
        <li className="hidden text-l md:block">
          🎨
          <span className="ml-2">
            The main frontend logic is found in <code>app/page.tsx</code>.
          </span>
        </li>
        <li className="text-l">
          👇
          <span className="ml-2">
            Try asking e.g. <code>What can you help me with?</code> below!
          </span>
        </li>
      </ul>
    </GuideInfoBox>
  );

  return <AgentSelector userName={session?.user?.name ?? 'there'} infoCard={InfoCard} />;
}
