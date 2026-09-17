import type { ProviderAdapter } from './types';
import type { ProviderName } from '../lib/types';
import { MockAdapter } from './mock';
import { OpenAIAdapter } from './openai';
import { AnthropicAdapter } from './anthropic';
import { GoogleAdapter } from './google';
import { OpenRouterAdapter } from './openrouter';
import { OllamaAdapter } from './ollama';

const adapters: Record<ProviderName, ProviderAdapter> = {
  mock: new MockAdapter(),
  openai: new OpenAIAdapter(),
  anthropic: new AnthropicAdapter(),
  google: new GoogleAdapter(),
  openrouter: new OpenRouterAdapter(),
  ollama: new OllamaAdapter(),
};

export function getAdapter(provider: ProviderName): ProviderAdapter {
  const adapter = adapters[provider];
  if (!adapter) throw new Error(`Unknown provider: ${provider}`);
  return adapter;
}

export * from './types';
