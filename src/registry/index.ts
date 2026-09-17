import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { models } from '../db/schema';
import type { ModelInfo } from '../lib/types';

export async function listAllModels(): Promise<ModelInfo[]> {
  const rows = await db.select().from(models);
  return rows.map(rowToModelInfo);
}

export async function getModel(id: string): Promise<ModelInfo | undefined> {
  const rows = await db.select().from(models).where(eq(models.id, id));
  return rows[0] ? rowToModelInfo(rows[0]) : undefined;
}

function rowToModelInfo(row: typeof models.$inferSelect): ModelInfo {
  return {
    id: row.id,
    provider: row.provider as ModelInfo['provider'],
    modelId: row.modelId,
    displayName: row.displayName,
    modality: row.modality as ModelInfo['modality'],
    contextWindow: row.contextWindow,
    capabilities: row.capabilities as ModelInfo['capabilities'],
    pricingInputPer1k: row.pricingInputPer1k,
    pricingOutputPer1k: row.pricingOutputPer1k,
    typicalLatencyMs: row.typicalLatencyMs,
    reliabilityScore: row.reliabilityScore,
    isLocal: row.isLocal,
  };
}

/** Update hook: nudges a model's reliabilityScore based on an observed run outcome.
 * Simple exponential moving average - deliberately basic for V1, but real (not a stub):
 * it actually persists the updated score for future routing decisions. */
export async function recordOutcome(modelId: string, success: boolean): Promise<void> {
  const current = await getModel(modelId);
  if (!current) return;
  const observed = success ? 1 : 0;
  const alpha = 0.1; // weight given to the newest observation
  const updated = current.reliabilityScore * (1 - alpha) + observed * alpha;
  await db
    .update(models)
    .set({ reliabilityScore: Math.max(0, Math.min(1, updated)) })
    .where(eq(models.id, modelId));
}

export async function countModels(): Promise<number> {
  const rows = await db.select({ count: sql<number>`count(*)` }).from(models);
  return rows[0]?.count ?? 0;
}
