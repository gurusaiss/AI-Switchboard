import { db, sqlite } from '../src/db/client';
import { models } from '../src/db/schema';
import { SEED_MODELS } from '../src/registry/seed-data';

async function main() {
  for (const m of SEED_MODELS) {
    await db
      .insert(models)
      .values({
        id: m.id,
        provider: m.provider,
        modelId: m.modelId,
        displayName: m.displayName,
        modality: m.modality,
        contextWindow: m.contextWindow,
        capabilities: m.capabilities,
        pricingInputPer1k: m.pricingInputPer1k,
        pricingOutputPer1k: m.pricingOutputPer1k,
        typicalLatencyMs: m.typicalLatencyMs,
        reliabilityScore: m.reliabilityScore,
        isLocal: m.isLocal,
      })
      .onConflictDoUpdate({
        target: models.id,
        set: {
          displayName: m.displayName,
          modality: m.modality,
          contextWindow: m.contextWindow,
          capabilities: m.capabilities,
          pricingInputPer1k: m.pricingInputPer1k,
          pricingOutputPer1k: m.pricingOutputPer1k,
          typicalLatencyMs: m.typicalLatencyMs,
          isLocal: m.isLocal,
        },
      });
  }
  console.log(`Seeded ${SEED_MODELS.length} models.`);
  sqlite.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
