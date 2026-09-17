'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const LINKS = [
  { href: '/', label: 'Composer' },
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

  if (pathname === '/login' || pathname === '/signup') return null;

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-brand-700">AI Control Plane</span>
          <div className="flex gap-4 text-sm">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded px-2 py-1 hover:bg-brand-50 ${
                  pathname === l.href ? 'bg-brand-50 font-medium text-brand-700' : 'text-gray-600'
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          {checked && email && (
            <>
              <span>{email}</span>
              <button onClick={handleLogout} className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50">
                Log out
              </button>
            </>
          )}
          {checked && !email && (
            <Link href="/login" className="rounded border border-gray-300 px-2 py-1 hover:bg-gray-50">
              Log in
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
