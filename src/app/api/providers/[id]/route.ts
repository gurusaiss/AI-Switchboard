import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { disconnectProvider } from '../../../../lib/providerService';
import { jsonError, withErrorHandling } from '../../../../lib/api-helpers';
import { assertSameOrigin } from '../../../../lib/csrf';

export const DELETE = withErrorHandling(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    assertSameOrigin(req);
    const { id } = await params;
    const { workspaceId } = await requireSession();
    const ok = await disconnectProvider(workspaceId, id);
    if (!ok) return jsonError('Not found', 404);
    return NextResponse.json({ ok: true });
  }
);
