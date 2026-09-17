import { and, eq } from 'drizzle-orm';
import { db } from './client';
import {
  providerCredentials,
  routingDecisions,
  conversations,
  messages,
  usageEvents,
  workspaceMembers,
  workspaces,
} from './schema';

// Workspace-scoped query helpers. Every read/write that touches tenant data goes
// through here so that "forgot the WHERE workspace_id = ?" is structurally hard,
// rather than something every call site has to remember on its own.

export function scopedQueries(workspaceId: string) {
  if (!workspaceId) throw new Error('workspaceId is required for scoped queries');

  return {
    // -- provider credentials --
    listProviderCredentials: () =>
      db.select().from(providerCredentials).where(eq(providerCredentials.workspaceId, workspaceId)),

    getProviderCredential: (id: string) =>
      db
        .select()
        .from(providerCredentials)
        .where(and(eq(providerCredentials.id, id), eq(providerCredentials.workspaceId, workspaceId)))
        .then((r) => r[0]),

    getProviderCredentialByProvider: (provider: string) =>
      db
        .select()
        .from(providerCredentials)
        .where(
          and(eq(providerCredentials.provider, provider), eq(providerCredentials.workspaceId, workspaceId))
        )
        .then((r) => r[0]),

    insertProviderCredential: (values: Omit<typeof providerCredentials.$inferInsert, 'workspaceId'>) =>
      db.insert(providerCredentials).values({ ...values, workspaceId }),

    deleteProviderCredential: (id: string) =>
      db
        .delete(providerCredentials)
        .where(and(eq(providerCredentials.id, id), eq(providerCredentials.workspaceId, workspaceId))),

    // -- routing decisions --
    insertRoutingDecision: (values: Omit<typeof routingDecisions.$inferInsert, 'workspaceId'>) =>
      db.insert(routingDecisions).values({ ...values, workspaceId }),

    // -- conversations --
    listConversations: () =>
      db.select().from(conversations).where(eq(conversations.workspaceId, workspaceId)),

    getConversation: (id: string) =>
      db
        .select()
        .from(conversations)
        .where(and(eq(conversations.id, id), eq(conversations.workspaceId, workspaceId)))
        .then((r) => r[0]),

    insertConversation: (values: Omit<typeof conversations.$inferInsert, 'workspaceId'>) =>
      db.insert(conversations).values({ ...values, workspaceId }),

    // -- messages --
    listMessages: (conversationId: string) =>
      db
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), eq(messages.workspaceId, workspaceId))),

    insertMessage: (values: Omit<typeof messages.$inferInsert, 'workspaceId'>) =>
      db.insert(messages).values({ ...values, workspaceId }),

    // -- usage events --
    insertUsageEvent: (values: Omit<typeof usageEvents.$inferInsert, 'workspaceId'>) =>
      db.insert(usageEvents).values({ ...values, workspaceId }),

    listUsageEvents: () => db.select().from(usageEvents).where(eq(usageEvents.workspaceId, workspaceId)),

    // -- workspace / membership --
    getWorkspace: () => db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).then((r) => r[0]),
  };
}

/** Confirms a user is a member of a workspace before any scoped query runs. Throws if not. */
export async function assertMembership(userId: string, workspaceId: string): Promise<void> {
  const rows = await db
    .select()
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
  if (rows.length === 0) {
    throw new Error('Not a member of this workspace');
  }
}
