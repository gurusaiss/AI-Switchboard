import type { ProviderAdapter, AdapterRequest } from './types';
import { ProviderNotConnectedError } from './types';
import type { Capability, ModelInfo, NormalizedResponse } from '../lib/types';
import { withResilience } from './resilience';

const API_BASE = 'https://api.openai.com/v1';

export class OpenAIAdapter implements ProviderAdapter {
  provider = 'openai';

  capabilities(): Capability[] {
    return ['reasoning', 'coding', 'vision', 'structuredOutput', 'toolUse', 'creative', 'research'];
  }

  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    if (!apiKey) throw new ProviderNotConnectedError('OpenAI');
    return withResilience('openai', async () => {
      const res = await fetch(`${API_BASE}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!res.ok) {
        throw new Error(`OpenAI listModels failed: ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as { data: { id: string }[] };
      return data.data
        .filter((m) => /gpt|o1/.test(m.id))
        .map((m) => toModelInfo(m.id));
    });
  }

  async send(request: AdapterRequest): Promise<NormalizedResponse> {
    if (!request.apiKey) throw new ProviderNotConnectedError('OpenAI');
    const start = Date.now();
    return withResilience(
      'openai',
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
          throw new Error(`OpenAI request failed: ${res.status} ${body.slice(0, 200)}`);
        }
        const data = (await res.json()) as {
          choices: { message: { content: string } }[];
          usage?: { prompt_tokens: number; completion_tokens: number };
        };
        const text = data.choices?.[0]?.message?.content ?? '';
        return {
          text,
          isDemo: false,
          provider: 'openai' as const,
          modelId: request.modelId,
          latencyMs: Date.now() - start,
          usage: data.usage
            ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
            : undefined,
          estCost: 0, // computed by caller from the registry's pricing + usage
          raw: data,
        };
      },
      { timeoutMs: request.timeoutMs ?? 30000, maxRetries: 2 }
    );
  }
}

function toModelInfo(modelId: string): ModelInfo {
  return {
    id: `openai:${modelId}`,
    provider: 'openai',
    modelId,
    displayName: modelId,
    modality: ['text'],
    contextWindow: 128000,
    capabilities: ['reasoning', 'coding'],
    pricingInputPer1k: 0,
    pricingOutputPer1k: 0,
    typicalLatencyMs: 1500,
    reliabilityScore: 0.9,
    isLocal: false,
  };
}
