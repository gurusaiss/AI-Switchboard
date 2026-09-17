'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface ConnectedProvider {
  id: string;
  provider: string;
  label: string | null;
  discoveredModels: string[];
  createdAt: string;
}

const CONNECTABLE = [
  { key: 'openai', label: 'OpenAI', needsKey: true },
  { key: 'anthropic', label: 'Anthropic', needsKey: true },
  { key: 'google', label: 'Google (Gemini)', needsKey: true },
  { key: 'openrouter', label: 'OpenRouter', needsKey: true },
  { key: 'ollama', label: 'Ollama (local)', needsKey: false },
];

export default function ProvidersPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [connected, setConnected] = useState<ConnectedProvider[]>([]);
  const [keyInputs, setKeyInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, { ok: boolean; text: string; models?: string[] }>>({});

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((body) => {
        if (!body.authenticated) router.push('/login');
        else setAuthChecked(true);
      });
  }, [router]);

  async function refresh() {
    const res = await fetch('/api/providers');
    const body = await res.json();
    setConnected(body.providers);
  }

  useEffect(() => {
    if (authChecked) refresh();
  }, [authChecked]);

  async function handleConnect(provider: string, needsKey: boolean) {
    setBusy(provider);
    setMessages((m) => ({ ...m, [provider]: undefined as never }));
    try {
      const res = await fetch('/api/providers/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: needsKey ? keyInputs[provider] : undefined }),
      });
      const body = await res.json();
      if (!res.ok) {
        setMessages((m) => ({ ...m, [provider]: { ok: false, text: body.error || 'Connect failed' } }));
        return;
      }
      setMessages((m) => ({
        ...m,
        [provider]: {
          ok: true,
          text: `Connected. Discovered ${body.discoveredModels.length} model(s).`,
          models: body.discoveredModels.map((mo: { displayName: string }) => mo.displayName),
        },
      }));
      setKeyInputs((k) => ({ ...k, [provider]: '' }));
      refresh();
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect(id: string) {
    await fetch(`/api/providers/${id}`, { method: 'DELETE' });
    refresh();
  }

  if (!authChecked) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Providers</h1>
        <p className="text-sm text-gray-500">
          Bring your own key. Nothing is required to get started - the Mock provider is always available.
        </p>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-gray-700">Connected</h2>
        {connected.length === 0 ? (
          <p className="text-sm text-gray-400">No providers connected yet. Mock is always usable below.</p>
        ) : (
          <ul className="space-y-2">
            {connected.map((c) => (
              <li key={c.id} className="flex items-center justify-between rounded border border-gray-200 bg-white p-3 text-sm">
                <div>
                  <span className="font-medium">{c.provider}</span>{' '}
                  <span className="text-gray-400">({c.discoveredModels.length} models)</span>
                </div>
                <button
                  onClick={() => handleDisconnect(c.id)}
                  className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Disconnect
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-sm font-medium text-gray-700">Connect a provider</h2>
        {CONNECTABLE.map((p) => {
          const isConnected = connected.some((c) => c.provider === p.key);
          const msg = messages[p.key];
          return (
            <div key={p.key} className="rounded border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{p.label}</span>
                {isConnected && <span className="text-xs text-green-700">Connected</span>}
              </div>
              {p.needsKey ? (
                <div className="flex gap-2">
                  <input
                    type="password"
                    placeholder={`${p.label} API key`}
                    value={keyInputs[p.key] || ''}
                    onChange={(e) => setKeyInputs((k) => ({ ...k, [p.key]: e.target.value }))}
                    className="flex-1 rounded border border-gray-300 px-2 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => handleConnect(p.key, true)}
                    disabled={busy === p.key || !keyInputs[p.key]}
                    className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    {busy === p.key ? 'Connecting...' : 'Connect'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => handleConnect(p.key, false)}
                  disabled={busy === p.key}
                  className="rounded bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {busy === p.key ? 'Detecting...' : 'Detect local Ollama'}
                </button>
              )}
              {msg && (
                <p className={`mt-2 text-xs ${msg.ok ? 'text-green-700' : 'text-red-600'}`}>{msg.text}</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
