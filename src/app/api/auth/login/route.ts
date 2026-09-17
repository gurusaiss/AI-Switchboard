import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '../../../../db/client';
import { users, workspaceMembers } from '../../../../db/schema';
import { verifyPassword, getSession } from '../../../../lib/auth';
import { jsonError, withErrorHandling } from '../../../../lib/api-helpers';

const bodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const POST = withErrorHandling(async (req: NextRequest) => {
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return jsonError('Invalid input');
  }
  const { email, password } = parsed.data;

  const rows = await db.select().from(users).where(eq(users.email, email));
  const user = rows[0];
  if (!user) {
    return jsonError('Invalid email or password', 401);
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    return jsonError('Invalid email or password', 401);
  }

  const memberships = await db
    .select()
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, user.id));
  const workspaceId = memberships[0]?.workspaceId;
  if (!workspaceId) {
    return jsonError('No workspace found for this user', 500);
  }

  const session = await getSession();
  session.userId = user.id;
  session.workspaceId = workspaceId;
  session.email = user.email;
  await session.save();

  return NextResponse.json({ user: { id: user.id, email: user.email }, workspaceId });
});
