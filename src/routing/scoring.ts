import type { ModelInfo, RoutingMode, UniversalTask } from '../lib/types';

export interface ScoredCandidate {
  model: ModelInfo;
  score: number;
}

/** Hard capability filter: a model must be usable at all before it's ranked.
 * usableModelIds is the set of registry ids the caller has confirmed can actually
 * be invoked (Mock always included; a real provider only if connected). */
export function filterCandidates(
  task: UniversalTask,
  registry: ModelInfo[],
  usableModelIds: Set<string>
): ModelInfo[] {
  return registry.filter((m) => {
    if (!usableModelIds.has(m.id)) return false;
    const hasAllCapabilities = task.requiredCapabilities.every((c) => m.capabilities.includes(c));
    if (!hasAllCapabilities) return false;
    // crude context window sufficiency check: assume ~4 chars/token
    const estimatedTokens = Math.ceil((task.input.length + (task.context?.length ?? 0)) / 4);
    if (estimatedTokens > m.contextWindow) return false;
    if (task.modality === 'vision' && !m.modality.includes('vision')) return false;
    return true;
  });
}

/** Weighted-sum scoring. Weights depend on the routing mode; higher score wins.
 * All sub-scores are normalized to roughly [0,1] so weights are comparable. */
export function scoreCandidates(
  task: UniversalTask,
  candidates: ModelInfo[],
  mode: RoutingMode
): ScoredCandidate[] {
  if (candidates.length === 0) return [];

  const maxCostPer1k = Math.max(...candidates.map((c) => c.pricingInputPer1k + c.pricingOutputPer1k), 0.0001);
  const maxLatency = Math.max(...candidates.map((c) => c.typicalLatencyMs), 1);

  const weights = weightsForMode(mode);

  return candidates
    .map((model) => {
      const costScore = 1 - (model.pricingInputPer1k + model.pricingOutputPer1k) / maxCostPer1k; // cheaper = higher
      const latencyScore = 1 - model.typicalLatencyMs / maxLatency; // faster = higher
      const reliabilityScore = model.reliabilityScore; // already 0..1
      const privacyScore = model.isLocal ? 1 : 0.3;

      let score =
        weights.cost * costScore +
        weights.latency * latencyScore +
        weights.reliability * reliabilityScore +
        weights.privacy * privacyScore;

      // Quality requirement nudges toward capability breadth as a proxy for quality.
      if (task.qualityRequirement === 'high') {
        score += 0.05 * (model.capabilities.length / 7);
      }

      // Privacy-sensitive tasks get an extra strong pull toward local models,
      // regardless of the selected mode, since privacy here is a task property,
      // not just a UI preference.
      if (task.privacyLevel === 'sensitive' && model.isLocal) {
        score += 0.25;
      }

      return { model, score };
    })
    .sort((a, b) => b.score - a.score);
}

function weightsForMode(mode: RoutingMode) {
  switch (mode) {
    case 'quality':
      return { cost: 0.05, latency: 0.0, reliability: 0.85, privacy: 0.1 };
    case 'speed':
      return { cost: 0.1, latency: 0.6, reliability: 0.2, privacy: 0.1 };
    case 'cost':
      return { cost: 0.6, latency: 0.15, reliability: 0.2, privacy: 0.05 };
    case 'privacy':
      return { cost: 0.1, latency: 0.1, reliability: 0.2, privacy: 0.6 };
    case 'auto':
    case 'manual':
    default:
      return { cost: 0.25, latency: 0.25, reliability: 0.35, privacy: 0.15 };
  }
}
