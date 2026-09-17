import type { ProviderAdapter, AdapterRequest } from './types';
import type { Capability, ModelInfo, NormalizedResponse } from '../lib/types';
import { SEED_MODELS } from '../registry/seed-data';
import { withResilience } from './resilience';

// Deterministic, synthetic responses. Every response is clearly labeled isDemo:true.
// Simulates realistic latency and occasional failure so the pipeline's fallback path
// can be exercised in tests without ever calling a real provider.

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Test hook: when true, the "flaky" mock model fails deterministically on every call.
 * Also honored is a per-call forceFail override via a special prompt marker. */
export const mockTestHooks = {
  forceFailureRate: 0 as number, // 0..1, probability any mock call fails (besides the flaky model)
};

export class MockAdapter implements ProviderAdapter {
  provider = 'mock';

  capabilities(): Capability[] {
    return ['reasoning', 'coding', 'vision', 'structuredOutput', 'toolUse', 'creative', 'research'];
  }

  async listModels(): Promise<ModelInfo[]> {
    return SEED_MODELS.filter((m) => m.provider === 'mock');
  }

  async send(request: AdapterRequest): Promise<NormalizedResponse> {
    return withResilience(
      'mock',
      async () => {
        const latency = 150 + (hashString(request.prompt) % 400);
        await sleep(Math.min(latency, 50)); // keep tests fast; still nonzero

        if (request.modelId === 'flaky' || Math.random() < mockTestHooks.forceFailureRate) {
          throw new Error('Mock provider simulated failure (for fallback testing)');
        }

        const text = synthesize(request.modelId, request.prompt);
        return {
          text,
          isDemo: true,
          provider: 'mock' as const,
          modelId: request.modelId,
          latencyMs: latency,
          usage: {
            inputTokens: Math.ceil(request.prompt.length / 4),
            outputTokens: Math.ceil(text.length / 4),
          },
          estCost: 0,
          raw: { demo: true },
        };
      },
      { timeoutMs: 5000, maxRetries: 2 }
    );
  }
}

function synthesize(modelId: string, prompt: string): string {
  const trimmed = prompt.trim();
  const looksLikeCode = /```|function |def |class /.test(trimmed);
  const header = `[DEMO RESPONSE from mock:${modelId} - no real AI provider was called]`;

  if (looksLikeCode) {
    return `${header}\n\nHere is a synthetic response to your coding request:\n\n\`\`\`\n// mock:${modelId} demo output\n// Echoing back a deterministic stub - connect a real provider for actual code generation.\nfunction demoStub() {\n  return "This is a demo response, not real model output.";\n}\n\`\`\``;
  }

  const summary = trimmed.length > 140 ? `${trimmed.slice(0, 140)}...` : trimmed;
  return `${header}\n\nYou asked: "${summary}"\n\nThis is a deterministic, synthetic demo answer standing in for a real model. Connect a real provider (OpenAI, Anthropic, Google, OpenRouter, or a local Ollama) on the Providers page to get real answers.`;
}
