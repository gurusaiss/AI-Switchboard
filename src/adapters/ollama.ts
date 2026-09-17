import type { ProviderAdapter, AdapterRequest } from './types';
import { ProviderNotConnectedError } from './types';
import type { Capability, ModelInfo, NormalizedResponse } from '../lib/types';
import { withResilience } from './resilience';

// Ollama runs locally with no API key - "connecting" it means detecting that a local
// Ollama server is reachable, not supplying a secret.
const API_BASE = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

export class OllamaAdapter implements ProviderAdapter {
  provider = 'ollama';

  capabilities(): Capability[] {
    return ['reasoning', 'coding', 'creative'];
  }

  async listModels(): Promise<ModelInfo[]> {
    try {
      const res = await fetch(`${API_BASE}/api/tags`, { signal: AbortSignal.timeout(3000) });
      if (!res.ok) throw new Error(`Ollama /api/tags failed: ${res.status}`);
      const data = (await res.json()) as { models: { name: string }[] };
      return data.models.map((m) => toModelInfo(m.name));
    } catch (err) {
      throw new ProviderNotConnectedError('Ollama (no local server detected at ' + API_BASE + ')');
    }
  }

  async send(request: AdapterRequest): Promise<NormalizedResponse> {
    const start = Date.now();
    return withResilience(
      'ollama',
      async () => {
        let res: Response;
        try {
          res = await fetch(`${API_BASE}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: request.modelId, prompt: request.prompt, stream: false }),
          });
        } catch {
          throw new ProviderNotConnectedError('Ollama (no local server detected at ' + API_BASE + ')');
        }
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`Ollama request failed: ${res.status} ${body.slice(0, 200)}`);
        }
        const data = (await res.json()) as {
          response: string;
          prompt_eval_count?: number;
          eval_count?: number;
        };
        return {
          text: data.response ?? '',
          isDemo: false,
          provider: 'ollama' as const,
          modelId: request.modelId,
          latencyMs: Date.now() - start,
          usage:
            data.prompt_eval_count !== undefined
              ? { inputTokens: data.prompt_eval_count, outputTokens: data.eval_count ?? 0 }
              : undefined,
          estCost: 0, // local inference - no per-token billing
          raw: data,
        };
      },
      { timeoutMs: request.timeoutMs ?? 60000, maxRetries: 2 }
    );
  }
}

function toModelInfo(modelId: string): ModelInfo {
  return {
    id: `ollama:${modelId}`,
    provider: 'ollama',
    modelId,
    displayName: `${modelId} (local)`,
    modality: ['text'],
    contextWindow: 32768,
    capabilities: ['reasoning', 'coding', 'creative'],
    pricingInputPer1k: 0,
    pricingOutputPer1k: 0,
    typicalLatencyMs: 2200,
    reliabilityScore: 0.85,
    isLocal: true,
  };
}
