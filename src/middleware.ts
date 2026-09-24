import { NextResponse, type NextRequest } from 'next/server';
import { unsealData } from 'iron-session';
import { env } from './lib/env';
import { SESSION_COOKIE_NAME, type SessionData } from './lib/auth';

// Server-side gate for the protected app pages, so an unauthenticated visitor
// is redirected before any page (even a loading skeleton) renders, instead of
// relying solely on the client-side fetch('/api/auth/me') check in Nav/pages.
// This is defense-in-depth on top of, not a replacement for, requireSession()
// in the API routes, which remain the actual data-authorization boundary.
export async function middleware(request: NextRequest) {
  const sealed = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  // unsealData already treats a missing/expired/tampered cookie as "no data"
  // (it only throws on a genuinely unexpected error), so no session data here
  // means "not authenticated" - the same rule requireSession() applies.
  const session: SessionData = sealed
    ? await unsealData<SessionData>(sealed, { password: env.sessionSecret })
    : {};

  if (!session.userId || !session.workspaceId) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/providers/:path*', '/conversations/:path*', '/usage/:path*'],
};
