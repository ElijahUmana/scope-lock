'use client';

import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
      <div className="text-6xl font-bold text-white/20 mb-4">404</div>
      <h2 className="text-lg font-semibold text-white mb-2">Page not found</h2>
      <p className="text-sm text-white/50 mb-6 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white text-sm hover:bg-white/20"
      >
        Go Home
      </Link>
    </div>
  );
}
