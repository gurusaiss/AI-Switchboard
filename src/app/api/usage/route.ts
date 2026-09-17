import { NextResponse } from 'next/server';
import { requireSession } from '../../../lib/auth';
import { scopedQueries } from '../../../db/scoped';
import { withErrorHandling } from '../../../lib/api-helpers';

interface Aggregate {
  modelId: string;
  provider: string;
  totalCalls: number;
  successCount: number;
  totalCost: number;
  avgLatencyMs: number;
  successRate: number;
}

export const GET = withErrorHandling(async () => {
  const { workspaceId } = await requireSession();
  const events = await scopedQueries(workspaceId).listUsageEvents();

  const byModel = new Map<string, Aggregate & { latencySum: number }>();
  let totalActualCost = 0;
  let totalBenchmarkCost = 0;
  for (const e of events) {
    const key = e.modelId;
    let agg = byModel.get(key);
    if (!agg) {
      agg = {
        modelId: e.modelId,
        provider: e.provider,
        totalCalls: 0,
        successCount: 0,
        totalCost: 0,
        avgLatencyMs: 0,
        successRate: 0,
        latencySum: 0,
      };
      byModel.set(key, agg);
    }
    agg.totalCalls += 1;
    if (e.success) agg.successCount += 1;
    agg.totalCost += e.estCost;
    agg.latencySum += e.latencyMs;
    totalActualCost += e.estCost;
    totalBenchmarkCost += e.benchmarkCost;
  }

  const aggregates: Aggregate[] = Array.from(byModel.values()).map((a) => ({
    modelId: a.modelId,
    provider: a.provider,
    totalCalls: a.totalCalls,
    successCount: a.successCount,
    totalCost: Number(a.totalCost.toFixed(6)),
    avgLatencyMs: Math.round(a.latencySum / a.totalCalls),
    successRate: Number((a.successCount / a.totalCalls).toFixed(4)),
  }));

  // Real computation over real rows: what routing actually spent vs. what the same
  // requests (same token usage) would have cost at the most expensive capable model
  // in the registry. 0 for a fresh workspace with no usage - never a placeholder.
  const estimatedSavings = Number(Math.max(0, totalBenchmarkCost - totalActualCost).toFixed(6));

  return NextResponse.json({
    aggregates,
    totalEvents: events.length,
    estimatedSavings,
    totalActualCost: Number(totalActualCost.toFixed(6)),
    totalBenchmarkCost: Number(totalBenchmarkCost.toFixed(6)),
  });
});
