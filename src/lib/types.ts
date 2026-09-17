// Core shared types: the Universal Task Object, capabilities, routing modes, etc.

export type Capability =
  | 'coding'
  | 'reasoning'
  | 'vision'
  | 'structuredOutput'
  | 'toolUse'
  | 'creative'
  | 'research';

export type Modality = 'text' | 'vision' | 'image' | 'audio';

export type RoutingMode = 'auto' | 'quality' | 'speed' | 'cost' | 'privacy' | 'manual';

export type QualityRequirement = 'low' | 'standard' | 'high';
export type LatencyRequirement = 'relaxed' | 'normal' | 'strict';
export type PrivacyLevel = 'standard' | 'sensitive';
export type OutputFormat = 'text' | 'json' | 'code';

/** The Universal Task Object: the internal representation of "what the user wants done",
 * independent of which model ends up handling it. */
export interface UniversalTask {
  intent: string; // free-text summary/label of the task
  modality: Modality;
  input: string; // the raw user prompt
  context?: string;
  requiredCapabilities: Capability[];
  qualityRequirement: QualityRequirement;
  latencyRequirement: LatencyRequirement;
  budget?: 'low' | 'standard' | 'high';
  privacyLevel: PrivacyLevel;
  tools?: string[];
  outputFormat: OutputFormat;
}

export interface ModelInfo {
  id: string; // registry id, e.g. "openai:gpt-4o-mini"
  provider: ProviderName;
  modelId: string;
  displayName: string;
  modality: Modality[];
  contextWindow: number;
  capabilities: Capability[];
  pricingInputPer1k: number;
  pricingOutputPer1k: number;
  typicalLatencyMs: number;
  reliabilityScore: number;
  isLocal: boolean;
}

export type ProviderName = 'openai' | 'anthropic' | 'google' | 'openrouter' | 'ollama' | 'mock';

export interface NormalizedResponse {
  text: string;
  isDemo: boolean;
  provider: ProviderName;
  modelId: string;
  latencyMs: number;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
  estCost: number;
  raw?: unknown;
}

export interface ExplainabilityTrace {
  detectedRequirements: {
    intent: string;
    capabilities: Capability[];
    qualityRequirement: QualityRequirement;
    latencyRequirement: LatencyRequirement;
    privacyLevel: PrivacyLevel;
  };
  chosenModelId: string;
  reason: string;
  fallbackChain: string[];
  routingMode: RoutingMode;
  scored: { modelId: string; score: number }[];
}
