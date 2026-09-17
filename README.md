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
- **What this does *not* yet do**: no key rotation UI, no per-key usage
  quotas, no audit log of who accessed what, no rate limiting, no CSRF token
  (relies on `sameSite: lax` cookies + JSON content-type), no encryption of
  data at rest for the SQLite file itself (only the API keys inside it).
  These are reasonable V2 hardening items for a real multi-user deployment;
  V1 is scoped as a personal, single-workspace-per-user tool.

## Stack

Next.js 14 (App Router) + TypeScript + Tailwind CSS, Drizzle ORM over SQLite
(`better-sqlite3`), bcrypt + `iron-session` for auth, Vitest for tests.

## Setup

```bash
npm install

# Generate your own local secrets (never commit these):
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # -> KEK_BASE64
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"   # -> SESSION_SECRET
# paste both into .env.local

# Create the SQLite DB and seed the model registry:
npx tsx scripts/migrate.ts
npx tsx scripts/seed.ts

npm run dev
# -> http://localhost:3000
```

Sign up with any email/password (min 8 characters) - no provider key is
required. The Mock provider is always available, so the Composer, Compare,
history, and usage dashboard all work immediately for a brand-new user.

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

## Running tests

```bash
npm test
```

54 tests across 4 files, all passing against the Mock provider only (no
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

## Building for production

```bash
npm run build
npm start
```

## What's built vs. what's not (V1 scope)

**Built**: universal composer with Auto/Quality/Speed/Cost/Privacy/Manual
routing modes and a Compare mode; a real, data-driven model registry (16
seed models across Mock/OpenAI/Anthropic/Google/OpenRouter/Ollama) with a
reliability-score update hook; a rule-based task classifier with a
deterministic fallback so it can never crash the pipeline; capability + context-
window filtering; weighted-sum scoring with visible per-candidate scores;
bounded fallback across candidates on failure; output validation (empty-
response, code-bracket-balance, JSON-parse checks); envelope-encrypted BYOK
storage; workspace-scoped data access; full CRUD-ish API surface for
providers/models/execute/compare/conversations/usage; a working UI for all of
the above that never dead-ends with zero providers connected.

**Not built (by design, V2+)**: RAG/document retrieval, MCP tool integration,
multi-step agentic workflows, an evaluation/scoring harness for comparing
model quality over time, multi-tenant team workspaces (the schema supports a
`workspace_members` table, but the UI is single-user-per-workspace), key
rotation, per-provider usage quotas/rate limiting, and streaming responses
(all responses are returned as a single completed payload, not
token-streamed).

## Git

This repository is local-only: a fresh `git init` with no remote configured.
Nothing has been pushed anywhere. Point it at a real GitHub remote whenever
you're ready.
