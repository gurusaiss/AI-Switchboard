import './globals.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'AI Control Plane',
  description: 'A privacy-first, BYOK personal AI control plane.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
