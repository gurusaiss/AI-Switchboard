import bcrypt from 'bcryptjs';
import { getIronSession, type IronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { env } from './env';

export interface SessionData {
  userId?: string;
  workspaceId?: string;
  email?: string;
}

export function sessionOptions(): SessionOptions {
  return {
    password: env.sessionSecret,
    cookieName: 'acp_session',
    cookieOptions: {
      secure: !env.insecureCookies,
      httpOnly: true,
      sameSite: 'lax',
    },
  };
}

export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(cookies(), sessionOptions());
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Throws a typed error if there's no authenticated session; otherwise returns it. */
export async function requireSession(): Promise<{ userId: string; workspaceId: string; email: string }> {
  const session = await getSession();
  if (!session.userId || !session.workspaceId) {
    throw new AuthError('Not authenticated');
  }
  return { userId: session.userId, workspaceId: session.workspaceId, email: session.email ?? '' };
}

export class AuthError extends Error {
  status = 401;
}
