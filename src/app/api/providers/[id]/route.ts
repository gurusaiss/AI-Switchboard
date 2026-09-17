import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { disconnectProvider } from '../../../../lib/providerService';
import { jsonError, withErrorHandling } from '../../../../lib/api-helpers';

export const DELETE = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const { workspaceId } = await requireSession();
  const ok = await disconnectProvider(workspaceId, params.id);
  if (!ok) return jsonError('Not found', 404);
  return NextResponse.json({ ok: true });
});
