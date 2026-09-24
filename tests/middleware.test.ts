import { describe, it, expect } from 'vitest';
import { BASE_URL } from './globalSetup';
import { CookieJar, apiFetch } from './helpers';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

const PROTECTED_PATHS = ['/app', '/providers', '/conversations', '/usage'];

describe('server-side auth gating on protected pages (middleware)', () => {
  for (const path of PROTECTED_PATHS) {
    it(`redirects an unauthenticated request for ${path} to /login before any page render`, async () => {
      const res = await fetch(`${BASE_URL}${path}`, { redirect: 'manual' });
      expect([307, 308, 302]).toContain(res.status);
      const location = res.headers.get('location');
      expect(location).toBeTruthy();
      expect(new URL(location as string, BASE_URL).pathname).toBe('/login');
    });
  }

  it('lets an authenticated session through to a protected page without redirecting', async () => {
    const jar = new CookieJar();
    const email = uniqueEmail('mw');
    const signup = await apiFetch(jar, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'correcthorsebatterystaple' }),
    });
    expect(signup.status).toBe(200);

    const res = await fetch(`${BASE_URL}/app`, {
      redirect: 'manual',
      headers: { Cookie: jar.header() },
    });
    expect(res.status).toBe(200);
  });

  it('does not gate public pages such as /login or /', async () => {
    const res = await fetch(`${BASE_URL}/login`, { redirect: 'manual' });
    expect(res.status).toBe(200);
  });
});
