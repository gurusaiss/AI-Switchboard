import { NextResponse } from 'next/server';
import { requireSession } from '../../../lib/auth';
import { scopedQueries } from '../../../db/scoped';
import { withErrorHandling } from '../../../lib/api-helpers';

export const GET = withErrorHandling(async () => {
  const { workspaceId } = await requireSession();
  const queries = scopedQueries(workspaceId);
  const conversations = await queries.listConversations();
  return NextResponse.json({ conversations });
});
