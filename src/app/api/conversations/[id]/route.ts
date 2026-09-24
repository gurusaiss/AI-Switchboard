import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { scopedQueries } from '../../../../db/scoped';
import { jsonError, withErrorHandling } from '../../../../lib/api-helpers';

export const GET = withErrorHandling(
  async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const { workspaceId } = await requireSession();
    const queries = scopedQueries(workspaceId);
    const conversation = await queries.getConversation(id);
    if (!conversation) return jsonError('Not found', 404);
    const messages = await queries.listMessages(id);
    return NextResponse.json({ conversation, messages });
  }
);
