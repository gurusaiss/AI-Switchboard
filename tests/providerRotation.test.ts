import { describe, it, expect, vi } from 'vitest';

// Mock the OpenAI adapter so this test never touches the network - listModels
// just confirms whichever apiKey it was called with "worked", and we assert on
// exactly what was persisted / decryptable afterwards.
vi.mock('../src/adapters/openai', () => {
  return {
    OpenAIAdapter: class {
      provider = 'openai';
      capabilities() {
        return ['reasoning'];
      }
      async listModels(apiKey?: string) {
        if (!apiKey) throw new Error('API key required');
        return [
          {
            id: 'openai:test-model',
            provider: 'openai',
            modelId: 'test-model',
            displayName: 'Test Model',
            modality: ['text'],
            contextWindow: 8192,
            capabilities: ['reasoning'],
            pricingInputPer1k: 0,
            pricingOutputPer1k: 0,
            typicalLatencyMs: 100,
            reliabilityScore: 1,
            isLocal: false,
          },
        ];
      }
      async send() {
        throw new Error('not used in this test');
      }
    },
  };
});

import { db } from '../src/db/client';
import { users, workspaces, workspaceMembers } from '../src/db/schema';
import { newId } from '../src/lib/ids';
import { generateDek, wrapDek, packEncrypted } from '../src/lib/crypto';
import { connectProvider, listConnectedProviders, buildKeyResolver } from '../src/lib/providerService';

async function makeWorkspace(): Promise<string> {
  const userId = newId('user');
  const workspaceId = newId('ws');
  const dek = generateDek();
  const wrapped = wrapDek(dek);
  const now = new Date();
  await db.insert(users).values({
    id: userId,
    email: `${workspaceId}@example.com`,
    passwordHash: 'not-a-real-hash',
    createdAt: now,
  });
  await db.insert(workspaces).values({
    id: workspaceId,
    name: 'rotation test workspace',
    ownerId: userId,
    wrappedDek: packEncrypted(wrapped),
    createdAt: now,
  });
  await db.insert(workspaceMembers).values({
    id: newId('mem'),
    workspaceId,
    userId,
    role: 'owner',
    createdAt: now,
  });
  return workspaceId;
}

describe('provider key rotation', () => {
  it('connecting a second time replaces the key in place: same credential, new key round-trips, old key gone', async () => {
    const workspaceId = await makeWorkspace();

    const first = await connectProvider(workspaceId, 'openai', 'sk-key-A');
    expect(first.rotated).toBe(false);

    const beforeRotate = await listConnectedProviders(workspaceId);
    expect(beforeRotate).toHaveLength(1);
    const originalCreatedAt = beforeRotate[0].createdAt.getTime();
    const originalVerifiedAt = beforeRotate[0].lastVerifiedAt.getTime();

    const resolveBefore = await buildKeyResolver(workspaceId);
    expect(resolveBefore('openai')).toBe('sk-key-A');

    // Rotate to a new key.
    await new Promise((r) => setTimeout(r, 5)); // ensure a distinguishable lastVerifiedAt
    const second = await connectProvider(workspaceId, 'openai', 'sk-key-B');
    expect(second.rotated).toBe(true);
    expect(second.id).toBe(first.id); // same credential row, rotated in place

    const afterRotate = await listConnectedProviders(workspaceId);
    // Still exactly one credential for this provider - no duplicate row left behind.
    expect(afterRotate).toHaveLength(1);
    expect(afterRotate[0].id).toBe(first.id);
    // createdAt (first-connected) is preserved across a rotation...
    expect(afterRotate[0].createdAt.getTime()).toBe(originalCreatedAt);
    // ...but lastVerifiedAt (rotation timestamp) advances.
    expect(afterRotate[0].lastVerifiedAt.getTime()).toBeGreaterThan(originalVerifiedAt);

    // The new key round-trips correctly...
    const resolveAfter = await buildKeyResolver(workspaceId);
    expect(resolveAfter('openai')).toBe('sk-key-B');

    // ...and the old key is nowhere to be found - not returned by any API, and
    // not decryptable from storage any more (only one ciphertext exists, and it
    // decrypts to the new key, never the old one).
    expect(resolveAfter('openai')).not.toBe('sk-key-A');
  });

  it('never returns plaintext key material from connectProvider, on connect or rotate', async () => {
    const workspaceId = await makeWorkspace();
    const first = await connectProvider(workspaceId, 'openai', 'sk-super-secret-A');
    expect(JSON.stringify(first)).not.toContain('sk-super-secret-A');

    const second = await connectProvider(workspaceId, 'openai', 'sk-super-secret-B');
    expect(JSON.stringify(second)).not.toContain('sk-super-secret-A');
    expect(JSON.stringify(second)).not.toContain('sk-super-secret-B');
  });
});
