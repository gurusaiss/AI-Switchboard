import type { ReactNode } from 'react';
import Nav from '../../components/Nav';

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Nav />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">{children}</div>
    </>
  );
}
