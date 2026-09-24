import { NextResponse } from 'next/server';
import { AuthError } from './auth';
import { CsrfError } from './csrf';
import { RateLimitError } from './rateLimit';
import { safeLog } from './redact';

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Wraps a route handler so thrown AuthErrors become 401s, CsrfErrors become
 * 403s, RateLimitErrors become 429s (with a Retry-After header), and unknown
 * errors become safely-logged 500s (never leaking internals or secrets to the
 * client). */
export function withErrorHandling<T extends unknown[]>(
  handler: (...args: T) => Promise<Response>
): (...args: T) => Promise<Response> {
  return async (...args: T) => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof AuthError) {
        return jsonError(err.message, err.status);
      }
      if (err instanceof CsrfError) {
        return jsonError(err.message, err.status);
      }
      if (err instanceof RateLimitError) {
        const res = jsonError(err.message, 429);
        res.headers.set('Retry-After', String(Math.ceil(err.retryAfterMs / 1000)));
        return res;
      }
      safeLog.error('Unhandled API error:', err);
      return jsonError('Internal server error', 500);
    }
  };
}
