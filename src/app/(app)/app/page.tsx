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
  const [modelsLoaded, setModelsLoaded] = useState(false);
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
      .then((body) => {
        setModels(body.models);
        setModelsLoaded(true);
      });
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
    return (
      <div className="space-y-4">
        <div className="h-7 w-56 animate-pulse rounded bg-surface" />
        <div className="h-48 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Universal Composer</h1>
        <p className="text-sm text-muted">
          Type one request. The routing engine picks a model, explains why, or compare models side by side.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-surface p-4 shadow-card">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask anything - e.g. 'write a function to reverse a linked list' or 'research sources on X'"
          rows={4}
          className="w-full resize-none rounded border border-border bg-surface p-3 text-sm text-ink placeholder:text-faint focus:border-brand-500 focus:outline-none"
        />

        <div className="flex flex-wrap gap-2">
          {MODES.map((m) => (
            <button
              type="button"
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                mode === m.key ? 'bg-brand-600 text-white' : 'bg-bg text-muted hover:bg-brand-50'
              }`}
            >
              {m.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMode('compare')}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              mode === 'compare' ? 'bg-brand-600 text-white' : 'bg-bg text-muted hover:bg-brand-50'
            }`}
          >
            Compare
          </button>
        </div>

        {modelsLoaded && usableModels.length === 0 && (
          <p className="rounded border border-warning-bg bg-warning-bg px-3 py-2 text-xs text-warning-text">
            No usable models found - this shouldn't happen since Mock is always available. Try reloading.
          </p>
        )}

        {mode === 'manual' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted">Pick a model</label>
            <select
              value={manualModelId}
              onChange={(e) => setManualModelId(e.target.value)}
              className="w-full rounded border border-border bg-surface px-2 py-1.5 text-sm text-ink"
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
            <label className="mb-1 block text-xs font-medium text-muted">Pick 2-4 models</label>
            <div className="flex flex-wrap gap-2">
              {usableModels.map((m) => (
                <label
                  key={m.id}
                  className={`cursor-pointer rounded border px-2 py-1 text-xs ${
                    compareIds.includes(m.id) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-border text-muted'
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

        {error && <p className="text-sm text-danger-text">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? 'Running...' : mode === 'compare' ? 'Compare' : 'Run'}
        </button>
      </form>

      {loading && (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="h-4 w-1/3 animate-pulse rounded bg-bg" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-bg" />
          <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-bg" />
        </div>
      )}

      {result && (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <div className="mb-2 flex items-center gap-2">
            <Badge isDemo={result.response.isDemo} />
            <span className="text-xs text-muted">
              {result.response.provider}:{result.response.modelId} · {result.response.latencyMs}ms · est. $
              {result.response.estCost.toFixed(6)}
            </span>
          </div>
          <p className="whitespace-pre-wrap text-sm text-ink">{result.response.text}</p>

          <button
            onClick={() => setShowTrace((v) => !v)}
            className="mt-3 text-xs font-medium text-brand-600 hover:underline"
          >
            {showTrace ? 'Hide' : 'Show'} "Why this model?"
          </button>
          {showTrace && <TraceView trace={result.trace} />}
        </div>
      )}

      {compareResults && <CompareView results={compareResults} />}
    </div>
  );
}

function TraceView({ trace }: { trace: ExecuteResponse['trace'] }) {
  const maxScore = Math.max(...trace.scored.map((s) => s.score), 0.0001);
  const minScore = Math.min(...trace.scored.map((s) => s.score), 0);
  const range = Math.max(maxScore - minScore, 0.0001);

  return (
    <div className="mt-3 space-y-3 rounded-lg bg-bg p-4 text-xs text-muted">
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <span className="font-medium text-ink">Detected intent:</span> {trace.detectedRequirements.intent}
        </div>
        <div>
          <span className="font-medium text-ink">Required capabilities:</span>{' '}
          {trace.detectedRequirements.capabilities.join(', ')}
        </div>
        <div>
          <span className="font-medium text-ink">Quality:</span> {trace.detectedRequirements.qualityRequirement}
        </div>
        <div>
          <span className="font-medium text-ink">Latency need:</span> {trace.detectedRequirements.latencyRequirement}
        </div>
        <div>
          <span className="font-medium text-ink">Privacy:</span> {trace.detectedRequirements.privacyLevel}
        </div>
        <div>
          <span className="font-medium text-ink">Routing mode:</span> {trace.routingMode}
        </div>
      </div>

      <div>
        <p>
          <span className="font-medium text-ink">Chosen model:</span> {trace.chosenModelId}
        </p>
        <p className="mt-1">
          <span className="font-medium text-ink">Reason:</span> {trace.reason}
        </p>
        <p className="mt-1">
          <span className="font-medium text-ink">Fallback chain:</span> {trace.fallbackChain.join(' → ')}
        </p>
      </div>

      <div>
        <p className="mb-2 font-medium text-ink">Scored candidates</p>
        <div className="space-y-2">
          {trace.scored.map((s) => {
            const pct = Math.round(((s.score - minScore) / range) * 100);
            const isChosen = s.modelId === trace.chosenModelId;
            return (
              <div key={s.modelId} className="flex items-center gap-2">
                <span className={`w-40 flex-none truncate ${isChosen ? 'font-medium text-ink' : ''}`}>
                  {s.modelId}
                  {isChosen && ' ✓'}
                </span>
                <div className="score-bar-track flex-1">
                  <div
                    className="score-bar-fill"
                    style={{
                      width: `${Math.max(pct, 4)}%`,
                      backgroundColor: isChosen ? 'rgb(var(--color-brand-600))' : 'rgb(var(--color-text-faint))',
                    }}
                  />
                </div>
                <span className="w-14 flex-none text-right tabular-nums">{s.score.toFixed(3)}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function CompareView({ results }: { results: CompareResult[] }) {
  const succeeded = results.filter((r) => !r.error && r.latencyMs !== undefined && r.estCost !== undefined);
  const maxLatency = Math.max(...succeeded.map((r) => r.latencyMs ?? 0), 1);
  const maxCost = Math.max(...succeeded.map((r) => r.estCost ?? 0), 0.000001);

  return (
    <div className="space-y-4">
      {succeeded.length > 1 && (
        <div className="rounded-lg border border-border bg-surface p-4 shadow-card">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-faint">Latency & cost comparison</p>
          <div className="space-y-3">
            {succeeded.map((r) => (
              <div key={r.modelId} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="font-medium text-ink">{r.modelId}</span>
                  <span>
                    {r.latencyMs}ms · ${r.estCost?.toFixed(6)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <div className="score-bar-track flex-1">
                    <div
                      className="score-bar-fill"
                      style={{ width: `${Math.max(((r.latencyMs ?? 0) / maxLatency) * 100, 4)}%` }}
                    />
                  </div>
                  <div className="score-bar-track flex-1">
                    <div
                      className="score-bar-fill"
                      style={{
                        width: `${Math.max(((r.estCost ?? 0) / maxCost) * 100, 4)}%`,
                        backgroundColor: 'rgb(var(--color-text-faint))',
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
            <p className="text-[11px] text-faint">Left bar = relative latency · right bar = relative cost.</p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {results.map((r) => (
          <div key={r.modelId} className="rounded-lg border border-border bg-surface p-4 shadow-card">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-ink">{r.modelId}</span>
              <Badge isDemo={r.isDemo} />
            </div>
            {r.error ? (
              <p className="text-sm text-danger-text">{r.error}</p>
            ) : (
              <>
                <p className="whitespace-pre-wrap text-sm text-ink">{r.response}</p>
                <p className="mt-2 text-xs text-muted">
                  {r.latencyMs}ms · est. ${r.estCost?.toFixed(6)}
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Badge({ isDemo }: { isDemo: boolean }) {
  return isDemo ? (
    <span className="rounded-full bg-warning-bg px-2 py-0.5 text-xs font-medium text-warning-text">DEMO / MOCK</span>
  ) : (
    <span className="rounded-full bg-success-bg px-2 py-0.5 text-xs font-medium text-success-text">REAL PROVIDER</span>
  );
}
