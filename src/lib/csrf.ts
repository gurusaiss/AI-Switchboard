import type { NextRequest } from 'next/server';

/**
 * CSRF mitigation for this app: same-site=strict session cookies (see
 * sessionOptions() in ./auth.ts) plus this explicit Origin/Referer check on every
 * state-changing route.
 *
 * Why this is adequate here (V1, cookie-based single-workspace auth, no
 * cross-site embedding use case):
 *   - `sameSite: 'strict'` already means the browser never attaches the session
 *     cookie to a request that originates from another site - including a
 *     cross-site <form> POST or a fetch() from an attacker's page - so a forged
 *     request arrives unauthenticated (no session) even without this check.
 *   - This Origin/Referer check is defense-in-depth: it protects environments
 *     where `sameSite: 'strict'` might not be honored (older browsers, some
 *     embedded webviews) by independently rejecting any state-changing request
 *     whose declared origin doesn't match this app's own host.
 *   - It deliberately does NOT implement a double-submit token, because that
 *     adds a token-issuance/rotation surface for no extra protection once
 *     same-site=strict + an origin check are both in place for a same-origin,
 *     non-embedded app like this one.
 */
export class CsrfError extends Error {
  status = 403;
}

function hostOf(value: string): string | undefined {
  try {
    return new URL(value).host;
  } catch {
    return undefined;
  }
}

/** Throws a CsrfError unless the request's Origin (or, failing that, Referer)
 * header names this same app's own host. Call this first, before doing any
 * work, in every state-changing (POST/PUT/PATCH/DELETE) route handler. */
export function assertSameOrigin(req: NextRequest): void {
  const host = req.headers.get('host');
  if (!host) {
    throw new CsrfError('Missing Host header');
  }

  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  const candidate = origin || referer;

  if (!candidate) {
    // A real browser always sends Origin (and/or Referer) on a same-origin
    // fetch()/form POST. No candidate at all means this isn't a normal browser
    // request we can vouch for - reject it rather than assume it's fine.
    throw new CsrfError('Missing Origin/Referer header');
  }

  const candidateHost = hostOf(candidate);
  if (!candidateHost || candidateHost !== host) {
    throw new CsrfError('Cross-origin request rejected');
  }
}
