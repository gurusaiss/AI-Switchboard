import { describe, it, expect } from 'vitest';
import { CookieJar, apiFetch } from './helpers';

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
}

describe('auth flow', () => {
  it('signs up a new user and establishes a session', async () => {
    const jar = new CookieJar();
    const email = uniqueEmail('signup');
    const res = await apiFetch(jar, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'correcthorsebatterystaple' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(email);
    expect(body.workspaceId).toBeTruthy();

    const me = await apiFetch(jar, '/api/auth/me');
    const meBody = await me.json();
    expect(meBody.authenticated).toBe(true);
    expect(meBody.email).toBe(email);
  });

  it('rejects duplicate signups', async () => {
    const jar = new CookieJar();
    const email = uniqueEmail('dupe');
    await apiFetch(jar, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'correcthorsebatterystaple' }),
    });
    const second = await apiFetch(jar, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'anotherpassword123' }),
    });
    expect(second.status).toBe(409);
  });

  it('logs in with correct credentials and rejects a wrong password', async () => {
    const email = uniqueEmail('login');
    const signupJar = new CookieJar();
    await apiFetch(signupJar, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'correcthorsebatterystaple' }),
    });

    const loginJar = new CookieJar();
    const good = await apiFetch(loginJar, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'correcthorsebatterystaple' }),
    });
    expect(good.status).toBe(200);

    const badJar = new CookieJar();
    const bad = await apiFetch(badJar, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'totally-wrong-password' }),
    });
    expect(bad.status).toBe(401);
  });

  it('rejects unauthenticated access to a protected route', async () => {
    const jar = new CookieJar();
    const res = await apiFetch(jar, '/api/conversations');
    expect(res.status).toBe(401);
  });

  it('logout clears the session so protected routes reject again', async () => {
    const jar = new CookieJar();
    const email = uniqueEmail('logout');
    await apiFetch(jar, '/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'correcthorsebatterystaple' }),
    });
    const beforeLogout = await apiFetch(jar, '/api/conversations');
    expect(beforeLogout.status).toBe(200);

    await apiFetch(jar, '/api/auth/logout', { method: 'POST' });
    const afterLogout = await apiFetch(jar, '/api/conversations');
    expect(afterLogout.status).toBe(401);
  });
});
