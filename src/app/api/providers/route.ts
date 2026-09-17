import { NextResponse } from 'next/server';
import { requireSession } from '../../../lib/auth';
import { listConnectedProviders } from '../../../lib/providerService';
import { withErrorHandling } from '../../../lib/api-helpers';

export const GET = withErrorHandling(async () => {
  const { workspaceId } = await requireSession();
  const providers = await listConnectedProviders(workspaceId);
  return NextResponse.json({ providers });
});
