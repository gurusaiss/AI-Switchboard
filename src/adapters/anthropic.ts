import type { ProviderAdapter, AdapterRequest } from './types';
import { ProviderNotConnectedError } from './types';
import type { Capability, ModelInfo, NormalizedResponse } from '../lib/types';
import { withResilience } from './resilience';

const API_BASE = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

// Anthropic has no public "list models" endpoint usable the same way as OpenAI's;
// we return a known-good static set when a key is present (still a real, working
// adapter for `send` - just not a live model discovery call).
const KNOWN_MODELS = [
  'claude-sonnet-4-5-20250929',
  'claude-haiku-4-5-20251001',
  'claude-opus-4-1-20250805',
];

export class AnthropicAdapter implements ProviderAdapter {
  provider = 'anthropic';

  capabilities(): Capability[] {
    return ['reasoning', 'coding', 'vision', 'structuredOutput', 'toolUse', 'creative', 'research'];
  }

  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    if (!apiKey) throw new ProviderNotConnectedError('Anthropic');
    return KNOWN_MODELS.map(toModelInfo);
  }

  async send(request: AdapterRequest): Promise<NormalizedResponse> {
    if (!request.apiKey) throw new ProviderNotConnectedError('Anthropic');
    const start = Date.now();
    return withResilience(
      'anthropic',
      async () => {
        const res = await fetch(`${API_BASE}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': request.apiKey!,
            'anthropic-version': ANTHROPIC_VERSION,
          },
          body: JSON.stringify({
            model: request.modelId,
            max_tokens: 1024,
            messages: [{ role: 'user', content: request.prompt }],
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Anthropic request failed: ${res.status} ${body.slice(0, 200)}`);
        }
        const data = (await res.json()) as {
          content: { type: string; text?: string }[];
          usage?: { input_tokens: number; output_tokens: number };
        };
        const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
        return {
          text,
          isDemo: false,
          provider: 'anthropic' as const,
          modelId: request.modelId,
          latencyMs: Date.now() - start,
          usage: data.usage
            ? { inputTokens: data.usage.input_tokens, outputTokens: data.usage.output_tokens }
            : undefined,
          estCost: 0,
          raw: data,
        };
      },
      { timeoutMs: request.timeoutMs ?? 30000, maxRetries: 2 }
    );
  }
}

function toModelInfo(modelId: string): ModelInfo {
  return {
    id: `anthropic:${modelId}`,
    provider: 'anthropic',
    modelId,
    displayName: modelId,
    modality: ['text', 'vision'],
    contextWindow: 200000,
    capabilities: ['reasoning', 'coding', 'vision'],
    pricingInputPer1k: 0,
    pricingOutputPer1k: 0,
    typicalLatencyMs: 1800,
    reliabilityScore: 0.9,
    isLocal: false,
  };
}
