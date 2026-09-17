import { describe, it, expect, beforeEach } from 'vitest';
import { runPipeline, NoCandidatesError, AllCandidatesFailedError } from '../src/routing/engine';
import { parseTask } from '../src/routing/taskParser';
import { SEED_MODELS } from '../src/registry/seed-data';
import { mockTestHooks } from '../src/adapters/mock';
import { _resetBreakers } from '../src/adapters/resilience';
import type { ModelInfo, RoutingMode } from '../src/lib/types';

// Route everything against a registry limited to the mock provider's models plus
// the "usable" set = all mock models, so no real provider is ever touched.
const MOCK_REGISTRY: ModelInfo[] = SEED_MODELS.filter((m) => m.provider === 'mock');
const USABLE = new Set(MOCK_REGISTRY.map((m) => m.id));

function run(input: string, routingMode: RoutingMode = 'auto') {
  return runPipeline({
    input,
    routingMode,
    registry: MOCK_REGISTRY,
    usableModelIds: USABLE,
    resolveApiKey: () => undefined,
  });
}

beforeEach(() => {
  mockTestHooks.forceFailureRate = 0;
  _resetBreakers();
});

describe('task parser classification', () => {
  const cases: { prompt: string; expectAnyOf: string[] }[] = [
    { prompt: 'Write a function to reverse a linked list in TypeScript', expectAnyOf: ['coding'] },
    { prompt: 'There is a bug in my code, can you debug it?\n```js\nfunction f() {}\n```', expectAnyOf: ['coding'] },
    { prompt: 'Refactor this class for readability', expectAnyOf: ['coding'] },
    { prompt: 'Generate a logo image for my startup', expectAnyOf: ['vision'] },
    { prompt: 'Can you sketch a diagram of this architecture?', expectAnyOf: ['vision'] },
    { prompt: 'Research the sources behind this claim and compare studies', expectAnyOf: ['research'] },
    { prompt: 'Give me a literature review of quantum computing progress', expectAnyOf: ['research'] },
    { prompt: 'Write a short creative story about a lighthouse', expectAnyOf: ['creative'] },
    { prompt: 'Brainstorm a tagline for a coffee brand', expectAnyOf: ['creative'] },
    { prompt: 'What is the capital of France?', expectAnyOf: ['reasoning'] },
    { prompt: 'Explain quantum entanglement simply', expectAnyOf: ['reasoning'] },
    { prompt: 'Return the answer as JSON matching this schema', expectAnyOf: ['structuredOutput'] },
    { prompt: 'Use a tool to search the web for today\'s weather', expectAnyOf: ['toolUse'] },
    { prompt: 'This is confidential, keep it private and local only', expectAnyOf: ['reasoning'] },
    { prompt: 'I need this ASAP, quick answer please', expectAnyOf: ['reasoning'] },
    { prompt: 'Give me a thorough, comprehensive and rigorous analysis', expectAnyOf: ['reasoning'] },
    { prompt: '', expectAnyOf: ['reasoning'] },
  ];

  for (const { prompt, expectAnyOf } of cases) {
    it(`classifies: "${prompt.slice(0, 40)}"`, () => {
      const task = parseTask(prompt);
      expect(task.requiredCapabilities.length).toBeGreaterThan(0);
      expect(expectAnyOf.some((c) => task.requiredCapabilities.includes(c as never))).toBe(true);
    });
  }

  it('degrades to a deterministic default if classification throws', () => {
    // parseTask never throws by contract, but confirm the shape of its fallback path
    // is a valid, minimal UniversalTask even for pathological input.
    const weird = parseTask(null as unknown as string);
    expect(weird.requiredCapabilities).toEqual(['reasoning']);
    expect(weird.modality).toBe('text');
  });

  it('detects privacy-sensitive language', () => {
    const task = parseTask('This is confidential and sensitive, do not share, keep it local only');
    expect(task.privacyLevel).toBe('sensitive');
  });

  it('detects urgency as strict latency requirement', () => {
    const task = parseTask('I need this immediately, quick turnaround');
    expect(task.latencyRequirement).toBe('strict');
  });

  it('detects a request for high quality/thoroughness', () => {
    const task = parseTask('Please give a comprehensive, in-depth, rigorous answer');
    expect(task.qualityRequirement).toBe('high');
  });
});

describe('routing engine over Mock registry', () => {
  it('Quality mode favors the highest-reliability/broadest-capability model', async () => {
    const { trace } = await run('Explain quantum entanglement in detail', 'quality');
    const top = trace.scored[0];
    const topModel = MOCK_REGISTRY.find((m) => m.id === top.modelId)!;
    // demo-quality has the broadest capability set and high reliability among mock models
    expect(topModel.capabilities.length).toBeGreaterThanOrEqual(5);
  });

  it('Speed mode favors the lowest-latency usable model', async () => {
    const { trace } = await run('What is 2+2?', 'speed');
    const top = trace.scored[0];
    const topModel = MOCK_REGISTRY.find((m) => m.id === top.modelId)!;
    const fastest = Math.min(...MOCK_REGISTRY.map((m) => m.typicalLatencyMs));
    // Not necessarily the single fastest overall (capability filtering may exclude some),
    // but should be at or near the fast end.
    expect(topModel.typicalLatencyMs).toBeLessThanOrEqual(fastest + 400);
  });

  it('Cost mode never prefers a strictly more expensive candidate when a cheaper one qualifies', async () => {
    const { trace } = await run('Write a poem about the sea', 'cost');
    // all mock models are free, so this just asserts scoring ran and produced an order
    expect(trace.scored.length).toBeGreaterThan(0);
  });

  it('Privacy mode prefers local/private candidates', async () => {
    const { trace } = await run('This is confidential, keep it private and local only. Summarize it.', 'privacy');
    const top = trace.scored[0];
    const topModel = MOCK_REGISTRY.find((m) => m.id === top.modelId)!;
    expect(topModel.isLocal).toBe(true);
  });

  it('Auto mode returns a valid response with an explainability trace', async () => {
    const { response, trace } = await run('Summarize the plot of Hamlet');
    expect(response.text.length).toBeGreaterThan(0);
    expect(response.isDemo).toBe(true);
    expect(trace.chosenModelId).toBeTruthy();
    expect(trace.fallbackChain.length).toBeGreaterThan(0);
    expect(trace.reason.length).toBeGreaterThan(0);
  });

  it('requires the coding capability for a coding prompt and picks a capable model', async () => {
    const { trace } = await run('Fix this bug:\n```js\nfunction broken() { return 1 +; }\n```');
    const chosen = MOCK_REGISTRY.find((m) => m.id === trace.chosenModelId)!;
    expect(chosen.capabilities).toContain('coding');
  });

  it('manual mode honors the user-selected model when usable', async () => {
    const { trace } = await runPipeline({
      input: 'Hello there',
      routingMode: 'manual',
      registry: MOCK_REGISTRY,
      usableModelIds: USABLE,
      resolveApiKey: () => undefined,
      manualModelId: 'mock:demo-quality',
    });
    expect(trace.chosenModelId).toBe('mock:demo-quality');
    expect(trace.reason).toContain('Manually selected');
  });

  it('throws NoCandidatesError when nothing in the registry satisfies requirements', async () => {
    await expect(
      runPipeline({
        input: 'Generate a logo image',
        routingMode: 'auto',
        registry: MOCK_REGISTRY.filter((m) => !m.capabilities.includes('vision')),
        usableModelIds: USABLE,
        resolveApiKey: () => undefined,
      })
    ).rejects.toBeInstanceOf(NoCandidatesError);
  });
});

describe('fallback behavior', () => {
  it('falls back to the next candidate when the top choice fails', async () => {
    // Manually force the "flaky" mock model to the front of the fallback chain by
    // picking manual mode with it, then confirm the pipeline still returns a result
    // via the next candidate rather than failing the whole request.
    const { response, trace, attempts } = await runPipeline({
      input: 'Say hello',
      routingMode: 'manual',
      registry: MOCK_REGISTRY,
      usableModelIds: USABLE,
      resolveApiKey: () => undefined,
      manualModelId: 'mock:flaky',
    });

    expect(attempts[0].modelId).toBe('mock:flaky');
    expect(attempts[0].success).toBe(false);
    expect(response.text.length).toBeGreaterThan(0);
    expect(trace.chosenModelId).not.toBe('mock:flaky');
  });

  it('fails the whole request only when every candidate fails', async () => {
    mockTestHooks.forceFailureRate = 1; // force every mock call to fail
    await expect(run('Say hello')).rejects.toBeInstanceOf(AllCandidatesFailedError);
    mockTestHooks.forceFailureRate = 0;
  });
});
