import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '../../../lib/auth';
import { listAllModels } from '../../../registry';
import { getUsableModelIds, buildKeyResolver } from '../../../lib/providerService';
import { getAdapter } from '../../../adapters';
import { jsonError, withErrorHandling } from '../../../lib/api-helpers';
import type { ProviderName } from '../../../lib/types';

const bodySchema = z.object({
  prompt: z.string().min(1),
  modelIds: z.array(z.string()).min(2).max(4),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { workspaceId } = await requireSession();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid input');
  }
  const { prompt, modelIds } = parsed.data;

  const registry = await listAllModels();
  const usableModelIds = await getUsableModelIds(workspaceId, registry);
  const resolveApiKey = await buildKeyResolver(workspaceId);

  const unusable = modelIds.filter((id) => !usableModelIds.has(id));
  if (unusable.length > 0) {
    return jsonError(`These models are not usable (connect the provider first): ${unusable.join(', ')}`, 422);
  }

  const results = await Promise.all(
    modelIds.map(async (id) => {
      const model = registry.find((m) => m.id === id);
      if (!model) {
        return { modelId: id, error: 'Unknown model', isDemo: false };
      }
      try {
        const adapter = getAdapter(model.provider as ProviderName);
        const apiKey =
          model.provider === 'mock' || model.provider === 'ollama'
            ? undefined
            : resolveApiKey(model.provider as ProviderName);
        const start = Date.now();
        const response = await adapter.send({ modelId: model.modelId, prompt, apiKey });
        const latencyMs = response.latencyMs || Date.now() - start;
        const estCost = response.usage
          ? Number(
              (
                (response.usage.inputTokens / 1000) * model.pricingInputPer1k +
                (response.usage.outputTokens / 1000) * model.pricingOutputPer1k
              ).toFixed(6)
            )
          : 0;
        return {
          modelId: id,
          response: response.text,
          latencyMs,
          estCost,
          isDemo: response.isDemo,
        };
      } catch (err) {
        return {
          modelId: id,
          error: err instanceof Error ? err.message : 'Request failed',
          isDemo: model.provider === 'mock',
        };
      }
    })
  );

  return NextResponse.json({ results });
});
