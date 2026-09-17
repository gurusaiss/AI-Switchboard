import type { ReactNode } from 'react';
import Link from 'next/link';

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-lg font-semibold tracking-tight text-ink">
            AI Control Plane
          </Link>
          <nav className="flex items-center gap-2 text-sm sm:gap-4">
            <Link href="/pricing" className="rounded px-2 py-1.5 text-muted hover:bg-bg hover:text-ink">
              Pricing
            </Link>
            <Link href="/login" className="rounded px-2 py-1.5 text-muted hover:bg-bg hover:text-ink">
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700"
            >
              Sign up free
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-faint sm:px-6">
          <p>
            AI Control Plane is an actively-built V1 - a personal, BYOK routing layer over
            your own provider keys. No customer logos, no case studies, no simulated
            checkout - what's on this page is what's actually in the app.
          </p>
          <p className="mt-3">© {new Date().getFullYear()} AI Control Plane.</p>
        </div>
      </footer>
    </div>
  );
}
