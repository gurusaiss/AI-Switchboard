import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { connectProvider } from '../../../../lib/providerService';
import { jsonError, withErrorHandling } from '../../../../lib/api-helpers';
import { safeLog } from '../../../../lib/redact';

const bodySchema = z.object({
  provider: z.enum(['openai', 'anthropic', 'google', 'openrouter', 'ollama']),
  apiKey: z.string().min(1).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const { workspaceId } = await requireSession();
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid input');
  }
  const { provider, apiKey } = parsed.data;

  if (provider !== 'ollama' && !apiKey) {
    return jsonError(`An API key is required to connect ${provider}`);
  }

  try {
    const { id, discoveredModels } = await connectProvider(workspaceId, provider, apiKey);
    // Never echo the key back - only confirmation + what was discovered.
    return NextResponse.json({
      id,
      provider,
      discoveredModels: discoveredModels.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        capabilities: m.capabilities,
      })),
    });
  } catch (err) {
    // Log a redacted, generic failure - never let a key-shaped string leak into logs.
    safeLog.error(`Provider connect failed for ${provider}`);
    const message = err instanceof Error ? err.message : 'Failed to connect provider';
    return jsonError(message, 502);
  }
});
