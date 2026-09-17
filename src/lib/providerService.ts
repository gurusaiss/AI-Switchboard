import { scopedQueries } from '../db/scoped';
import { getWorkspaceDek } from './workspaceKeys';
import { encryptWithDek, decryptWithDek, packEncrypted, unpackEncrypted } from './crypto';
import { getAdapter } from '../adapters';
import { newId } from './ids';
import type { ProviderName, ModelInfo } from './types';

export interface ConnectedProviderSummary {
  id: string;
  provider: ProviderName;
  label: string | null;
  discoveredModels: string[];
  createdAt: Date;
  // Deliberately no key material of any kind.
}

/** Connects a provider for a workspace: encrypts + stores the key (or, for Ollama,
 * confirms a local server is reachable), and returns discovered models. The raw
 * API key exists in memory only for the duration of this call. */
export async function connectProvider(
  workspaceId: string,
  provider: ProviderName,
  apiKey: string | undefined
): Promise<{ id: string; discoveredModels: ModelInfo[] }> {
  const adapter = getAdapter(provider);

  // This call may throw (bad key, unreachable Ollama, network error) - callers
  // should surface that as a clean "connect failed" error, not silently succeed.
  const discoveredModels = await adapter.listModels(apiKey);

  const queries = scopedQueries(workspaceId);
  const id = newId('cred');

  let encryptedBlob = '';
  if (apiKey) {
    const dek = await getWorkspaceDek(workspaceId);
    encryptedBlob = packEncrypted(encryptWithDek(apiKey, dek));
    // dek is a local Buffer; no reference is retained beyond this scope.
  }

  // Replace any existing credential for this provider (re-connect / rotate key).
  const existing = await queries.getProviderCredentialByProvider(provider);
  if (existing) {
    await queries.deleteProviderCredential(existing.id);
  }

  await queries.insertProviderCredential({
    id,
    provider,
    encrypted: encryptedBlob,
    label: provider === 'ollama' ? 'local' : null,
    discoveredModels: discoveredModels.map((m) => m.id),
    createdAt: new Date(),
  });

  return { id, discoveredModels };
}

export async function listConnectedProviders(workspaceId: string): Promise<ConnectedProviderSummary[]> {
  const rows = await scopedQueries(workspaceId).listProviderCredentials();
  return rows.map((r) => ({
    id: r.id,
    provider: r.provider as ProviderName,
    label: r.label,
    discoveredModels: r.discoveredModels ?? [],
    createdAt: r.createdAt,
  }));
}

export async function disconnectProvider(workspaceId: string, credentialId: string): Promise<boolean> {
  const queries = scopedQueries(workspaceId);
  const existing = await queries.getProviderCredential(credentialId);
  if (!existing) return false;
  await queries.deleteProviderCredential(credentialId);
  return true;
}

/** Returns a resolver function that decrypts a provider's key on demand, for use
 * by the routing engine during a single request. The workspace DEK is unwrapped
 * once up front and held only in this closure for the lifetime of the request;
 * decrypted keys themselves are produced lazily, per call, and never cached
 * beyond the adapter call that needs them. */
export async function buildKeyResolver(
  workspaceId: string
): Promise<(provider: ProviderName) => string | undefined> {
  const rows = await scopedQueries(workspaceId).listProviderCredentials();
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  const needsDek = rows.some((r) => r.encrypted);
  const dek = needsDek ? await getWorkspaceDek(workspaceId) : undefined;

  return (provider: ProviderName) => {
    const row = byProvider.get(provider);
    if (!row || !row.encrypted || !dek) return undefined;
    return decryptWithDek(unpackEncrypted(row.encrypted), dek);
  };
}

export async function getUsableModelIds(
  workspaceId: string,
  registry: ModelInfo[]
): Promise<Set<string>> {
  const connected = await listConnectedProviders(workspaceId);
  const connectedProviders = new Set(connected.map((c) => c.provider));
  connectedProviders.add('mock'); // Mock is always available, zero setup
  return new Set(registry.filter((m) => connectedProviders.has(m.provider)).map((m) => m.id));
}
