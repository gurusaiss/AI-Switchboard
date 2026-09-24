import { describe, it, expect, vi, afterEach } from 'vitest';
import { RateLimiter, RateLimitError, clientKey } from '../src/lib/rateLimit';

describe('RateLimiter', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('allows up to `max` requests per key within the window, then throws', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, max: 3 });
    limiter.consume('1.2.3.4');
    limiter.consume('1.2.3.4');
    limiter.consume('1.2.3.4');
    expect(() => limiter.consume('1.2.3.4')).toThrow(RateLimitError);
  });

  it('reports a 429-shaped error with a retryAfterMs', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, max: 1 });
    limiter.consume('a');
    try {
      limiter.consume('a');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(RateLimitError);
      expect((err as RateLimitError).status).toBe(429);
      expect((err as RateLimitError).retryAfterMs).toBeGreaterThan(0);
    }
  });

  it('tracks separate buckets per key', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, max: 1 });
    limiter.consume('user-a');
    // A different key is unaffected by user-a's usage.
    expect(() => limiter.consume('user-b')).not.toThrow();
    expect(() => limiter.consume('user-a')).toThrow(RateLimitError);
  });

  it('resets and allows again once the window elapses (fake timers, no real sleeping)', () => {
    vi.useFakeTimers();
    const limiter = new RateLimiter({ windowMs: 1000, max: 2 });
    limiter.consume('k');
    limiter.consume('k');
    expect(() => limiter.consume('k')).toThrow(RateLimitError);

    vi.advanceTimersByTime(1001);

    expect(() => limiter.consume('k')).not.toThrow();
  });

  it('reset() clears all tracked state immediately', () => {
    const limiter = new RateLimiter({ windowMs: 60_000, max: 1 });
    limiter.consume('k');
    expect(() => limiter.consume('k')).toThrow(RateLimitError);
    limiter.reset();
    expect(() => limiter.consume('k')).not.toThrow();
  });
});

describe('clientKey', () => {
  it('prefers the first X-Forwarded-For entry', () => {
    const req = new Request('http://localhost/', {
      headers: { 'x-forwarded-for': '9.9.9.9, 1.1.1.1' },
    });
    expect(clientKey(req)).toBe('9.9.9.9');
  });

  it('falls back to X-Real-Ip, then "unknown"', () => {
    const withRealIp = new Request('http://localhost/', { headers: { 'x-real-ip': '5.5.5.5' } });
    expect(clientKey(withRealIp)).toBe('5.5.5.5');

    const withNeither = new Request('http://localhost/');
    expect(clientKey(withNeither)).toBe('unknown');
  });
});
