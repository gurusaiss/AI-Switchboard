import type { ExplainabilityTrace, ModelInfo, NormalizedResponse, RoutingMode } from '../lib/types';
import { parseTask } from './taskParser';
import { filterCandidates, scoreCandidates } from './scoring';
import { validateOutput } from './validate';
import { getAdapter } from '../adapters';
import type { ProviderName } from '../lib/types';

export interface RunPipelineOptions {
  input: string;
  routingMode: RoutingMode;
  registry: ModelInfo[];
  usableModelIds: Set<string>;
  /** Returns the decrypted API key for a provider, or undefined if not connected.
   * Kept as an injected resolver so routing logic never touches storage/decryption
   * directly, and so it stays testable against Mock with no DB at all. */
  resolveApiKey: (provider: ProviderName) => string | undefined;
  /** Required for manual mode: the registry id the user explicitly picked. */
  manualModelId?: string;
  /** Max number of candidates to actually try before giving up (bounded fallback). */
  maxAttempts?: number;
}

export interface PipelineResult {
  response: NormalizedResponse;
  trace: ExplainabilityTrace;
  attempts: { modelId: string; success: boolean; error?: string }[];
}

export class NoCandidatesError extends Error {
  constructor() {
    super('No usable models satisfy this task\'s requirements. Connect a provider or try Mock.');
  }
}

export class AllCandidatesFailedError extends Error {
  attempts: { modelId: string; error: string }[];
  constructor(attempts: { modelId: string; error: string }[]) {
    super('All candidate models failed for this request.');
    this.attempts = attempts;
  }
}

export async function runPipeline(opts: RunPipelineOptions): Promise<PipelineResult> {
  const task = parseTask(opts.input, { routingMode: opts.routingMode });

  const filtered = filterCandidates(task, opts.registry, opts.usableModelIds);
  if (filtered.length === 0) {
    throw new NoCandidatesError();
  }

  const scored = scoreCandidates(task, filtered, opts.routingMode);

  // Build the ordered attempt list: manual mode tries the user's pick first (if it's
  // actually usable), then falls back to the normal score order for resilience.
  let orderedIds = scored.map((s) => s.model.id);
  let reason = reasonFor(opts.routingMode, scored[0]?.model, task);

  if (opts.routingMode === 'manual' && opts.manualModelId) {
    const rest = orderedIds.filter((id) => id !== opts.manualModelId);
    if (opts.usableModelIds.has(opts.manualModelId) && filtered.some((m) => m.id === opts.manualModelId)) {
      orderedIds = [opts.manualModelId, ...rest];
      reason = 'Manually selected by the user.';
    }
  }

  const maxAttempts = Math.min(opts.maxAttempts ?? orderedIds.length, orderedIds.length);
  const attempts: { modelId: string; success: boolean; error?: string }[] = [];

  for (let i = 0; i < maxAttempts; i++) {
    const modelId = orderedIds[i];
    const model = filtered.find((m) => m.id === modelId)!;
    try {
      const adapter = getAdapter(model.provider as ProviderName);
      const apiKey = model.provider === 'mock' || model.provider === 'ollama'
        ? undefined
        : opts.resolveApiKey(model.provider as ProviderName);

      const response = await adapter.send({ modelId: model.modelId, prompt: opts.input, apiKey });
      const validation = validateOutput(task, response.text);
      if (!validation.ok) {
        throw new Error(`Output validation failed: ${validation.reason}`);
      }

      response.estCost = estimateCost(model, response);
      attempts.push({ modelId, success: true });

      const trace: ExplainabilityTrace = {
        detectedRequirements: {
          intent: task.intent,
          capabilities: task.requiredCapabilities,
          qualityRequirement: task.qualityRequirement,
          latencyRequirement: task.latencyRequirement,
          privacyLevel: task.privacyLevel,
        },
        chosenModelId: modelId,
        reason: i === 0 ? reason : `${reason} (fell back after: ${attempts.slice(0, -1).map((a) => a.modelId).join(', ')} failed)`,
        fallbackChain: orderedIds,
        routingMode: opts.routingMode,
        scored: scored.map((s) => ({ modelId: s.model.id, score: Number(s.score.toFixed(4)) })),
      };

      return { response, trace, attempts };
    } catch (err) {
      attempts.push({ modelId, success: false, error: err instanceof Error ? err.message : String(err) });
      // continue to next candidate (bounded by maxAttempts)
    }
  }

  throw new AllCandidatesFailedError(
    attempts.filter((a) => !a.success).map((a) => ({ modelId: a.modelId, error: a.error ?? 'unknown error' }))
  );
}

function estimateCost(model: ModelInfo, response: NormalizedResponse): number {
  if (!response.usage) return 0;
  const inputCost = (response.usage.inputTokens / 1000) * model.pricingInputPer1k;
  const outputCost = (response.usage.outputTokens / 1000) * model.pricingOutputPer1k;
  return Number((inputCost + outputCost).toFixed(6));
}

function reasonFor(mode: RoutingMode, top: ModelInfo | undefined, task: ReturnType<typeof parseTask>): string {
  if (!top) return 'No candidate selected.';
  const caps = task.requiredCapabilities.join(', ');
  switch (mode) {
    case 'quality':
      return `Chose ${top.displayName}: highest reliability/capability match for required [${caps}] in Quality mode.`;
    case 'speed':
      return `Chose ${top.displayName}: lowest typical latency (~${top.typicalLatencyMs}ms) among models supporting [${caps}] in Speed mode.`;
    case 'cost':
      return `Chose ${top.displayName}: lowest estimated cost among models supporting [${caps}] in Cost mode.`;
    case 'privacy':
      return top.isLocal
        ? `Chose ${top.displayName}: a local/private model, preferred in Privacy mode.`
        : `Chose ${top.displayName}: no local model was usable, so the highest-privacy-score connected model was used.`;
    default:
      return `Chose ${top.displayName}: best balanced score across cost, latency, and reliability for [${caps}] (Auto mode).`;
  }
}
