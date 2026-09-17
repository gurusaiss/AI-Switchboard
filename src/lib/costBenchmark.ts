import type { Capability, ModelInfo, NormalizedResponse } from './types';

/**
 * Real cost-savings computation: what would this exact request (same token usage)
 * have cost at the most expensive model in the whole registry that still satisfies
 * the request's detected capabilities? Used to compute "estimated savings from
 * routing" on the usage dashboard. Returns 0 (never a placeholder/fake number) when
 * there's no token usage to compare against.
 */
export function benchmarkCostFor(
  registry: ModelInfo[],
  requiredCapabilities: Capability[],
  response: NormalizedResponse
): number {
  if (!response.usage) return 0;
  const capable = registry.filter((m) => requiredCapabilities.every((c) => m.capabilities.includes(c)));
  if (capable.length === 0) return 0;
  const mostExpensive = capable.reduce((max, m) =>
    m.pricingInputPer1k + m.pricingOutputPer1k > max.pricingInputPer1k + max.pricingOutputPer1k ? m : max
  );
  const cost =
    (response.usage.inputTokens / 1000) * mostExpensive.pricingInputPer1k +
    (response.usage.outputTokens / 1000) * mostExpensive.pricingOutputPer1k;
  return Number(cost.toFixed(6));
}
