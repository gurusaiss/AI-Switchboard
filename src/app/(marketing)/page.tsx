import Link from 'next/link';

const PIPELINE_STEPS = [
  {
    title: 'You type one request',
    body: 'A single composer, not a model picker. Write the task like you would to a person: "refactor this function", "summarize this doc", "draft a landing page".',
  },
  {
    title: 'The task parser reads it',
    body: 'A rule-based classifier detects intent, required capabilities (coding, vision, structured output, tool use, research, creative), quality/latency needs, and whether the content looks privacy-sensitive.',
  },
  {
    title: 'Candidates are filtered and scored',
    body: 'Every model in the registry is checked against hard requirements (capability, context window, modality), then the survivors are ranked with a weighted-sum score across cost, latency, reliability, and privacy - weighted differently per mode (Auto, Quality, Speed, Cost, Privacy, or your own Manual pick).',
  },
  {
    title: 'The request runs, with a real fallback chain',
    body: 'The top-ranked model is called through its own adapter, with a timeout, retry, and circuit breaker. If it fails validation, the next-ranked candidate is tried automatically, up to a bounded number of attempts.',
  },
  {
    title: 'You see the reasoning, not just the answer',
    body: 'Every response comes with an explainability trace: what was detected, which model was chosen and why, the full fallback order, and every candidate\'s score - so routing is a decision you can inspect, not a black box.',
  },
];

const FEATURES = [
  {
    title: 'Bring your own keys',
    body: 'Connect OpenAI, Anthropic, Google, or OpenRouter with your own API key, or run fully local via Ollama. Keys are envelope-encrypted at rest (a per-workspace data key, wrapped by a master key that never touches the database) and only decrypted in memory for the duration of a single request.',
  },
  {
    title: 'Task-aware routing, not a dropdown',
    body: 'Routing is driven by a data-driven model registry and a real scoring pipeline, not a hardcoded if/else chain. Six modes - Auto, Quality, Speed, Cost, Privacy, Manual - change the weights, not the logic.',
  },
  {
    title: '"Why this model?" on every response',
    body: 'An explainability trace shows detected requirements, the chosen model, the reasoning, the fallback order, and every candidate\'s score - in plain view, on every single request.',
  },
  {
    title: 'Compare mode',
    body: 'Run one prompt across 2-4 models side by side and see the actual responses, latency, and cost next to each other before you decide what to trust.',
  },
  {
    title: 'Local/private by design',
    body: 'Ollama support means privacy-sensitive requests can be routed to a model running entirely on your own machine, with $0 marginal cost and nothing leaving your network.',
  },
  {
    title: 'A usage dashboard that means it',
    body: 'Real per-model call counts, success rates, latency, and cost, computed from your own usage events - including an estimated-savings figure comparing what routing actually spent against the most expensive capable model for the same requests.',
  },
];

export default function LandingPage() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:px-6 sm:pt-24">
        <span className="inline-block rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
          Actively built · V1
        </span>
        <h1 className="mt-5 max-w-3xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          One box to type into. A routing engine that picks the model - and shows you why.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          AI Switchboard is a personal, bring-your-own-key control layer over the AI
          providers you already pay for. Type a request, and a task-aware routing engine
          picks which connected model should handle it, explains its reasoning, and lets
          you compare models side by side or fall back to a fully local, private model via
          Ollama.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/signup"
            className="rounded bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
          >
            Sign up free
          </Link>
          <Link
            href="/pricing"
            className="rounded border border-border px-5 py-2.5 text-sm font-medium text-ink hover:bg-surface"
          >
            See pricing
          </Link>
        </div>
        <p className="mt-4 text-sm text-faint">
          No credit card. No provider key required to start - a built-in Mock provider
          lets you try the full composer, routing trace, and Compare mode before you
          connect anything real.
        </p>
      </section>

      {/* How it works */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold text-ink">How the routing pipeline works</h2>
          <p className="mt-2 max-w-2xl text-muted">
            This is the actual sequence of steps that runs for every request - not a
            simplified marketing diagram.
          </p>
          <ol className="mt-10 space-y-8 sm:space-y-10">
            {PIPELINE_STEPS.map((step, i) => (
              <li key={step.title} className="flex gap-4 sm:gap-6">
                <div className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">
                  {i + 1}
                </div>
                <div>
                  <h3 className="font-medium text-ink">{step.title}</h3>
                  <p className="mt-1 text-sm text-muted sm:text-base">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold text-ink">What's built</h2>
        <p className="mt-2 max-w-2xl text-muted">
          Everything below is in the product today, not on a roadmap slide.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-lg border border-border bg-surface p-5 shadow-card">
              <h3 className="font-medium text-ink">{f.title}</h3>
              <p className="mt-2 text-sm text-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Honest framing */}
      <section className="border-t border-border bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-2xl font-semibold text-ink">Where this is, honestly</h2>
          <p className="mt-3 max-w-2xl text-muted">
            This is V1 of AI Switchboard, a personal AI routing workspace, built and used by one developer
            first. It does not have agents, MCP tool integration, or team workspaces yet -
            those are real gaps, not hidden ones, and they're on the roadmap rather than in
            the product. What is here - BYOK, routing, explainability, Compare, local
            models, and usage tracking - is fully working end to end, with a test suite
            that runs the whole pipeline over HTTP, not just unit tests in isolation.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Try it free
            </Link>
            <Link
              href="/pricing"
              className="rounded border border-border px-5 py-2.5 text-sm font-medium text-ink hover:bg-bg"
            >
              View pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
