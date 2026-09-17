import type { ProviderAdapter, AdapterRequest } from './types';
import { ProviderNotConnectedError } from './types';
import type { Capability, ModelInfo, NormalizedResponse } from '../lib/types';
import { withResilience } from './resilience';

const API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

export class GoogleAdapter implements ProviderAdapter {
  provider = 'google';

  capabilities(): Capability[] {
    return ['reasoning', 'coding', 'vision', 'structuredOutput', 'toolUse', 'creative', 'research'];
  }

  async listModels(apiKey?: string): Promise<ModelInfo[]> {
    if (!apiKey) throw new ProviderNotConnectedError('Google');
    return withResilience('google', async () => {
      const res = await fetch(`${API_BASE}/models?key=${encodeURIComponent(apiKey)}`);
      if (!res.ok) {
        throw new Error(`Google listModels failed: ${res.status} ${res.statusText}`);
      }
      const data = (await res.json()) as { models: { name: string }[] };
      return data.models
        .filter((m) => m.name.includes('gemini'))
        .map((m) => toModelInfo(m.name.replace('models/', '')));
    });
  }

  async send(request: AdapterRequest): Promise<NormalizedResponse> {
    if (!request.apiKey) throw new ProviderNotConnectedError('Google');
    const start = Date.now();
    return withResilience(
      'google',
      async () => {
        const res = await fetch(
          `${API_BASE}/models/${encodeURIComponent(request.modelId)}:generateContent?key=${encodeURIComponent(
            request.apiKey!
          )}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: request.prompt }] }],
            }),
          }
        );
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Google request failed: ${res.status} ${body.slice(0, 200)}`);
        }
        const data = (await res.json()) as {
          candidates?: { content?: { parts?: { text?: string }[] } }[];
          usageMetadata?: { promptTokenCount: number; candidatesTokenCount: number };
        };
        const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
        return {
          text,
          isDemo: false,
          provider: 'google' as const,
          modelId: request.modelId,
          latencyMs: Date.now() - start,
          usage: data.usageMetadata
            ? {
                inputTokens: data.usageMetadata.promptTokenCount,
                outputTokens: data.usageMetadata.candidatesTokenCount,
              }
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
    id: `google:${modelId}`,
    provider: 'google',
    modelId,
    displayName: modelId,
    modality: ['text', 'vision'],
    contextWindow: 1000000,
    capabilities: ['reasoning', 'coding', 'vision'],
    pricingInputPer1k: 0,
    pricingOutputPer1k: 0,
    typicalLatencyMs: 1200,
    reliabilityScore: 0.9,
    isLocal: false,
  };
}
