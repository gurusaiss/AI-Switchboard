/**
 * Basic in-memory, per-process rate limiting.
 *
 * This is explicitly a V1-appropriate mitigation against accidental abuse and
 * naive brute-forcing, NOT a production-grade distributed rate limiter: it is
 * a fixed-window counter kept in a plain in-memory Map, scoped to a single
 * server process. It resets on restart, and is NOT shared across multiple
 * server instances behind a load balancer - a real multi-instance deployment
 * needs a shared store (e.g. Redis) for this to be meaningful at scale. That
 * is a V2+ item; see README "What's not built yet".
 */

export class RateLimitError extends Error {
  status = 429;
  retryAfterMs: number;
  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.retryAfterMs = retryAfterMs;
  }
}

interface Bucket {
  count: number;
  windowStart: number;
}

export interface RateLimiterOptions {
  /** Length of the fixed window, in ms. */
  windowMs: number;
  /** Max requests allowed per key within one window. */
  max: number;
}

export class RateLimiter {
  private buckets = new Map<string, Bucket>();
  private windowMs: number;
  private max: number;

  constructor(options: RateLimiterOptions) {
    this.windowMs = options.windowMs;
    this.max = options.max;
  }

  /** Throws a RateLimitError if `key` has exceeded its allowance for the
   * current window; otherwise records this call and returns normally. */
  consume(key: string): void {
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || now - existing.windowStart >= this.windowMs) {
      this.buckets.set(key, { count: 1, windowStart: now });
      return;
    }

    if (existing.count >= this.max) {
      const retryAfterMs = existing.windowStart + this.windowMs - now;
      throw new RateLimitError('Too many requests. Please try again shortly.', Math.max(retryAfterMs, 0));
    }

    existing.count += 1;
  }

  /** Test/ops helper: drops all tracked state. */
  reset(): void {
    this.buckets.clear();
  }
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Separate limiters per route group, each independently configurable via env
// vars (mainly so tests can inject a short window without sleeping for real
// minutes - see tests/rateLimit.test.ts).
export const authRateLimiter = new RateLimiter({
  windowMs: envInt('RATE_LIMIT_AUTH_WINDOW_MS', 60_000),
  max: envInt('RATE_LIMIT_AUTH_MAX', 10),
});

export const executeRateLimiter = new RateLimiter({
  windowMs: envInt('RATE_LIMIT_EXECUTE_WINDOW_MS', 60_000),
  max: envInt('RATE_LIMIT_EXECUTE_MAX', 30),
});

/** Best-effort client IP extraction. NextRequest no longer exposes `.ip`
 * (removed upstream) - behind a reverse proxy this comes from
 * X-Forwarded-For; with no proxy info at all every caller shares one bucket,
 * which is a known, documented limitation of this simple, single-process
 * approach (see the module comment above). */
export function clientKey(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  const real = req.headers.get('x-real-ip');
  if (real) return real;
  return 'unknown';
}
