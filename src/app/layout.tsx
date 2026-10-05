import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'AI Switchboard',
  description:
    'AI Switchboard — a privacy-first, BYOK AI routing workspace: task-aware routing across your own provider keys, with visible reasoning and side-by-side comparison.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-ink antialiased">{children}</body>
    </html>
  );
}
