'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';
import Link from 'next/link';
import { Menu, X } from 'lucide-react';

import { cn } from '@/utils/cn';

export const ActiveLink = (props: { href: string; children: ReactNode }) => {
  const pathname = usePathname();
  return (
    <Link
      href={props.href}
      className={cn(
        'px-4 py-2 rounded-[18px] whitespace-nowrap flex items-center gap-2 text-sm transition-all min-h-[44px]',
        pathname === props.href && 'bg-primary text-primary-foreground',
      )}
    >
      {props.children}
    </Link>
  );
};

const NAV_LINKS = [
  { href: '/', label: 'Chat' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/security', label: 'Security' },
  { href: '/profile', label: 'Profile' },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-center w-10 h-10 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
      >
        {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 bg-black/95 backdrop-blur-md border-b border-white/10 shadow-xl">
          <nav className="flex flex-col p-3 gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className={cn(
                  'px-4 py-3 rounded-lg text-sm font-medium transition-all min-h-[44px] flex items-center',
                  pathname === link.href
                    ? 'bg-primary text-primary-foreground'
                    : 'text-white/70 hover:text-white hover:bg-white/10',
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  );
}
