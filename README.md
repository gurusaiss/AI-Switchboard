# AI Control Plane (V1)

A privacy-first, BYOK ("bring your own key") personal AI control plane. You type
one request into a universal composer; a task-aware routing engine picks which
connected AI provider/model should handle it, shows you why, and lets you
override, run manually, or compare models side by side.

This is explicitly **not** an aggregator (no LiteLLM/OpenRouter-clone business
model) and **not** a plain multi-model chat UI - routing is real, transparent,
capability-based logic over a data-driven model registry, not a model dropdown.

This is V1 of a larger roadmap. Out of scope for V1 (see "What's not built yet"
below): RAG, MCP, multi-step agents/workflows, evaluations, and multi-tenant
teams. Those are V2+.

## Pages

| Route | Purpose |
| --- | --- |
| `/` | Public marketing landing page (logged-out visitors land here). Describes what's actually built - no fake logos, testimonials, or stats. |
| `/pricing` | Free / Pro / Team / Enterprise tiers. Only Free is wired to real signup; Pro/Team/Enterprise are "coming" and their CTAs open a `mailto:` link, not a fake checkout. |
| `/login`, `/signup` | Auth. |
| `/app` | The universal composer (this used to be `/` in earlier builds - moved so a real marketing page could live at the root). Auto/Quality/Speed/Cost/Privacy/Manual routing, "why this model?" trace, and Compare mode. |
| `/providers` | Connect/disconnect BYOK provider keys, or detect a local Ollama server. |
| `/conversations`, `/conversations/[id]` | Conversation history. |
| `/usage` | Per-model usage, cost, latency, and the estimated-savings-from-routing metric (see below). |

Route layout: `/` and `/pricing` live under the `(marketing)` route group with
their own header/footer; `/app`, `/providers`, `/conversations`, and `/usage`
live under `(app)` with the authenticated nav bar. Auth redirects are
client-side: each app page checks `/api/auth/me` and pushes to `/login` if
unauthenticated; `/login` and `/signup` push to `/app` on success.

## Architecture summary

```
composer input
   -> task parser (rule-based classifier, never throws)
   -> capability filter over the model registry (hard constraints)
   -> weighted-sum scoring (cost / latency / reliability / privacy,
      weighted per routing mode: Auto/Quality/Speed/Cost/Privacy/Manual)
   -> chosen model + ordered fallback list
   -> execute via a ProviderAdapter (timeout + retry + circuit breaker)
   -> output validation (non-empty; balanced-delimiter check for code;
      JSON.parse check for structured-output requests)
   -> on failure, bounded retry against the next fallback candidate
   -> response + an explainability trace (what was detected, why this
      model, what the fallback chain was, and every candidate's score)
```

- **Universal Task Object** (`src/lib/types.ts`): the internal representation
  of "what the user wants done", independent of which model ends up handling it.
- **Model registry** (`src/registry/`): seed data, not hardcoded routing logic.
  Adding a model means adding a row and re-running the seed script - never
  touching routing code.
- **Provider adapters** (`src/adapters/`): a common `ProviderAdapter` interface
  (`send`, `listModels`, `capabilities`) implemented by a deterministic
  `MockAdapter` (always available, zero cost, clearly labeled `isDemo: true`,
  simulates latency and occasional failure for testing fallback) and real
  `OpenAIAdapter` / `AnthropicAdapter` / `GoogleAdapter` / `OpenRouterAdapter` /
  `OllamaAdapter` implementations against each provider's actual REST shape.
  Real adapters fail cleanly with a "connect this provider first" error if no
  key is configured - they are never called with a key you don't have.
- **Resilience** (`src/adapters/resilience.ts`): every adapter call is wrapped
  in a timeout, exponential-backoff retry (max 2 retries), and a simple
  in-memory circuit breaker per provider (opens after 4 consecutive failures,
  half-open retry after a 15s cooldown).
- **Routing engine** (`src/routing/`): task parsing, capability filtering,
  scoring, execution, output validation, and bounded fallback all live here,
  independent of the DB and HTTP layers, so it's directly unit-testable
  against Mock with no database at all.
- **Cost-savings computation** (`src/lib/costBenchmark.ts`): on every executed
  request, alongside the real cost of the model actually used, the server also
  computes what the same request (same input/output token counts) would have
  cost at the most expensive model in the whole registry that still satisfies
  the request's detected capabilities. Both numbers are stored per usage event
  (`usage_events.est_cost` and `usage_events.benchmark_cost`), and `/usage`
  sums the delta as "Estimated savings from routing" - a real computation over
  real rows, $0 for a workspace with no usage, never a placeholder.
- **Data layer** (`src/db/`): Drizzle ORM over SQLite (`better-sqlite3`) for
  zero-infrastructure local dev. The schema deliberately avoids SQLite-only
  tricks (text uuid-shaped ids, integer unix-ms timestamps, integer 0/1
  booleans, JSON-mode columns) so porting to Postgres later is a matter of
  swapping `drizzle-orm/sqlite-core` imports for `pg-core` equivalents, not a
  redesign. Every tenant-scoped query goes through `src/db/scoped.ts`
  (`scopedQueries(workspaceId)`), which bakes `WHERE workspace_id = ?` into
  the helper itself, so a cross-tenant leak requires actively bypassing the
  helper rather than just forgetting a clause at a call site.

## Security model

- **Envelope encryption for BYOK keys**: each workspace has its own random
  256-bit Data Encryption Key (DEK), generated at signup and stored wrapped
  (AES-256-GCM) by a single master Key Encryption Key (KEK) that comes only
  from the `KEK_BASE64` environment variable. The KEK is never stored in the
  database and never committed. Provider API keys are then encrypted with the
  workspace's DEK (also AES-256-GCM, random IV per secret, auth tag stored).
  Rotating the KEK later means re-wrapping DEKs, not re-encrypting every
  stored key.
- **Keys only exist in memory during the actual provider call.** They are
  decrypted lazily by `buildKeyResolver()` for the duration of a single
  request's routing-engine run, and are never logged and never returned in any
  API response after the initial `/api/providers/connect` call (which returns
  only success + discovered models, never the key).
- **Workspace isolation is structural, not just convention.** All
  tenant-scoped reads/writes go through `scopedQueries(workspaceId)`
  (`src/db/scoped.ts`), which filters by `workspace_id` inside the helper.
  Auth is a signed, httpOnly `iron-session` cookie; passwords are hashed with
  bcrypt.
- **Redaction**: `src/lib/redact.ts` strips anything that looks like an API
  key (OpenAI/Anthropic/Google/OpenRouter key shapes, `Bearer ...` headers,
  `apiKey`/`api_key` JSON fields) before it can reach `console.*` via the
  `safeLog` wrapper used in API routes.
- **CSRF protection** (`src/lib/csrf.ts`): the session cookie is
  `sameSite: 'strict'` (`src/lib/auth.ts`), which alone means the browser
  never attaches it to a request originating from another site. On top of
  that, every state-changing route (signup, login, `providers/connect`,
  `providers/[id]` DELETE, execute, compare) calls `assertSameOrigin()`
  first, which rejects the request (403) unless its `Origin` (or, failing
  that, `Referer`) header names this app's own `Host`. That combination -
  strict cookies plus an explicit origin check - is enough for this stage:
  a single-origin app with no cross-site embedding use case, where a double-
  submit token would add token issuance/rotation surface without adding real
  protection. See `tests/csrf.test.ts` for the rejected/accepted cases.
- **Rate limiting** (`src/lib/rateLimit.ts`): a simple in-memory, per-process,
  fixed-window limiter guards `/api/auth/login` and `/api/auth/signup`
  (per client IP) and `/api/execute` and `/api/compare` (per workspace, once
  authenticated), returning `429` with a `Retry-After` header once exceeded.
  This is explicitly a V1-appropriate mitigation against accidental abuse and
  naive brute-forcing - **not** a distributed production rate limiter: it
  lives in one process's memory, resets on restart, and isn't shared across
  multiple server instances behind a load balancer. A real multi-instance
  deployment needs a shared store (e.g. Redis) for this to hold up at scale;
  see `tests/rateLimit.test.ts` and `tests/rateLimitRoute.test.ts`.
- **Provider key rotation**: `/providers` lets you paste a new key for an
  already-connected provider without deleting it first. `connectProvider()`
  re-verifies the new key against the provider, then rewrites the existing
  credential row in place (same id, same original "first connected" date) -
  it never leaves the old ciphertext around and never returns plaintext key
  material, on either the initial connect or a rotation. Each credential now
  also tracks a `lastVerifiedAt` timestamp (shown on `/providers`), updated
  on every successful connect or rotation. See `tests/providerRotation.test.ts`.
- **What this does *not* yet do**: no per-key usage quotas, no audit log of
  who accessed what or a rotation history (only the single latest
  `lastVerifiedAt` is kept, not a log of every past rotation), no
  distributed/shared rate limiting across multiple server instances, and no
  encryption of data at rest for the SQLite file itself (only the API keys
  inside it). These are reasonable V2 hardening items for a real multi-user
  deployment; V1 is scoped as a personal, single-workspace-per-user tool.

## Stack

Next.js 15 (App Router) + TypeScript + Tailwind CSS, Drizzle ORM over SQLite
(`better-sqlite3`), bcrypt + `iron-session` for auth, Vitest for tests.

Upgraded from 14.2.32 to **15.5.26**: 14.2.32 was the newest 14.x release at
the time, but the whole 14.x line carried a Dec-2025 security advisory with no
further 14.x patch, so this moved to the latest stable Next 15 (15.5.26 is
still on Vercel's active `backport` track) rather than 14.x. It stays on
React 18 (Next 15 supports both 18 and 19, so no React major bump was
needed). Breaking changes migrated: dynamic route `params` are now a
`Promise` (`src/app/api/conversations/[id]/route.ts`,
`src/app/api/providers/[id]/route.ts`), `next/headers`'s `cookies()` is now
async (`src/lib/auth.ts`), and `experimental.serverComponentsExternalPackages`
moved to the stable top-level `serverExternalPackages` (`next.config.js`).
Next 16 is out but was not adopted here - it's a bigger, separate migration
than this task's scope, and 15.5.x already resolves the specific advisory
this upgrade targeted. (`npm audit` separately flags a moderate advisory in
Next's bundled `postcss` dependency that persists across the whole 9.x-16.x
range and is only fully closed by the Next 16 major - noted here rather than
silently left off, but treated as a distinct, deferred follow-up rather than
bundled into this fix.)

## Design system

Colors, surfaces, and text tones are defined once as CSS custom properties in
`src/app/globals.css` (`--color-bg`, `--color-surface`, `--color-border`,
`--color-text*`, `--color-brand-*`, `--color-success/warning/danger-*`), with
a dark-mode variant that applies automatically via
`prefers-color-scheme: dark` (or can be forced with `data-theme="dark"` /
`"light"` on `<html>`). `tailwind.config.ts` exposes these as Tailwind color
utilities (`bg-surface`, `text-ink`, `text-muted`, `border-border`, etc.) plus
a slightly more deliberate type scale, so the landing page, pricing page, and
every app page (composer, providers, conversations, usage) share one visual
language instead of one-off hex values.

## Setup

```bash
npm install

# Generate your own local secrets (never commit these):
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # -> KEK_BASE64
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # -> SESSION_SECRET
# paste both into .env.local

# Create the SQLite DB and seed the model registry:
npm run db:setup   # runs db:migrate then db:seed

npm run dev
# -> http://localhost:3000
```

Visit `http://localhost:3000` for the public landing page, or go straight to
`/signup`. Sign up with any email/password (min 8 characters) - no provider
key is required. The Mock provider is always available, so the Composer
(`/app`), Compare, history, and usage dashboard all work immediately for a
brand-new user.

### Connecting a real provider

Go to `/providers` and paste an API key for OpenAI, Anthropic, Google, or
OpenRouter, or click "Detect local Ollama" if you have `ollama serve` running
locally (`http://127.0.0.1:11434` by default - override with
`OLLAMA_BASE_URL`). The server calls that provider's real `listModels()`
endpoint to confirm the key/connection works and to discover models; the key
is encrypted and stored, never returned in the response. From then on, any
model from that provider is eligible for Auto/Quality/Speed/Cost/Privacy
routing, Manual selection, and Compare.

**No real provider keys were used to build or test this project** - every
adapter beyond Mock is implemented against each provider's documented REST
API shape but has not been exercised against a live API in this environment.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Path to the SQLite file (default `./data/dev.db`) |
| `KEK_BASE64` | 32-byte base64 master Key Encryption Key. Required, no default. |
| `SESSION_SECRET` | 32+ char secret for signing the session cookie. Required. |
| `INSECURE_COOKIES` | Set `true` for local `http://` dev (disables `Secure` cookie flag) |
| `OLLAMA_BASE_URL` | Override the local Ollama server URL (default `http://127.0.0.1:11434`) |
| `RATE_LIMIT_AUTH_WINDOW_MS` / `RATE_LIMIT_AUTH_MAX` | Window (ms) and max requests per window, per IP, for `/api/auth/login` + `/api/auth/signup` (default 60000 / 10) |
| `RATE_LIMIT_EXECUTE_WINDOW_MS` / `RATE_LIMIT_EXECUTE_MAX` | Window (ms) and max requests per window, per workspace, for `/api/execute` + `/api/compare` (default 60000 / 30) |

## Running tests

```bash
npm test
```

73 tests across 8 files, all passing against the Mock provider only (no
network calls to real providers):

- `tests/crypto.test.ts` (6): envelope encryption round-trip, tamper/
  wrong-key rejection, and confirms the stored blob never contains the
  plaintext.
- `tests/auth.test.ts` (5): signup, duplicate-signup rejection, login with
  wrong password rejected, protected routes reject unauthenticated requests,
  logout invalidates the session.
- `tests/routing.test.ts` (31): 17 task-classification cases spanning coding/
  vision/research/creative/general/privacy/urgency/quality-language prompts;
  mode-appropriate ranking assertions (properties, not brittle exact matches)
  for Auto/Quality/Speed/Cost/Privacy; manual-mode override; a "no usable
  candidates" error path; and two fallback-chain tests that force Mock
  failures via a test hook (`mockTestHooks.forceFailureRate`) to confirm the
  pipeline recovers via the next candidate, and only fails outright when
  every candidate does.
- `tests/api-integration.test.ts` (12): spins up a real `next dev` server
  (`tests/globalSetup.ts`) and exercises it over HTTP with cookie-based
  sessions - registry usability flags, `/api/execute` in Auto and Manual
  mode, usage-event recording, `/api/compare` across two Mock models,
  rejecting a model whose provider isn't connected, provider-connect
  validation (missing key, and a fake key's value never appearing anywhere
  in the response body), and workspace isolation (a second user gets a 404
  guessing the first user's conversation id or provider-credential id, and
  never sees it in their own list endpoints).
- `tests/csrf.test.ts` (6): a signup POST with no Origin/Referer, and one
  from a cross-site Origin, are both rejected (403); a matching Origin or a
  matching Referer (fallback when Origin is absent) is accepted (200); a
  cross-site DELETE against a provider credential is rejected even with a
  valid session cookie; a plain GET is unaffected.
- `tests/rateLimit.test.ts` (7) + `tests/rateLimitRoute.test.ts` (4): the
  `RateLimiter` class directly (per-key buckets, 429 once exceeded, resets
  after the window via injected fake timers - no real sleeping - and via an
  explicit `reset()`), plus the real `/api/auth/login` route handler called
  in-process to confirm the wiring actually returns 429 with a `Retry-After`
  header once a single IP exceeds its allowance, that a different IP is
  unaffected, and that it allows requests again after the window/state
  resets.
- `tests/providerRotation.test.ts` (2): connecting a provider twice rotates
  the existing credential in place (same id, same original `createdAt`,
  `lastVerifiedAt` advances) rather than leaving a duplicate row; the new key
  round-trips through `buildKeyResolver()` and the old key is nowhere to be
  found in storage or in either connect call's response.

## Building for production

```bash
npm run build
npm start
```

## What's built vs. what's not (V1 scope)

**Built**: a public marketing landing page and pricing page; universal
composer (`/app`) with Auto/Quality/Speed/Cost/Privacy/Manual routing modes
and a Compare mode; a real, data-driven model registry (16 seed models across
Mock/OpenAI/Anthropic/Google/OpenRouter/Ollama) with a reliability-score
update hook; a rule-based task classifier with a deterministic fallback so it
can never crash the pipeline; capability + context-window filtering;
weighted-sum scoring with visible per-candidate scores (shown as score bars
in the explainability trace, plus a latency/cost comparison view in Compare
mode); bounded fallback across candidates on failure; output validation
(empty-response, code-bracket-balance, JSON-parse checks); envelope-encrypted
BYOK storage; workspace-scoped data access; a real "estimated savings from
routing" computation on the usage dashboard; full CRUD-ish API surface for
providers/models/execute/compare/conversations/usage; a working UI for all of
the above (with loading and empty states) that never dead-ends with zero
providers connected; a shared design-token system with light/dark support;
CSRF protection (strict-cookie + origin check) and basic in-memory per-IP/
per-workspace rate limiting on the auth and execution endpoints; provider key
rotation with a "last verified" timestamp.

**Not built (by design, V2+)**: RAG/document retrieval, MCP tool integration,
multi-step agentic workflows, an evaluation/scoring harness for comparing
model quality over time, multi-tenant team workspaces (the schema supports a
`workspace_members` table, but the UI is single-user-per-workspace),
per-provider usage quotas, a rotation history/audit log (only the latest
`lastVerifiedAt` is tracked, not every past rotation), a distributed/shared
rate limiter for multi-instance deployments (the current one is single-process
in-memory - see the security model section), and streaming responses (all
responses are returned as a single completed payload, not token-streamed).

## Git

This repository is local-only: a fresh `git init` with no remote configured.
Nothing has been pushed anywhere. Point it at a real GitHub remote whenever
you're ready.
