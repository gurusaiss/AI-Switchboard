import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '../../../lib/auth';
import { scopedQueries } from '../../../db/scoped';
import { listAllModels, recordOutcome } from '../../../registry';
import { getUsableModelIds, buildKeyResolver } from '../../../lib/providerService';
import { runPipeline, NoCandidatesError, AllCandidatesFailedError } from '../../../routing/engine';
import { newId } from '../../../lib/ids';
import { jsonError, withErrorHandling } from '../../../lib/api-helpers';
import { safeLog } from '../../../lib/redact';
import { benchmarkCostFor } from '../../../lib/costBenchmark';
import { assertSameOrigin } from '../../../lib/csrf';
import { executeRateLimiter } from '../../../lib/rateLimit';

const bodySchema = z.object({
  prompt: z.string().min(1),
  routingMode: z.enum(['auto', 'quality', 'speed', 'cost', 'privacy', 'manual']).default('auto'),
  manualModelId: z.string().optional(),
  conversationId: z.string().optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  assertSameOrigin(req);
  const { workspaceId } = await requireSession();
  executeRateLimiter.consume(workspaceId);
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid input');
  }
  const { prompt, routingMode, manualModelId, conversationId } = parsed.data;

  const queries = scopedQueries(workspaceId);
  const registry = await listAllModels();
  const usableModelIds = await getUsableModelIds(workspaceId, registry);
  const resolveApiKey = await buildKeyResolver(workspaceId);

  let pipelineResult;
  try {
    pipelineResult = await runPipeline({
      input: prompt,
      routingMode,
      registry,
      usableModelIds,
      resolveApiKey,
      manualModelId,
    });
  } catch (err) {
    if (err instanceof NoCandidatesError) return jsonError(err.message, 422);
    if (err instanceof AllCandidatesFailedError) {
      safeLog.error('All candidates failed for execute request', { attempts: err.attempts });
      return jsonError('All candidate models failed for this request. Please try again.', 502);
    }
    throw err;
  }

  const { response, trace } = pipelineResult;

  // Persist: conversation (create if needed) + both messages + usage event + routing decision.
  let convoId = conversationId;
  if (!convoId) {
    convoId = newId('conv');
    await queries.insertConversation({
      id: convoId,
      title: prompt.slice(0, 60),
      createdAt: new Date(),
    });
  } else {
    const existing = await queries.getConversation(convoId);
    if (!existing) return jsonError('Conversation not found', 404);
  }

  await queries.insertMessage({
    id: newId('msg'),
    conversationId: convoId,
    role: 'user',
    content: prompt,
    modelId: null,
    isDemo: false,
    createdAt: new Date(),
  });
  await queries.insertMessage({
    id: newId('msg'),
    conversationId: convoId,
    role: 'assistant',
    content: response.text,
    modelId: trace.chosenModelId,
    isDemo: response.isDemo,
    createdAt: new Date(),
  });

  await queries.insertUsageEvent({
    id: newId('usage'),
    modelId: trace.chosenModelId,
    provider: response.provider,
    latencyMs: response.latencyMs,
    estCost: response.estCost,
    benchmarkCost: benchmarkCostFor(registry, trace.detectedRequirements.capabilities, response),
    success: true,
    isDemo: response.isDemo,
    createdAt: new Date(),
  });

  await queries.insertRoutingDecision({
    id: newId('route'),
    conversationId: convoId,
    taskRequirements: trace.detectedRequirements,
    chosenModelId: trace.chosenModelId,
    reason: trace.reason,
    fallbackChain: trace.fallbackChain,
    routingMode,
    createdAt: new Date(),
  });

  await recordOutcome(trace.chosenModelId, true);

  return NextResponse.json({
    conversationId: convoId,
    response: {
      text: response.text,
      isDemo: response.isDemo,
      provider: response.provider,
      modelId: response.modelId,
      latencyMs: response.latencyMs,
      estCost: response.estCost,
    },
    trace,
  });
});
