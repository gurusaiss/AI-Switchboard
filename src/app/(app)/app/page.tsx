'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type RoutingMode = 'auto' | 'quality' | 'speed' | 'cost' | 'privacy' | 'manual';

interface ModelRow {
  id: string;
  provider: string;
  displayName: string;
  capabilities: string[];
  usable: boolean;
  isLocal: boolean;
}

interface ExecuteResponse {
  conversationId: string;
  response: {
    text: string;
    isDemo: boolean;
    provider: string;
    modelId: string;
    latencyMs: number;
    estCost: number;
  };
  trace: {
    detectedRequirements: {
      intent: string;
      capabilities: string[];
      qualityRequirement: string;
      latencyRequirement: string;
      privacyLevel: string;
    };
    chosenModelId: string;
    reason: string;
    fallbackChain: string[];
    routingMode: string;
    scored: { modelId: string; score: number }[];
  };
}

interface CompareResult {
  modelId: string;
  response?: string;
  error?: string;
  latencyMs?: number;
  estCost?: number;
  isDemo: boolean;
}

const MODES: { key: RoutingMode; label: string }[] = [
  { key: 'auto', label: 'Auto' },
  { key: 'quality', label: 'Quality' },
  { key: 'speed', label: 'Speed' },
  { key: 'cost', label: 'Cost' },
  { key: 'privacy', label: 'Privacy' },
  { key: 'manual', label: 'Manual' },
];

export default function ComposerPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [mode, setMode] = useState<RoutingMode | 'compare'>('auto');
  const [models, setModels] = useState<ModelRow[]>([]);
  const [manualModelId, setManualModelId] = useState('');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExecuteResponse | null>(null);
  const [compareResults, setCompareResults] = useState<CompareResult[] | null>(null);
  const [showTrace, setShowTrace] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((body) => {
        if (!body.authenticated) {
          router.push('/login');
        } else {
          setAuthChecked(true);
        }
      });
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    fetch('/api/models')
      .then((r) => r.json())
      .then((body) => setModels(body.models));
  }, [authChecked]);

  const usableModels = models.filter((m) => m.usable);

  function toggleCompareId(id: string) {
    setCompareIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 4 ? [...prev, id] : prev));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setError(null);
    setResult(null);
    setCompareResults(null);
    setLoading(true);
    try {
      if (mode === 'compare') {
        if (compareIds.length < 2) {
          setError('Pick at least 2 models to compare.');
          return;
        }
        const res = await fetch('/api/compare', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, modelIds: compareIds }),
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error || 'Compare failed');
          return;
        }
        setCompareResults(body.results);
      } else {
        const res = await fetch('/api/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt,
            routingMode: mode,
            manualModelId: mode === 'manual' ? manualModelId : undefined,
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          setError(body.error || 'Request failed');
          return;
        }
        setResult(body);
      }
    } finally {
      setLoading(false);
    }
  }

  if (!authChecked) {
    return <p className="text-sm text-gray-500">Loading...</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Universal Composer</h1>
        <p className="text-sm text-gray-500">
          Type one request. The routing engine picks a model, explains why, or compare models side by side.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask anything - e.g. 'write a function to reverse a linked list' or 'research sources on X'"
          rows={4}
          className="w-full resize-none rounded border border-gray-300 p-3 text-sm focus:border-brand-500 focus:outline-none"
        />

        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              type="button"
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                mode === m.key ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {m.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMode('compare')}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              mode === 'compare' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Compare
          </button>
        </div>

        {mode === 'manual' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Pick a model</label>
            <select
              value={manualModelId}
              onChange={(e) => setManualModelId(e.target.value)}
              className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm"
            >
              <option value="">Let routing choose (no override)</option>
              {usableModels.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.displayName} ({m.provider})
                </option>
              ))}
            </select>
          </div>
        )}

        {mode === 'compare' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Pick 2-4 models</label>
            <div className="flex flex-wrap gap-2">
              {usableModels.map((m) => (
                <label
                  key={m.id}
                  className={`cursor-pointer rounded border px-2 py-1 text-xs ${
                    compareIds.includes(m.id) ? 'border-brand-500 bg-brand-50' : 'border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="mr-1"
                    checked={compareIds.includes(m.id)}
                    onChange={() => toggleCompareId(m.id)}
                  />
                  {m.displayName}
                </label>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Running...' : mode === 'compare' ? 'Compare' : 'Run'}
        </button>
      </form>

      {result && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="mb-2 flex items-center gap-2">
            <Badge isDemo={result.response.isDemo} />
            <span className="text-xs text-gray-500">
              {result.response.provider}:{result.response.modelId} · {result.response.latencyMs}ms · est. $
              {result.response.estCost.toFixed(6)}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm">{result.response.text}</p>

          <button
            onClick={() => setShowTrace((v) => !v)}
            className="mt-3 text-xs font-medium text-brand-600 hover:underline"
          >
            {showTrace ? 'Hide' : 'Show'} "Why this model?"
          </button>
          {showTrace && (
            <div className="mt-2 rounded bg-gray-50 p-3 text-xs text-gray-700">
              <p>
                <span className="font-medium">Detected intent:</span> {result.trace.detectedRequirements.intent}
              </p>
              <p>
                <span className="font-medium">Required capabilities:</span>{' '}
                {result.trace.detectedRequirements.capabilities.join(', ')}
              </p>
              <p>
                <span className="font-medium">Quality / latency / privacy:</span>{' '}
                {result.trace.detectedRequirements.qualityRequirement} /{' '}
                {result.trace.detectedRequirements.latencyRequirement} /{' '}
                {result.trace.detectedRequirements.privacyLevel}
              </p>
              <p className="mt-2">
                <span className="font-medium">Chosen model:</span> {result.trace.chosenModelId}
              </p>
              <p>
                <span className="font-medium">Reason:</span> {result.trace.reason}
              </p>
              <p className="mt-2">
                <span className="font-medium">Fallback chain:</span> {result.trace.fallbackChain.join(' → ')}
              </p>
              <p className="mt-2">
                <span className="font-medium">Scored candidates:</span>
              </p>
              <ul className="ml-4 list-disc">
                {result.trace.scored.map((s) => (
                  <li key={s.modelId}>
                    {s.modelId}: {s.score}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {compareResults && (
        <div className="grid gap-4 md:grid-cols-2">
          {compareResults.map((r) => (
            <div key={r.modelId} className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">{r.modelId}</span>
                <Badge isDemo={r.isDemo} />
              </div>
              {r.error ? (
                <p className="text-sm text-red-600">{r.error}</p>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm">{r.response}</p>
                  <p className="mt-2 text-xs text-gray-500">
                    {r.latencyMs}ms · est. ${r.estCost?.toFixed(6)}
                  </p>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Badge({ isDemo }: { isDemo: boolean }) {
  return isDemo ? (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">DEMO / MOCK</span>
  ) : (
    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">REAL PROVIDER</span>
  );
}
