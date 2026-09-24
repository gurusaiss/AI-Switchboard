import { BASE_URL } from './globalSetup';

/** Minimal per-test cookie jar for hitting the real Next server with fetch. */
export class CookieJar {
  private cookies = new Map<string, string>();

  applyFrom(res: Response) {
    // undici / fetch Response exposes multiple Set-Cookie headers via getSetCookie()
    const anyHeaders = res.headers as unknown as { getSetCookie?: () => string[] };
    const setCookies = anyHeaders.getSetCookie ? anyHeaders.getSetCookie() : [];
    for (const sc of setCookies) {
      const [pair] = sc.split(';');
      const eq = pair.indexOf('=');
      if (eq > -1) {
        this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
      }
    }
  }

  header(): string {
    return Array.from(this.cookies.entries())
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

export async function apiFetch(
  jar: CookieJar,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      // A real browser always sends Origin on a same-origin fetch()/form POST;
      // send it here too so these tests exercise the same-origin path the CSRF
      // check expects (see tests/csrf.test.ts for the rejection cases).
      Origin: BASE_URL,
      ...(init.headers || {}),
      Cookie: jar.header(),
    },
  });
  jar.applyFrom(res);
  return res;
}
