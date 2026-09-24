# AI Control Plane — Remediation Report

Date: 2026-09-24
Basis: `AUDIT_REPORT.md` (Prompt 1, completed same day) — Issue Registry section 17 ("Master Bug Inventory"), specifically the 3 open Low-severity findings (L4, L5, L6). No Critical/High/Medium items were open; the one Medium (M1) and three other Lows (L1–L3) were already fixed and tested before this pass began.

Scope note on honesty: every decision below was reproduced (a failing test, a live server request, a rendered browser screenshot with measured contrast ratios) before any code was changed, per this pass's own rule. Where investigation showed the audit's tracked concern does not actually hold up as a defect, that is stated plainly as "Won't Fix (verified, no defect found)" rather than being fixed anyway for the sake of closing the ticket.

---

## 1. Result Summary

**Verdict: Production Ready (single-instance deployment), with all in-scope remediation items resolved.**

- Issues in scope: 3 (L4, L5, L6 — the only open items after the Prompt-1 audit)
- Fixed: 2 (L4, L6)
- Deferred: 0
- Won't Fix: 1 (L5 — investigated and found to already pass WCAG 2.2 AA non-text contrast in both light and dark themes; no code change was warranted)
- Cannot Reproduce: 0
- Test count: **76 → 82** (all new tests are real regression tests for the fixes below; nothing was deleted, skipped, or weakened to force a pass)

## 2. Before vs After Comparison

| Metric | Before (Prompt 1 audit) | After (this pass) |
|---|---|---|
| Tests passing | 76 / 76 | 82 / 82 |
| `next build` | Clean | Clean |
| `tsc --noEmit` | Clean | Clean |
| Open Critical/High findings | 0 | 0 |
| Open Medium findings | 0 | 0 |
| Open Low findings | 3 (L4, L5, L6) | 0 |
| Client-side-only auth gate on protected pages | Yes (L4) | No — `src/middleware.ts` gates server-side |
| Verified focus-ring contrast (light+dark) | Not verified (L5) | Verified passing; no change needed |
| Dead `assertMembership()` code | Present (L6) | Removed |

## 3. Status Breakdown

| Status | Count | Items |
|---|---|---|
| Fixed | 2 | L4 (auth-gating middleware), L6 (dead code removed) |
| Deferred | 0 | — |
| Won't Fix | 1 | L5 (focus-ring contrast — verified already passing) |
| Cannot Reproduce | 0 | — |

## 4. Fix-Loop Pipeline (as actually run)

```mermaid
flowchart LR
    A[Reproduce] --> B[Root cause]
    B --> C[Failing test first]
    C --> D[Fix]
    D --> E[Verify fix]
    E --> F[Full regression\nvitest + tsc + next build]
    F --> G[Commit\none per item]
```

Applied to L4 and L6. For L5, the loop stopped after "Reproduce" (live-rendered contrast measurement) because that step showed no defect existed to root-cause or fix — see the Fix Log below.

## 5. Fix Log

| ID | Severity | Root Cause | Fix | Files Changed | Test Added | Status |
|---|---|---|---|---|---|---|
| L4 | Low | Auth gating on `/app`, `/providers`, `/conversations*`, `/usage` ran only client-side (`fetch('/api/auth/me')` in a `useEffect`, then `router.push('/login')`), so the page's own JS had to load and run before a logged-out visitor was redirected — a real architectural gap (100% API-layer enforcement, no server-side page gate), not just cosmetic. | Added `src/middleware.ts`: unseals the `acp_session` iron-session cookie (via `unsealData`, shared `SESSION_COOKIE_NAME` from `src/lib/auth.ts`) and redirects to `/login?from=<path>` before the matched routes render, for any request lacking a valid `userId`+`workspaceId`. Matcher scoped to exactly the 4 protected path prefixes; API routes and their `requireSession()` checks are untouched and remain the actual data-authorization boundary. | `src/middleware.ts` (new), `src/lib/auth.ts` (exported `SESSION_COOKIE_NAME` so middleware and `sessionOptions()` share one source of truth instead of a duplicated string literal) | `tests/middleware.test.ts` (6 tests: each of the 4 protected paths redirects to `/login` when logged out; an authenticated session passes through to `/app` with a 200; `/login` itself is never gated) | Fixed |
| L5 | Low | N/A — investigated, not a real defect. The audit correctly flagged this as *unverified*, not as a confirmed failure. | No code change. Reproduced live in both `prefers-color-scheme: light` and `dark` via a headless-Chromium session (Playwright) against the actual `/login` page and this app's real design tokens (`globals.css`/`tailwind.config.ts`): (1) buttons/links use the browser's native `outline: auto` focus ring, which Chromium renders as an adaptive-contrast ring that inverts between a dark ring (light theme) and a light ring (dark theme) — screenshots confirm it is clearly visible in both; (2) text inputs explicitly set `focus:outline-none` but pair it with `focus:border-brand-500`, and the computed border-vs-surrounding-page contrast is 5.12:1 (light: `#3b5bfd` on `#fafafc`) and 6.64:1 (dark: `#7c96ff` on `#0d0d11`) — both comfortably above the WCAG 2.2 AA 3:1 non-text-contrast threshold for UI-component boundaries. No custom focus-ring styling was added, per this pass's own instruction not to add unneeded styling when the native indicator already passes. | None | None (a fix-in-search-of-a-bug would need a test asserting a specific new style; none was added since nothing changed) | Won't Fix — verified, no defect found |
| L6 | Low | `assertMembership()` in `src/db/scoped.ts` was dead code: no route called it, since a session's `workspaceId` is only ever set by this app's own signup/login flow to a workspace the user genuinely owns (single-owner-per-workspace model), so there was no reachable path to a session holding an unauthorized `workspaceId`. No multi-member-workspace feature is scheduled. | Deleted `assertMembership()` and its now-unused `workspaceMembers` import from `src/db/scoped.ts`. The `workspace_members` table itself and its other call sites (signup/login, which still insert/read membership rows) are untouched — only the unused function was removed. | `src/db/scoped.ts` | N/A — deleting genuinely dead, uncalled code has no behavior to test; regression suite (all 82 tests) re-run afterward to confirm zero call sites broke | Fixed |

## 6. Files Changed

| File | Change |
|---|---|
| `src/middleware.ts` | New — server-side session gate for `/app`, `/providers`, `/conversations*`, `/usage` (L4) |
| `src/lib/auth.ts` | Exported `SESSION_COOKIE_NAME` constant, used by both `sessionOptions()` and the new middleware (L4) |
| `src/db/scoped.ts` | Removed unused `assertMembership()` and its now-dead `workspaceMembers` import (L6) |
| `tests/middleware.test.ts` | New — 6 regression tests for the middleware gate (L4) |

No changes were made for L5 (investigated, no defect found — see Fix Log).

## 7. Final Scorecard (Before → After, out of 10)

| Category | Before | After | Justification |
|---|---|---|---|
| Functionality | 9 | 9 | Unchanged: all documented features still work end-to-end; 82/82 tests pass, including the 4 pre-existing suites untouched by this pass. |
| Security | 9 | 9 | Unchanged rating, but the auth model gained real defense-in-depth: protected pages are now gated at the middleware layer in addition to the API layer's `requireSession()`, which was already the actual authorization boundary and remains so. No new attack surface was introduced (middleware fails closed to `/login` on any missing/invalid/expired session). |
| Accessibility | 7 | 8 | The one previously-unverified item (focus-ring contrast) is now actually verified passing in both themes via live rendering and measured contrast ratios, not left as an open question — everything else in the accessibility audit (labels, semantic buttons, no unaudited `alt` gaps) was already correct and unchanged. |
| Code Quality | 9 | 9 | Unchanged rating; one piece of dead/speculative code (`assertMembership`) was removed, keeping the codebase's existing standard of "no unused scaffolding," but this is a small, expected cleanup rather than a quality-level shift. |
| Production Readiness | 6 | 6 | Unchanged. Live deployment, CI/CD, and a distributed/shared-store rate limiter remain genuinely separate, un-started infrastructure work — not code defects this pass could or should fix — exactly as the original audit scoped them. |
| **Overall** | **8** | **8** | The application code is measurably more complete (server-side auth gating closes the one real architectural gap; the accessibility question is now answered rather than open; dead code is gone), but the overall number does not move because the audit's actual ceiling on "Overall" was always the un-started deployment/CI/scale infrastructure, which this remediation pass was correctly scoped to leave alone. |

## 8. Release Decision

**Production Ready (single-instance deployment).**

All three previously-open Low findings are now closed: L4 is fixed and regression-tested, L5 was investigated and found not to be a real defect (native focus indicators already meet WCAG 2.2 AA 3:1 non-text contrast in both themes, verified live), and L6's dead code has been removed. Combined with the Prompt-1 audit's already-fixed M1 and L1–L3, there are zero open Critical, High, Medium, or Low findings against the application code.

This does **not** mean the product is ready for a general, multi-instance production launch — and that gap is honest, pre-existing infrastructure work, not a code defect this pass could fix:

- **No live deployment** exists (no hosting config, no `Dockerfile`, no `vercel.json`) — genuinely un-started infrastructure, correctly out of scope for a remediation pass.
- **No CI/CD pipeline** exists (no `.github/workflows` or equivalent) — same category: new infrastructure to build, not a bug to remediate.
- **The rate limiter and circuit breaker are explicitly single-instance, in-memory** (`src/lib/rateLimit.ts`, `src/adapters/resilience.ts`) — this was already correctly documented in the codebase's own comments and the Prompt-1 audit, and replacing them with a shared store (e.g., Redis) is new infrastructure work for a future multi-instance deployment, not a defect in the current single-instance design.

Running this application today as a single instance is reasonable. Scaling it behind a load balancer with multiple instances requires that shared-store work first — a pre-existing, already-tracked V2+ item, not something this remediation pass introduced or was asked to build.

## 9. Remaining Items

| Item | Status | Reason | Next Step |
|---|---|---|---|
| L5 — focus-ring contrast | Won't Fix (verified) | Live-rendered, measured contrast (5.12:1 light / 6.64:1 dark for input borders; native adaptive `outline: auto` for buttons/links, visually confirmed via screenshots in both themes) already clears the WCAG 2.2 AA 3:1 non-text-contrast bar. Adding custom focus-ring CSS on top would be unnecessary styling for a control that already passes. | None required. If the brand's visual design later changes button/link/input colors, re-run this same contrast check against the new tokens before assuming it still passes. |
| Live deployment / hosting config | Out of scope (infra, not a defect) | No hosting config exists yet in this repo; the original audit and this pass's brief both treat this as un-started future work, not a remediation target. | Choose a host (e.g., Vercel/Fly/Render) and add its config when the team is ready to deploy. |
| CI/CD pipeline | Out of scope (infra, not a defect) | No `.github/workflows` or equivalent exists; correctly N/A per both the audit and this pass's brief. | Add a workflow running `npm run typecheck && npm test && npm run build` on every push, once the repo has a remote to run it against. |
| Distributed rate limiter / circuit breaker | Out of scope (infra, not a defect) | Current in-memory implementation is correct and sufficient for a single instance, and is already honestly documented as such in-source. | Replace with a shared store (e.g., Redis) only when/if a multi-instance deployment is actually planned. |

## 10. Management Summary

All 3 open Low-severity items from the Prompt-1 audit are now closed: the client-side-only auth-gating flash (L4) is fixed with a real server-side middleware redirect and 6 new regression tests; the focus-ring contrast question (L5) was investigated with live browser measurements and found to already pass WCAG 2.2 AA, so no change was needed or made; and the dead `assertMembership()` code (L6) has been deleted. The test suite grew from 76 to 82 passing tests (all real, none skipped or weakened), `tsc --noEmit` and `next build` are both clean, and there are zero open Critical/High/Medium/Low findings. The application remains **Production Ready for a single-instance deployment**; live hosting, CI/CD, and a distributed rate limiter are unchanged, pre-existing, genuinely un-started infrastructure work — not code defects — exactly as the original audit scoped them.
