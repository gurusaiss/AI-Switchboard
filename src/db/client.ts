import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import * as schema from './schema';
import { env } from '../lib/env';

// Singleton sqlite connection (module-level cache survives Next.js dev hot-reload
// via globalThis, avoiding "too many open files" from repeated re-instantiation).

declare global {
  // eslint-disable-next-line no-var
  var __acp_sqlite__: Database.Database | undefined;
}

function resolveDbPath(): string {
  const p = env.databaseUrl;
  const abs = path.isAbsolute(p) ? p : path.join(process.cwd(), p);
  const dir = path.dirname(abs);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return abs;
}

function getSqlite(): Database.Database {
  if (!globalThis.__acp_sqlite__) {
    const dbPath = resolveDbPath();
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    globalThis.__acp_sqlite__ = sqlite;
  }
  return globalThis.__acp_sqlite__;
}

export const sqlite = getSqlite();
export const db = drizzle(sqlite, { schema });
export type DbClient = typeof db;
