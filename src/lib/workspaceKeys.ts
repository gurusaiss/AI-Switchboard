import { scopedQueries } from '../db/scoped';
import { unwrapDek, unpackEncrypted } from './crypto';

/** Unwraps a workspace's Data Encryption Key using the master KEK. The returned
 * Buffer should be used immediately (to decrypt a provider credential) and never
 * cached or logged. */
export async function getWorkspaceDek(workspaceId: string): Promise<Buffer> {
  const workspace = await scopedQueries(workspaceId).getWorkspace();
  if (!workspace) throw new Error('Workspace not found');
  return unwrapDek(unpackEncrypted(workspace.wrappedDek));
}
