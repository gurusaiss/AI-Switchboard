import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// NOTE ON PORTABILITY: this schema is written against drizzle-orm/sqlite-core for
// zero-infrastructure local dev (better-sqlite3), but deliberately avoids SQLite-only
// tricks: ids are text (uuid-shaped) rather than INTEGER PRIMARY KEY autoincrement,
// timestamps are stored as integer unix-ms (portable to a Postgres `bigint`/`timestamptz`
// via a straightforward mapping), booleans are stored as integer 0/1 (mode: 'boolean'),
// and JSON columns use text with mode: 'json' (maps directly to Postgres `jsonb`).
// Porting to Postgres later means swapping sqlite-core imports for pg-core equivalents;
// no structural redesign should be needed.

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  ownerId: text('owner_id')
    .notNull()
    .references(() => users.id),
  // Each workspace has its own Data Encryption Key, wrapped (encrypted) with the
  // server-wide KEK from the environment. Never store the raw DEK.
  wrappedDek: text('wrapped_dek').notNull(), // JSON-packed EncryptedPayload
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const workspaceMembers = sqliteTable('workspace_members', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  role: text('role').notNull().default('owner'), // owner | member (V1: single-user workspaces mostly)
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

// Provider credentials: the plaintext API key is NEVER stored. Only the AES-256-GCM
// ciphertext + iv + authTag (packed as JSON in `encrypted`), encrypted with the
// workspace's DEK.
export const providerCredentials = sqliteTable('provider_credentials', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  provider: text('provider').notNull(), // openai | anthropic | google | openrouter | ollama
  encrypted: text('encrypted').notNull(), // JSON-packed EncryptedPayload of the API key
  label: text('label'), // optional human label, e.g. "personal key"
  discoveredModels: text('discovered_models', { mode: 'json' }).$type<string[]>(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

// Model registry - seed data, not hardcoded routing logic. Adding a model means
// adding a row here.
export const models = sqliteTable('models', {
  id: text('id').primaryKey(), // e.g. "openai:gpt-4o-mini"
  provider: text('provider').notNull(),
  modelId: text('model_id').notNull(), // the provider's own model identifier
  displayName: text('display_name').notNull(),
  modality: text('modality', { mode: 'json' }).$type<string[]>().notNull(), // ["text","vision",...]
  contextWindow: integer('context_window').notNull(),
  capabilities: text('capabilities', { mode: 'json' })
    .$type<string[]>()
    .notNull(), // coding, reasoning, vision, structuredOutput, toolUse, creative, research
  pricingInputPer1k: real('pricing_input_per_1k').notNull(), // USD estimate
  pricingOutputPer1k: real('pricing_output_per_1k').notNull(),
  typicalLatencyMs: integer('typical_latency_ms').notNull(),
  reliabilityScore: real('reliability_score').notNull(), // 0..1, seeded, updated from outcomes
  isLocal: integer('is_local', { mode: 'boolean' }).notNull().default(false),
});

export const routingDecisions = sqliteTable('routing_decisions', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  conversationId: text('conversation_id'),
  taskRequirements: text('task_requirements', { mode: 'json' }).notNull(),
  chosenModelId: text('chosen_model_id').notNull(),
  reason: text('reason').notNull(),
  fallbackChain: text('fallback_chain', { mode: 'json' }).$type<string[]>().notNull(),
  routingMode: text('routing_mode').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  title: text('title').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const messages = sqliteTable('messages', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  conversationId: text('conversation_id')
    .notNull()
    .references(() => conversations.id),
  role: text('role').notNull(), // user | assistant
  content: text('content').notNull(),
  modelId: text('model_id'),
  isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});

export const usageEvents = sqliteTable('usage_events', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id),
  modelId: text('model_id').notNull(),
  provider: text('provider').notNull(),
  latencyMs: integer('latency_ms').notNull(),
  estCost: real('est_cost').notNull(),
  success: integer('success', { mode: 'boolean' }).notNull(),
  isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
  createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
});
