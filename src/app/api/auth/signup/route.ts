import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { db } from '../../../../db/client';
import { users, workspaces, workspaceMembers } from '../../../../db/schema';
import { eq } from 'drizzle-orm';
import { hashPassword, getSession } from '../../../../lib/auth';
import { newId } from '../../../../lib/ids';
import { generateDek, wrapDek, packEncrypted } from '../../../../lib/crypto';
import { jsonError, withErrorHandling } from '../../../../lib/api-helpers';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  workspaceName: z.string().min(1).optional(),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return jsonError(parsed.error.issues[0]?.message ?? 'Invalid input');
  }
  const { email, password, workspaceName } = parsed.data;

  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length > 0) {
    return jsonError('An account with that email already exists', 409);
  }

  const userId = newId('user');
  const workspaceId = newId('ws');
  const now = new Date();

  const passwordHash = await hashPassword(password);
  const dek = generateDek();
  const wrapped = wrapDek(dek);

  await db.insert(users).values({ id: userId, email, passwordHash, createdAt: now });
  await db.insert(workspaces).values({
    id: workspaceId,
    name: workspaceName || `${email.split('@')[0]}'s workspace`,
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

  const session = await getSession();
  session.userId = userId;
  session.workspaceId = workspaceId;
  session.email = email;
  await session.save();

  return NextResponse.json({ user: { id: userId, email }, workspaceId });
});
