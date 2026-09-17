'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
}

export default function ConversationsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((body) => {
        if (!body.authenticated) router.push('/login');
        else setAuthChecked(true);
      });
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    fetch('/api/conversations')
      .then((r) => r.json())
      .then((body) => setConversations(body.conversations));
  }, [authChecked]);

  if (!authChecked) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-48 animate-pulse rounded bg-surface" />
        <div className="h-32 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-ink">Conversation history</h1>
      {conversations.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">No conversations yet.</p>
          <p className="mt-1 text-sm text-faint">
            Head to the{' '}
            <Link href="/app" className="text-brand-600 hover:underline">
              Composer
            </Link>{' '}
            to start one.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border bg-surface shadow-card">
          {conversations
            .slice()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((c) => (
              <li key={c.id}>
                <Link href={`/conversations/${c.id}`} className="block px-4 py-3 text-sm hover:bg-bg">
                  <div className="font-medium text-ink">{c.title}</div>
                  <div className="text-xs text-faint">{new Date(c.createdAt).toLocaleString()}</div>
                </Link>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
