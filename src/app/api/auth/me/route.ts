import { NextResponse } from 'next/server';
import { getSession } from '../../../../lib/auth';
import { withErrorHandling } from '../../../../lib/api-helpers';

export const GET = withErrorHandling(async () => {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ authenticated: false });
  }
  return NextResponse.json({ authenticated: true, email: session.email, workspaceId: session.workspaceId });
});
