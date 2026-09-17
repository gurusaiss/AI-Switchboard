import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { scopedQueries } from '../../../../db/scoped';
import { jsonError, withErrorHandling } from '../../../../lib/api-helpers';

export const GET = withErrorHandling(async (_req: NextRequest, { params }: { params: { id: string } }) => {
  const { workspaceId } = await requireSession();
  const queries = scopedQueries(workspaceId);
  const conversation = await queries.getConversation(params.id);
  if (!conversation) return jsonError('Not found', 404);
  const messages = await queries.listMessages(params.id);
  return NextResponse.json({ conversation, messages });
});
