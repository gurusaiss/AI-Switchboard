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

export default function UsagePage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [aggregates, setAggregates] = useState<Aggregate[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);

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
      .then((body) => {
        setAggregates(body.aggregates);
        setTotalEvents(body.totalEvents);
      });
  }, [authChecked]);

  if (!authChecked) return <p className="text-sm text-gray-500">Loading...</p>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Usage</h1>
        <p className="text-sm text-gray-500">{totalEvents} request(s) recorded in this workspace.</p>
      </div>

      {aggregates.length === 0 ? (
        <p className="text-sm text-gray-400">No usage yet - run something from the Composer.</p>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-2">Model</th>
                <th className="px-4 py-2">Provider</th>
                <th className="px-4 py-2">Calls</th>
                <th className="px-4 py-2">Success rate</th>
                <th className="px-4 py-2">Avg latency</th>
                <th className="px-4 py-2">Total est. cost</th>
              </tr>
            </thead>
            <tbody>
              {aggregates
                .slice()
                .sort((a, b) => b.totalCalls - a.totalCalls)
                .map((a) => (
                  <tr key={a.modelId} className="border-t border-gray-100">
                    <td className="px-4 py-2 font-medium">{a.modelId}</td>
                    <td className="px-4 py-2 text-gray-500">{a.provider}</td>
                    <td className="px-4 py-2">{a.totalCalls}</td>
                    <td className="px-4 py-2">{(a.successRate * 100).toFixed(0)}%</td>
                    <td className="px-4 py-2">{a.avgLatencyMs}ms</td>
                    <td className="px-4 py-2">${a.totalCost.toFixed(6)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
