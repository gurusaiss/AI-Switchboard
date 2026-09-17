import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { withErrorHandling } from '../../../../lib/api-helpers';

export const POST = withErrorHandling(async () => {
  const session = await getSession();
  session.destroy();
  return NextResponse.json({ ok: true });
});
