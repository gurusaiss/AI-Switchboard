'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Aggregate {
  modelId: string;
  provider: string;
  totalCalls: number;
  successCount: number;
  totalCost: number;
  avgLatencyMs: number;
  successRate: number;
}

interface UsageResponse {
  aggregates: Aggregate[];
  totalEvents: number;
  estimatedSavings: number;
  totalActualCost: number;
  totalBenchmarkCost: number;
}

export default function UsagePage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);

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
    fetch('/api/usage')
      .then((r) => r.json())
      .then((body: UsageResponse) => {
        setData(body);
        setLoading(false);
      });
  }, [authChecked]);

  if (!authChecked || loading) {
    return (
      <div className="space-y-4">
        <div className="h-7 w-40 animate-pulse rounded bg-surface" />
        <div className="h-24 animate-pulse rounded-lg bg-surface" />
        <div className="h-40 animate-pulse rounded-lg bg-surface" />
      </div>
    );
  }

  const aggregates = data?.aggregates ?? [];
  const totalEvents = data?.totalEvents ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Usage</h1>
        <p className="text-sm text-muted">{totalEvents} request(s) recorded in this workspace.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Total spent (routed)"
          value={`$${(data?.totalActualCost ?? 0).toFixed(6)}`}
          hint="Sum of actual estimated cost across all requests."
        />
        <StatCard
          label="Would have cost (most expensive capable model)"
          value={`$${(data?.totalBenchmarkCost ?? 0).toFixed(6)}`}
          hint="Same requests, same token usage, priced at the priciest registry model that could have handled each one."
        />
        <StatCard
          label="Estimated savings from routing"
          value={`$${(data?.estimatedSavings ?? 0).toFixed(6)}`}
          emphasize
          hint="Real computation over your own usage events - $0 for a fresh workspace, never a placeholder."
        />
      </div>

      {aggregates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-surface p-8 text-center">
          <p className="text-sm text-muted">No usage yet.</p>
          <p className="mt-1 text-sm text-faint">
            Run a request from the{' '}
            <a href="/app" className="text-brand-600 hover:underline">
              Composer
            </a>{' '}
            to see per-model cost, latency, and savings here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface shadow-card">
          <table className="w-full text-sm">
            <thead className="bg-bg text-left text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-4 py-2.5">Model</th>
                <th className="px-4 py-2.5">Provider</th>
                <th className="px-4 py-2.5">Calls</th>
                <th className="px-4 py-2.5">Success rate</th>
                <th className="px-4 py-2.5">Avg latency</th>
                <th className="px-4 py-2.5">Total est. cost</th>
              </tr>
            </thead>
            <tbody>
              {aggregates
                .slice()
                .sort((a, b) => b.totalCalls - a.totalCalls)
                .map((a) => (
                  <tr key={a.modelId} className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium text-ink">{a.modelId}</td>
                    <td className="px-4 py-2.5 text-muted">{a.provider}</td>
                    <td className="px-4 py-2.5 text-ink">{a.totalCalls}</td>
                    <td className="px-4 py-2.5">
                      <SuccessBar rate={a.successRate} />
                    </td>
                    <td className="px-4 py-2.5 text-ink">{a.avgLatencyMs}ms</td>
                    <td className="px-4 py-2.5 text-ink">${a.totalCost.toFixed(6)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  emphasize,
}: {
  label: string;
  value: string;
  hint: string;
  emphasize?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 shadow-card ${
        emphasize ? 'border-brand-400 bg-brand-50' : 'border-border bg-surface'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-faint">{label}</p>
      <p className={`mt-1 text-xl font-semibold ${emphasize ? 'text-brand-700' : 'text-ink'}`}>{value}</p>
      <p className="mt-1 text-xs text-faint">{hint}</p>
    </div>
  );
}

function SuccessBar({ rate }: { rate: number }) {
  const pct = Math.round(rate * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="score-bar-track w-16">
        <div className="score-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-muted">{pct}%</span>
    </div>
  );
}
