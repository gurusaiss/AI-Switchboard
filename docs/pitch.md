# AI Switchboard — Investor Pitch

## The one-liner

**AI Switchboard is the switchboard for the AI era: you bring your own API keys, we bring
the judgment of which model should answer — and we show our work.**

## The problem

Everyone serious about AI now has 2–3 subscriptions — ChatGPT, Claude, Gemini — and makes
the same manual decision dozens of times a day: *which tab do I open for this?* That
decision has gotten worse, not better, in the last year:

- **Providers silently reroute your own requests.** OpenAI's undisclosed model-switching
  for "sensitive" conversations triggered visible, public user backlash in 2026 — people
  want to choose which model handles their work and understand why, not have it decided
  for them behind the scenes.
- **"Bring your own key" has become a procurement requirement, not a power-user quirk.**
  Buyers now ask who controls the key and how easily they can leave before adopting any AI
  tool at all.
- **Every "smart routing" product that already exists is developer infrastructure** —
  RouteLLM, Not Diamond, OpenRouter's Auto Router. They're APIs other engineers embed into
  their own apps. None of them are something a person or small team can simply sit down and
  use.

## The market gap

Three categories already exist and are mature: **AI gateways** (LiteLLM, OpenRouter,
Portkey — unified API access, fallback, observability for developers), **multi-model chat
UIs** (LibreChat, Open WebUI, ChatHub — one window, manual model-picker dropdown), and
**intelligent routers** (Not Diamond, RouteLLM — real routing smarts, API-only). Every
individual ingredient exists somewhere. **Nobody combines end-user UX, real capability-based
routing with visible reasoning, BYOK privacy, and honest multi-model comparison in one
product that a non-developer can operate.**

## The product

A single composer box. Type what you want done. The router:

1. Parses the task (coding, research, creative, vision, general — detected automatically,
   never crashes on an unexpected input).
2. Filters candidate models by hard requirements (capability, context window).
3. Scores the remaining candidates by cost, latency, reliability, and privacy — weighted
   according to a mode you control: **Auto, Quality, Speed, Cost, Privacy, or Manual.**
4. Executes with automatic retry and fallback if a provider fails.
5. Shows you **exactly why** it picked that model — the "Why this model?" panel is not a
   debug log, it's the core trust feature.

You can also run **Compare mode**: the same prompt against up to four models side by side,
with real latency and cost shown, so you can audit the router's judgment yourself whenever
you want to.

## Why BYOK is the strategic choice, not just a cost-saving one

The platform never touches your spend with any provider — you connect your own OpenAI,
Anthropic, Google, or OpenRouter key, or run entirely locally via Ollama with zero data
ever leaving your machine. Every key is envelope-encrypted at rest and decrypted only in
memory for the single request that needs it. This isn't a workaround for not having
provider deals yet — it's the actual product thesis: **control of the key is becoming the
thing buyers screen for first**, and a platform that never custodies your spend is
structurally easier to trust and easier to adopt inside a company with existing provider
contracts.

## Traction (honest, as of today)

This is an early-stage, fully-functional V1 — not a mockup, not a deck with no product
behind it:

- **A real, working product**, not a prototype: 82 automated tests passing, clean
  production build, a full adversarial security/accessibility/performance audit completed
  with zero Critical or High findings.
- **A genuinely private architecture**, verified, not claimed: AES-256-GCM envelope
  encryption, structural workspace isolation, CSRF protection, and rate limiting were all
  independently audited and are backed by passing tests, not marketing copy.
- **Zero dollars spent on AI API costs to build it** — proof that the BYOK model works in
  practice, not just in theory, since the entire pipeline was built and tested end-to-end
  against a zero-cost Mock provider plus real (unused, never-called) adapters for every
  major provider.
- Pre-revenue, pre-launch. No live deployment or paying customers yet — this is an
  investment in a validated product thesis and a working codebase, not a validated market
  yet.

## Business model

| Tier | What it includes |
|---|---|
| **Free** | BYOK, full routing engine, compare mode, usage dashboard |
| **Pro** | Routing history/learning, saved projects |
| **Team** | Shared workspace, governance |
| **Enterprise** | Self-hosted gateway, SSO, audit |

The long-term wedge: once the routing engine has real usage data behind it, it becomes
licensable infrastructure in its own right — a developer API that other builders embed,
the same way Not Diamond or RouteLLM are consumed today, except proven first inside a real
product with real end-user trust behind it, not shipped as infrastructure with no
dogfooding.

## Why now

- BYOK has crossed from preference to requirement in enterprise procurement in 2026.
- MCP (Model Context Protocol) has matured into the de facto standard for AI tool
  integration — 10,000+ public servers, official integrations from Slack, GitHub, Notion,
  Stripe — which makes the V3 tool/agent roadmap a "plug into an existing standard"
  problem, not a "build twenty integrations from scratch" problem.
- Public trust in opaque, provider-controlled model routing is visibly eroding, which is
  exactly the trust gap this product is built to close.

## The ask

[Fill in before sending: round size, use of funds, and what you're specifically asking
this investor for — pre-seed capital, an intro, technical advisory, or a design partner.]
What's already true regardless of the ask: this is a working product today, not a
pitch deck looking for permission to start building.

## Roadmap

- **V2:** project memory, file/RAG support where it earns its place, prompt optimization
  (visible, toggleable), blind evaluation mode, custom routing rules.
- **V3:** MCP tool integration, multi-model specialist pipelines, a dedicated research
  workflow (decompose → search → multi-model synthesis → citations).
- **V4:** team workspaces, a developer API/SDK for the routing engine itself, a
  self-hosted gateway for enterprise/privacy buyers, a marketplace for third-party routing
  policies.

---

## Best prompt to generate a pitch deck (PPT) from this document

Use the prompt below with any AI presentation tool (or paste `pitch.md` alongside it for
a model with file-reading capability):

```
Create a 10–12 slide investor pitch deck for "AI Switchboard," a privacy-first,
BYOK (bring-your-own-key) AI routing workspace. Use the attached pitch.md as the
single source of truth for all facts, numbers, and claims — do not invent metrics,
traction, revenue, or user counts that aren't in the source document.

Slide structure:
1. Title — product name, one-line pitch ("You bring the keys. We bring the judgment.")
2. The problem — manual AI tool-switching, silent provider rerouting eroding trust,
   BYOK becoming a procurement requirement
3. Why now — the three market-timing signals from the "Why now" section
4. The market gap — the three existing categories (gateways / chat UIs / intelligent
   routers) and the one combination none of them offer
5. The product — the composer + routing pipeline, shown as a simple left-to-right
   flow diagram (task parser -> capability filter -> scoring -> execution -> fallback
   -> explainability)
6. The "why this model?" trust feature — this is the single most important slide;
   give it a mock screenshot-style visual showing a routing decision and its stated
   reason
7. BYOK architecture as the strategic moat — not just cost savings, make the privacy
   /control argument explicit
8. Traction and proof — state plainly that this is pre-revenue/pre-launch; lead with
   the real, verifiable facts (test count, audit result, zero fabricated claims) rather
   than invented growth numbers
9. Business model — the four-tier table from the source doc, clearly marking Free as
   live and the rest as planned
10. Roadmap — V2/V3/V4 as a simple timeline, not a wall of text
11. The ask — leave this slide's specific numbers as an editable placeholder; do not
    invent a raise amount
12. Closing — restate the one-liner and a single clear call to action

Tone: confident but factually conservative. Never state a metric, user count, revenue
figure, or partnership that isn't explicitly present in pitch.md. Where the source
document says something is "planned" or "not yet built," the deck must say so too -
investors trust precision over hype. Keep text per slide minimal (headline + 3-5
bullet points max); this is a deck to present aloud, not a document to read silently.
Visual style: clean, modern SaaS aesthetic, one accent color, generous white space,
no stock photography of generic "AI" imagery (no glowing brains, no robot hands).
```
