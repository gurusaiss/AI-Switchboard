import type { Capability, ModelInfo, NormalizedResponse } from '../lib/types';

export interface AdapterRequest {
  modelId: string; // provider's own model id (ModelInfo.modelId, not the registry id)
  prompt: string;
  apiKey?: string; // decrypted key, held in memory only for the duration of the call
  timeoutMs?: number;
}

export interface ProviderAdapter {
  provider: string;
  send(request: AdapterRequest): Promise<NormalizedResponse>;
  listModels(apiKey?: string): Promise<ModelInfo[]>;
  capabilities(): Capability[];
}

/** Thrown when a real-provider adapter is invoked without a configured key. */
export class ProviderNotConnectedError extends Error {
  constructor(provider: string) {
    super(`${provider} is not connected. Connect this provider first (add an API key on /providers).`);
    this.name = 'ProviderNotConnectedError';
  }
}
