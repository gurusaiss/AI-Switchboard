import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { afterAll } from 'vitest';

const testDbPath = path.join(__dirname, '..', 'data', 'test.db');

// Fresh DB file per test run.
for (const suffix of ['', '-journal', '-wal', '-shm']) {
  const p = testDbPath + suffix;
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

process.env.DATABASE_URL = testDbPath;
process.env.KEK_BASE64 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
process.env.SESSION_SECRET = 'test-session-secret-at-least-32-chars-long-000000';
process.env.INSECURE_COOKIES = 'true';

// Apply migrations + seed the model registry synchronously before any test file runs.
execSync('npx tsx scripts/migrate.ts', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
execSync('npx tsx scripts/seed.ts', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });

afterAll(async () => {
  const { sqlite } = await import('../src/db/client');
  sqlite.close();
});
