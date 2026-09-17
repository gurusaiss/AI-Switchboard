'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const LINKS = [
  { href: '/app', label: 'Composer' },
  { href: '/providers', label: 'Providers' },
  { href: '/conversations', label: 'History' },
  { href: '/usage', label: 'Usage' },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((body) => {
        setEmail(body.authenticated ? body.email : null);
        setChecked(true);
      })
      .catch(() => setChecked(true));
  }, [pathname]);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }

  return (
    <nav className="border-b border-border bg-surface">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-brand-700">
            AI Control Plane
          </Link>
          <div className="hidden gap-1 text-sm sm:flex">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded px-2 py-1 transition-colors hover:bg-brand-50 ${
                  pathname === l.href ? 'bg-brand-50 font-medium text-brand-700' : 'text-muted'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          {checked && email && (
            <>
              <span className="hidden sm:inline">{email}</span>
              <button onClick={handleLogout} className="rounded border border-border px-2 py-1 hover:bg-bg">
                Log out
              </button>
            </>
          )}
          {checked && !email && (
            <Link href="/login" className="rounded border border-border px-2 py-1 hover:bg-bg">
              Log in
            </Link>
          )}
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-t border-border px-4 py-2 text-sm sm:hidden">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`whitespace-nowrap rounded px-2 py-1 ${
              pathname === l.href ? 'bg-brand-50 font-medium text-brand-700' : 'text-muted'
            }`}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
