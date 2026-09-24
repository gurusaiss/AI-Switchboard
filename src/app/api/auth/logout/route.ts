import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { withErrorHandling } from '../../../../lib/api-helpers';
import { assertSameOrigin } from '../../../../lib/csrf';

export const POST = withErrorHandling(async (req: NextRequest) => {
  // Every other state-changing route calls this first (see csrf.ts) - logout
  // was the one omission. Low impact on its own (worst case a forged request
  // logs the victim out), but defense-in-depth should be applied uniformly.
  assertSameOrigin(req);
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
});
