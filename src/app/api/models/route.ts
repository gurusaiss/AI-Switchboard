import { NextResponse } from 'next/server';
import { requireSession } from '../../../lib/auth';
import { listAllModels } from '../../../registry';
import { getUsableModelIds } from '../../../lib/providerService';
import { withErrorHandling } from '../../../lib/api-helpers';

export const GET = withErrorHandling(async () => {
  const { workspaceId } = await requireSession();
  const registry = await listAllModels();
  const usable = await getUsableModelIds(workspaceId, registry);
  const models = registry.map((m) => ({ ...m, usable: usable.has(m.id) }));
  return NextResponse.json({ models });
});
