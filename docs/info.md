# AI Switchboard — Project Overview & PRD

## 1. What this is

**AI Switchboard** is a privacy-first, BYOK ("bring your own key") AI routing workspace.
A user types one request into a single composer. A task-aware routing engine decides which
connected AI provider/model should handle it, shows *why* in plain language, and always
lets the user override, run manually, or compare models side by side.

**One-line pitch:** *You bring the keys. We bring the judgment.*

It is explicitly **not**:
- An aggregator/gateway clone (LiteLLM, OpenRouter) — those are developer infrastructure;
  this is an end-user workspace.
- A multi-model chat UI with a model dropdown (LibreChat, ChatHub, Poe) — "routing" there
  means the human picks; here the system picks and explains itself, while the human can
  still override at any time.

## 2. The problem

People and small teams already pay for multiple AI subscriptions (ChatGPT, Claude, Gemini)
and manually decide, every single time, which tab to open for which task — "is this a
coding question, a research question, an image request?" That decision is made worse by
three forces that only strengthened through 2026:

1. **Providers now silently reroute requests themselves** (e.g. ChatGPT's undisclosed model
   switching for "sensitive" topics), which visibly damaged user trust — people want to
   choose and understand which model handles their request, not have it decided invisibly.
2. **BYOK moved from a power-user preference to a procurement requirement.** Buyers
   increasingly ask "who controls the key, and how easily can I leave" before adopting any
   AI tool.
3. **Existing "smart routing" products are all developer infrastructure** (RouteLLM, Not
   Diamond, OpenRouter's Auto Router) — APIs for other engineers to embed, not something a
   person or small team can actually sit down and use.

## 3. Target users

| Persona | Why they care |
|---|---|
| **AI power users / prosumers** | Already pay for 2–3 AI subscriptions, manually tab-switch; want one place that picks correctly and tells them why |
| **Indie developers / small teams** | Hold multiple provider API keys directly; want cost/fallback/quality reasoning without adopting full dev-infra gateway tooling |
| **Privacy-conscious professionals** | Won't paste data into a vendor's cloud chat UI, but will use their own API keys against providers under their own contract terms, or run fully local via Ollama |

## 4. What's actually built (V1)

| Capability | Status |
|---|---|
| Universal composer (single input) | ✅ Built |
| Task-aware routing engine (rule-based classifier → capability filter → weighted scoring → execution → validation → bounded fallback) | ✅ Built |
| Routing modes: Auto, Quality, Speed, Cost, Privacy, Manual | ✅ Built |
| "Why this model?" explainability trace (detected requirements, chosen model, reason, fallback chain, per-candidate scores) | ✅ Built |
| Compare mode (same prompt → up to 4 models, side by side, with latency/cost) | ✅ Built |
| Data-driven model registry (16 seed models across Mock/OpenAI/Anthropic/Google/OpenRouter/Ollama) | ✅ Built |
| BYOK provider connect, with envelope-encrypted key storage | ✅ Built |
| Provider key rotation (replace a key without deleting the connection) | ✅ Built |
| Local-model support via Ollama (zero cost, zero data leaving the user's machine) | ✅ Built |
| Mock provider (always available, zero cost, clearly labeled DEMO) | ✅ Built |
| Conversation history | ✅ Built |
| Usage dashboard with real "estimated savings from routing" metric | ✅ Built |
| Public marketing landing page + pricing page | ✅ Built |
| CSRF protection, rate limiting, workspace-isolated data access | ✅ Built |
| Automated test suite | ✅ 82 passing tests |

**Deliberately not built yet (V2+):** RAG/document retrieval, MCP tool integration,
multi-step agentic workflows, an evaluation harness for comparing model quality over time,
multi-tenant team workspaces (schema supports it; UI doesn't yet), a distributed/shared
rate limiter for multi-instance deployments, streaming responses.

## 5. How routing actually works

```
composer input
   -> task parser (rule-based, never throws — degrades to a safe default on any failure)
   -> capability filter over the model registry (hard constraints: modality, context window)
   -> weighted-sum scoring (cost / latency / reliability / privacy — weighted per routing mode)
   -> chosen model + an ordered fallback list
   -> execute via a ProviderAdapter (timeout + retry + per-provider circuit breaker)
   -> output validation (non-empty; structural checks for code/JSON)
   -> on failure, bounded retry against the next fallback candidate
   -> response + an explainability trace shown to the user
```

The router is never a single point of failure: if the classification step itself throws,
the pipeline degrades to a safe default (general reasoning) rather than failing the whole
request.

## 6. Architecture

- **Frontend/backend:** Next.js 15 (App Router) + TypeScript + Tailwind CSS — one deploy
  target, frontend and API together.
- **Database:** Drizzle ORM over SQLite for zero-infrastructure local development, schema
  deliberately written to be Postgres-portable (no SQLite-only tricks) for when the product
  needs to scale beyond a single file.
- **Auth:** bcrypt password hashing + `iron-session` encrypted, httpOnly, same-site-strict
  cookies.
- **Security:** AES-256-GCM envelope encryption for every stored provider key (a per-
  workspace Data Encryption Key, itself wrapped by a master Key Encryption Key that lives
  only in an environment variable, never in the database); keys decrypted only in memory,
  only for the duration of the one request that needs them; structural workspace isolation
  (every tenant-scoped query runs through one helper that bakes in the tenant filter, so a
  route cannot forget it); CSRF protection (strict cookies + origin/referer check) and
  rate limiting on every state-changing and execution route.
- **Provider abstraction:** one `ProviderAdapter` interface; a deterministic Mock
  implementation plus real OpenAI/Anthropic/Google/OpenRouter/Ollama adapters. Adding a new
  provider means adding one adapter + one registry row — never touching routing logic.

## 7. Business model (planned, not yet built)

| Tier | What it includes | Status |
|---|---|---|
| **Free** | BYOK, full routing engine, compare mode, usage dashboard | Live |
| **Pro** | Routing history/learning, saved projects | Planned |
| **Team** | Shared workspace, governance | Planned |
| **Enterprise** | Self-hosted gateway, SSO, audit | Planned |

No payment processor is integrated yet. The pricing page's paid-tier CTAs are honest
waitlist links (`mailto:`), not a simulated checkout — nothing about billing is faked.

## 8. Roadmap

- **V1 (done):** everything in section 4.
- **V2:** project-based memory, file upload + RAG where it adds real value, prompt
  optimization (shown, toggleable), blind evaluation mode, user feedback feeding the
  scoring function, custom routing rules.
- **V3:** MCP tool integration, model chains/specialist pipelines, a dedicated research
  workflow (decompose → search → multi-model synthesis → citations).
- **V4:** team workspaces with shared routing policy, a developer API exposing the routing
  engine itself as licensable infrastructure, a self-hosted gateway for enterprise/privacy
  buyers, an optional marketplace for third-party routing policies/evaluators.

## 9. Current engineering status

- 82/82 automated tests passing (crypto, auth, routing, CSRF, rate limiting, provider
  rotation, workspace isolation, live HTTP integration).
- Clean `next build` and `tsc --noEmit`.
- A full adversarial audit (live browser QA, security, accessibility, performance) found
  zero Critical/High issues; every real finding was fixed and regression-tested; see
  `AUDIT_REPORT.md` and `REMEDIATION_REPORT.md` and `docs/fixed.md` for the complete record.
- **Release status: Production Ready for a single-instance deployment.** Live hosting,
  CI/CD, and a distributed rate limiter are the honestly-labeled, genuinely un-started
  next steps — not hidden gaps.

## 10. What makes this defensible

Not the number of connected providers (that's commoditized). The defensible layer is:
**transparent, capability-based routing that a non-developer can trust and audit**, backed
by a genuinely private BYOK architecture, with real (not cosmetic) multi-model comparison
and honest, verifiable claims about what is and isn't built. The product's credibility — a
real, tested, audited codebase with nothing faked — *is* the moat at this stage, as much as
any single feature.
