// Per-provider resilience: timeout wrapper, exponential-backoff retry, and a simple
// in-memory circuit breaker. This is process-local state (fine for a single-instance
// V1 deployment; a future multi-instance deploy would move it to shared storage).

interface BreakerState {
  consecutiveFailures: number;
  openedAt?: number;
}

const BREAKER_THRESHOLD = 4; // consecutive failures before opening
const BREAKER_COOLDOWN_MS = 15000; // how long the breaker stays open before half-open retry

const breakers = new Map<string, BreakerState>();

export class CircuitOpenError extends Error {
  constructor(provider: string) {
    super(`Circuit breaker open for provider "${provider}" - too many recent failures.`);
    this.name = 'CircuitOpenError';
  }
}

function getBreaker(key: string): BreakerState {
  let b = breakers.get(key);
  if (!b) {
    b = { consecutiveFailures: 0 };
    breakers.set(key, b);
  }
  return b;
}

function isOpen(key: string): boolean {
  const b = getBreaker(key);
  if (b.consecutiveFailures < BREAKER_THRESHOLD) return false;
  if (!b.openedAt) return false;
  const elapsed = Date.now() - b.openedAt;
  if (elapsed > BREAKER_COOLDOWN_MS) {
    // half-open: allow exactly one probing attempt through by resetting the counter
    // to just below threshold, so a single failure re-opens it immediately.
    b.consecutiveFailures = BREAKER_THRESHOLD - 1;
    b.openedAt = undefined;
    return false;
  }
  return true;
}

function recordSuccess(key: string) {
  const b = getBreaker(key);
  b.consecutiveFailures = 0;
  b.openedAt = undefined;
}

function recordFailure(key: string) {
  const b = getBreaker(key);
  b.consecutiveFailures += 1;
  if (b.consecutiveFailures >= BREAKER_THRESHOLD && !b.openedAt) {
    b.openedAt = Date.now();
  }
}

/** Resets all breaker state - used by tests only. */
export function _resetBreakers() {
  breakers.clear();
}

function timeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface ResilienceOptions {
  timeoutMs?: number;
  maxRetries?: number; // max ADDITIONAL attempts after the first
  baseDelayMs?: number;
}

/** Wraps a provider call with timeout + exponential-backoff retry + circuit breaker,
 * keyed per provider so one provider's outage doesn't affect others. */
export async function withResilience<T>(
  providerKey: string,
  fn: () => Promise<T>,
  opts: ResilienceOptions = {}
): Promise<T> {
  const { timeoutMs = 20000, maxRetries = 2, baseDelayMs = 250 } = opts;

  if (isOpen(providerKey)) {
    throw new CircuitOpenError(providerKey);
  }

  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await timeout(fn(), timeoutMs);
      recordSuccess(providerKey);
      return result;
    } catch (err) {
      lastError = err;
      recordFailure(providerKey);
      if (isOpen(providerKey)) break; // stop retrying once the breaker trips
      if (attempt < maxRetries) {
        await sleep(baseDelayMs * 2 ** attempt);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}
