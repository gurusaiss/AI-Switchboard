import type {
  Capability,
  LatencyRequirement,
  Modality,
  OutputFormat,
  PrivacyLevel,
  QualityRequirement,
  RoutingMode,
  UniversalTask,
} from '../lib/types';

// Rule-based keyword/heuristic task classifier. Deliberately simple and transparent
// (not an LLM call) so its reasoning can be shown to the user verbatim.
//
// CRITICAL: this function must never throw. Any internal error is caught and the
// pipeline falls back to a deterministic default task (general reasoning), because
// the router must never be a single point of failure.

const CODE_KEYWORDS = /\b(function|bug|refactor|code|debug|stack trace|compile|error:|class |def |const |typescript|javascript|python|regex|algorithm|unit test)\b/i;
const CODE_FENCE = /```/;
const VISION_KEYWORDS = /\b(image|logo|picture|photo|screenshot|diagram|chart|visualize|draw|sketch)\b/i;
const RESEARCH_KEYWORDS = /\b(research|sources|compare studies|citations|literature review|survey the|state of the art|studies show)\b/i;
const CREATIVE_KEYWORDS = /\b(poem|story|creative|write a song|brainstorm|slogan|tagline|fiction)\b/i;
const STRUCTURED_KEYWORDS = /\b(json|schema|structured output|csv|yaml)\b/i;
const TOOL_KEYWORDS = /\b(call the api|use a tool|search the web|look up|fetch data)\b/i;
const PRIVACY_KEYWORDS = /\b(confidential|private|sensitive|do not share|pii|personal data|local only|offline)\b/i;
const URGENT_KEYWORDS = /\b(quick|fast|asap|urgent|right now|immediately)\b/i;
const HIGH_QUALITY_KEYWORDS = /\b(thorough|detailed|comprehensive|in-depth|carefully|rigorous|production-grade)\b/i;

export function parseTask(
  input: string,
  opts?: { routingMode?: RoutingMode; context?: string }
): UniversalTask {
  try {
    return parseTaskInner(input, opts);
  } catch {
    // Deterministic degrade: never let classification failure sink the whole request.
    return defaultTask(input, opts?.context);
  }
}

function parseTaskInner(input: string, opts?: { routingMode?: RoutingMode; context?: string }): UniversalTask {
  const text = input || '';
  const capabilities: Set<Capability> = new Set();
  let intent = 'general assistance';
  let modality: Modality = 'text';
  let outputFormat: OutputFormat = 'text';

  if (CODE_FENCE.test(text) || CODE_KEYWORDS.test(text)) {
    capabilities.add('coding');
    capabilities.add('reasoning');
    intent = 'coding task';
    outputFormat = 'code';
  }
  if (VISION_KEYWORDS.test(text)) {
    capabilities.add('vision');
    modality = 'vision';
    intent = capabilities.has('coding') ? intent : 'visual task';
  }
  if (RESEARCH_KEYWORDS.test(text)) {
    capabilities.add('research');
    capabilities.add('reasoning');
    intent = capabilities.has('coding') ? intent : 'research task';
  }
  if (CREATIVE_KEYWORDS.test(text)) {
    capabilities.add('creative');
    intent = capabilities.has('coding') || capabilities.has('research') ? intent : 'creative task';
  }
  if (STRUCTURED_KEYWORDS.test(text)) {
    capabilities.add('structuredOutput');
    outputFormat = 'json';
  }
  if (TOOL_KEYWORDS.test(text)) {
    capabilities.add('toolUse');
  }

  if (capabilities.size === 0) {
    capabilities.add('reasoning');
  }

  const privacyLevel: PrivacyLevel = PRIVACY_KEYWORDS.test(text) ? 'sensitive' : 'standard';
  const latencyRequirement: LatencyRequirement = URGENT_KEYWORDS.test(text) ? 'strict' : 'normal';
  const qualityRequirement: QualityRequirement = HIGH_QUALITY_KEYWORDS.test(text) ? 'high' : 'standard';

  return {
    intent,
    modality,
    input: text,
    context: opts?.context,
    requiredCapabilities: Array.from(capabilities),
    qualityRequirement,
    latencyRequirement,
    privacyLevel,
    outputFormat,
  };
}

function defaultTask(input: string, context?: string): UniversalTask {
  return {
    intent: 'general assistance (fallback classification)',
    modality: 'text',
    input: input || '',
    context,
    requiredCapabilities: ['reasoning'],
    qualityRequirement: 'standard',
    latencyRequirement: 'normal',
    privacyLevel: 'standard',
    outputFormat: 'text',
  };
}
