import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as loginPost } from '../src/app/api/auth/login/route';
import { authRateLimiter } from '../src/lib/rateLimit';

// Calls the real route handler in-process (no HTTP server needed) so we can
// isolate rate-limit state per test via authRateLimiter.reset() and inject a
// distinct per-test IP, without waiting out a real window.

function loginRequest(ip: string) {
  return new NextRequest('http://localhost:3000/api/auth/login', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      host: 'localhost:3000',
      origin: 'http://localhost:3000',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong-password' }),
  });
}

beforeEach(() => {
  authRateLimiter.reset();
});

describe('rate limiting on /api/auth/login', () => {
  it('returns 429 once a single IP exceeds the per-minute allowance', async () => {
    const ip = '203.0.113.10';
    const statuses: number[] = [];
    for (let i = 0; i < 20; i++) {
      const res = await loginPost(loginRequest(ip));
      statuses.push(res.status);
      if (res.status === 429) break;
    }
    expect(statuses.at(-1)).toBe(429);
    // Before the limit kicked in, requests were evaluated normally (401 for bad
    // credentials), not blanket-rejected.
    expect(statuses.slice(0, -1).every((s) => s === 401)).toBe(true);
  });

  it('sets a Retry-After header on the 429 response', async () => {
    const ip = '203.0.113.11';
    let res;
    for (let i = 0; i < 20; i++) {
      res = await loginPost(loginRequest(ip));
      if (res.status === 429) break;
    }
    expect(res!.status).toBe(429);
    expect(Number(res!.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('a different IP is unaffected by another IP being rate-limited', async () => {
    const limitedIp = '203.0.113.12';
    for (let i = 0; i < 20; i++) {
      const res = await loginPost(loginRequest(limitedIp));
      if (res.status === 429) break;
    }
    const otherIpRes = await loginPost(loginRequest('203.0.113.13'));
    expect(otherIpRes.status).not.toBe(429);
  });

  it('resets and allows requests again once the limiter is cleared (simulating window rollover)', async () => {
    const ip = '203.0.113.14';
    for (let i = 0; i < 20; i++) {
      const res = await loginPost(loginRequest(ip));
      if (res.status === 429) break;
    }
    authRateLimiter.reset();
    const res = await loginPost(loginRequest(ip));
    expect(res.status).not.toBe(429);
  });
});
