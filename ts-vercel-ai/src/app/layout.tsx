import './globals.css';
import { Roboto_Mono, Inter } from 'next/font/google';
import Image from 'next/image';
import { Github } from 'lucide-react';
import { NuqsAdapter } from 'nuqs/adapters/next/app';

import { ActiveLink, MobileNav } from '@/components/navbar';
import { Button } from '@/components/ui/button';
import { Toaster } from '@/components/ui/sonner';
import { auth0 } from '@/lib/auth0';
import UserButton from '@/components/auth0/user-button';

const robotoMono = Roboto_Mono({ weight: '400', subsets: ['latin'] });
const publicSans = Inter({ weight: '400', subsets: ['latin'] });

const TITLE = 'Scope Lock: Secure AI Agent Authorization with Auth0';
const DESCRIPTION = 'Progressive authorization for AI agents using Auth0 Token Vault. Every API call is properly authorized with minimal scopes.';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth0.getSession();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>{TITLE}</title>
        <link rel="shortcut icon" type="image/svg+xml" href="/images/favicon.png" />
        <meta name="description" content={DESCRIPTION} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:image" content="/images/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={TITLE} />
        <meta name="twitter:description" content={DESCRIPTION} />
        <meta name="twitter:image" content="/images/og-image.png" />
      </head>
      <body className={publicSans.className}>
        <NuqsAdapter>
          <div className="bg-secondary grid grid-rows-[auto,1fr] h-[100dvh] overflow-x-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-3 md:px-4 md:py-4 bg-black/25">
              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                <a
                  href="https://a0.to/ai-event"
                  rel="noopener noreferrer"
                  target="_blank"
                  className="flex items-center gap-2 shrink-0"
                >
                  <Image src="/images/auth0-logo.svg" alt="Auth0 AI Logo" className="h-6 md:h-8" width={143} height={32} />
                </a>
                <span className={`${robotoMono.className} text-white text-lg md:text-2xl shrink-0`}>Scope Lock</span>
                {/* Desktop nav */}
                <nav className="hidden md:flex gap-1">
                  <ActiveLink href="/">Chat</ActiveLink>
                  <ActiveLink href="/dashboard">Dashboard</ActiveLink>
                  <ActiveLink href="/security">Security</ActiveLink>
                  <ActiveLink href="/profile">Profile</ActiveLink>
                </nav>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {session && (
                  <div className="flex items-center text-white">
                    <UserButton user={session?.user!} logoutUrl="/auth/logout" />
                  </div>
                )}
                <Button asChild variant="header" size="default" className="hidden sm:inline-flex">
                  <a href="https://github.com/ElijahUmana/scope-lock" target="_blank">
                    <Github className="size-3" />
                    <span className="hidden md:inline">Open in GitHub</span>
                    <span className="md:hidden">GitHub</span>
                  </a>
                </Button>
                {/* Mobile hamburger menu */}
                <MobileNav />
              </div>
            </div>
            <div className="gradient-up bg-gradient-to-b from-white/10 to-white/0 relative grid border-input border-b-0">
              <div className="absolute inset-0">{children}</div>
            </div>
          </div>
          <Toaster richColors />
        </NuqsAdapter>
      </body>
    </html>
  );
}
