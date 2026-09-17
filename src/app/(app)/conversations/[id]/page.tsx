'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

interface Message {
  id: string;
  role: string;
  content: string;
  modelId: string | null;
  isDemo: boolean;
  createdAt: string;
}

export default function ConversationDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const [authChecked, setAuthChecked] = useState(false);
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [notFound, setNotFound] = useState(false);

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
    fetch(`/api/conversations/${params.id}`)
      .then(async (r) => {
        if (r.status === 404) {
          setNotFound(true);
          return;
        }
        const body = await r.json();
        setMessages(body.messages);
      });
  }, [authChecked, params.id]);

  if (!authChecked) return <p className="text-sm text-muted">Loading...</p>;
  if (notFound) {
    return (
      <div>
        <p className="text-sm text-muted">Conversation not found.</p>
        <Link href="/conversations" className="text-sm text-brand-600 hover:underline">
          Back to history
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link href="/conversations" className="text-sm text-brand-600 hover:underline">
        ← Back to history
      </Link>
      <h1 className="text-xl font-semibold">Conversation</h1>
      <div className="space-y-3">
        {messages?.map((m) => (
          <div
            key={m.id}
            className={`rounded-lg border p-3 text-sm ${
              m.role === 'user' ? 'border-border bg-surface' : 'border-brand-100 bg-brand-50'
            }`}
          >
            <div className="mb-1 flex items-center gap-2 text-xs text-muted">
              <span className="font-medium uppercase">{m.role}</span>
              {m.modelId && <span>· {m.modelId}</span>}
              {m.role === 'assistant' && (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    m.isDemo ? 'bg-warning-bg text-warning-text' : 'bg-success-bg text-success-text'
                  }`}
                >
                  {m.isDemo ? 'DEMO / MOCK' : 'REAL PROVIDER'}
                </span>
              )}
            </div>
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
