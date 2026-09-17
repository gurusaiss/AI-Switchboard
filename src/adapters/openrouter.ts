import type { ProviderAdapter, AdapterRequest } from './types';
import { ProviderNotConnectedError } from './types';
import type { Capability, ModelInfo, NormalizedResponse } from '../lib/types';
import { withResilience } from './resilience';

// OpenRouter exposes an OpenAI-compatible chat completions endpoint.
const API_BASE = 'https://openrouter.ai/api/v1';

export class OpenRouterAdapter implements ProviderAdapter {
  provider = 'openrouter';

  capabilities(): Capability[] {
    return ['reasoning', 'coding', 'creative', 'structuredOutput'];
  }

  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    if (!apiKey) throw new ProviderNotConnectedError('OpenRouter');
    return withResilience('openrouter', async () => {
      const res = await fetch(`${API_BASE}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        throw new Error(`OpenRouter listModels failed: ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as { data: { id: string; context_length?: number }[] };
      return data.data.map((m) => toModelInfo(m.id, m.context_length ?? 32000));
    });
  }

  async send(request: AdapterRequest): Promise<NormalizedResponse> {
    if (!request.apiKey) throw new ProviderNotConnectedError('OpenRouter');
    const start = Date.now();
    return withResilience(
      'openrouter',
      async () => {
        const res = await fetch(`${API_BASE}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${request.apiKey}`,
          },
          body: JSON.stringify({
            model: request.modelId,
            messages: [{ role: 'user', content: request.prompt }],
          }),
        });
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`OpenRouter request failed: ${res.status} ${body.slice(0, 200)}`);
        }
        const data = (await res.json()) as {
          choices: { message: { content: string } }[];
          usage?: { prompt_tokens: number; completion_tokens: number };
        };
        const text = data.choices?.[0]?.message?.content ?? '';
        return {
          text,
          isDemo: false,
          provider: 'openrouter' as const,
          modelId: request.modelId,
          latencyMs: Date.now() - start,
          usage: data.usage
            ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
            : undefined,
          estCost: 0,
          raw: data,
        };
      },
      { timeoutMs: request.timeoutMs ?? 30000, maxRetries: 2 }
    );
  }
}

function toModelInfo(modelId: string, contextWindow: number): ModelInfo {
  return {
    id: `openrouter:${modelId}`,
    provider: 'openrouter',
    modelId,
    displayName: modelId,
    modality: ['text'],
    contextWindow,
    capabilities: ['reasoning', 'coding', 'creative'],
    pricingInputPer1k: 0,
    pricingOutputPer1k: 0,
    typicalLatencyMs: 1500,
    reliabilityScore: 0.88,
    isLocal: false,
  };
}
