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

  if (!authChecked) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Conversation history</h1>
      {conversations.length === 0 ? (
        <p className="text-sm text-gray-400">
          No conversations yet. Head to the{' '}
          <Link href="/" className="text-brand-600 hover:underline">
            Composer
          </Link>{' '}
          to start one.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded border border-gray-200 bg-white">
          {conversations
            .slice()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .map((c) => (
              <li key={c.id}>
                <Link href={`/conversations/${c.id}`} className="block px-4 py-3 text-sm hover:bg-gray-50">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</div>
                </Link>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
