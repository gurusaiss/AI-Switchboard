import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { disconnectProvider } from '../../../../lib/providerService';
import { jsonError, withErrorHandling } from '../../../../lib/api-helpers';

export const DELETE = withErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const { workspaceId } = await requireSession();
    const ok = await disconnectProvider(workspaceId, id);
    if (!ok) return jsonError('Not found', 404);
    return NextResponse.json({ ok: true });
  }
);
