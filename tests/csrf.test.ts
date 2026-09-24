import { describe, it, expect } from 'vitest';
import { BASE_URL } from './globalSetup';
import { CookieJar, apiFetch } from './helpers';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

// These tests bypass apiFetch's default Origin header (see helpers.ts) to exercise
// the assertSameOrigin() check in src/lib/csrf.ts directly against the real server.
async function rawFetch(path: string, init: RequestInit & { headers?: Record<string, string> } = {}) {
  return fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

describe('CSRF protection on state-changing routes', () => {
  it('rejects a signup POST with no Origin/Referer header', async () => {
    const res = await rawFetch('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: uniqueEmail('csrf-noorigin'), password: 'correcthorsebatterystaple' }),
    });
    expect(res.status).toBe(403);
  });

  it('rejects a signup POST from a cross-site Origin', async () => {
    const res = await rawFetch('/api/auth/signup', {
      method: 'POST',
      headers: { Origin: 'https://evil.example.com' },
      body: JSON.stringify({ email: uniqueEmail('csrf-crosssite'), password: 'correcthorsebatterystaple' }),
    });
    expect(res.status).toBe(403);
  });

  it('accepts a signup POST whose Origin matches the app itself', async () => {
    const res = await rawFetch('/api/auth/signup', {
      method: 'POST',
      headers: { Origin: BASE_URL },
      body: JSON.stringify({ email: uniqueEmail('csrf-sameorigin'), password: 'correcthorsebatterystaple' }),
    });
    expect(res.status).toBe(200);
  });

  it('falls back to Referer when Origin is absent, and still enforces same-origin', async () => {
    const goodReferer = await rawFetch('/api/auth/signup', {
      method: 'POST',
      headers: { Referer: `${BASE_URL}/signup` },
      body: JSON.stringify({ email: uniqueEmail('csrf-goodreferer'), password: 'correcthorsebatterystaple' }),
    });
    expect(goodReferer.status).toBe(200);

    const badReferer = await rawFetch('/api/auth/signup', {
      method: 'POST',
      headers: { Referer: 'https://evil.example.com/attack' },
      body: JSON.stringify({ email: uniqueEmail('csrf-badreferer'), password: 'correcthorsebatterystaple' }),
    });
    expect(badReferer.status).toBe(403);
  });

  it('rejects a cross-site DELETE against a provider credential (using a real, authenticated session)', async () => {
    const jar = new CookieJar();
    await apiFetch(jar, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: uniqueEmail('csrf-delete'), password: 'correcthorsebatterystaple' }),
    });

    // Cross-site attempt: right cookie (attacker can't get this in practice, but we
    // simulate the "cookie present, origin wrong" case that the origin check alone
    // must catch) + wrong Origin.
    const res = await fetch(`${BASE_URL}/api/providers/some-fake-id`, {
      method: 'DELETE',
      headers: { Cookie: jar.header(), Origin: 'https://evil.example.com' },
    });
    expect(res.status).toBe(403);
  });

  it('rejects a cross-site POST to logout (using a real, authenticated session)', async () => {
    const jar = new CookieJar();
    await apiFetch(jar, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: uniqueEmail('csrf-logout'), password: 'correcthorsebatterystaple' }),
    });

    const res = await fetch(`${BASE_URL}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: jar.header(), Origin: 'https://evil.example.com' },
    });
    expect(res.status).toBe(403);

    // The session must still be valid - the forged logout must not have gone through.
    const me = await apiFetch(jar, '/api/auth/me');
    const meBody = await me.json();
    expect(meBody.authenticated).toBe(true);
  });

  it('does not CSRF-protect a plain GET (read-only route)', async () => {
    const jar = new CookieJar();
    await apiFetch(jar, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email: uniqueEmail('csrf-get'), password: 'correcthorsebatterystaple' }),
    });
    const res = await fetch(`${BASE_URL}/api/providers`, {
      headers: { Cookie: jar.header() },
    });
    expect(res.status).toBe(200);
  });
});
