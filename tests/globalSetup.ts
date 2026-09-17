import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import fs from 'node:fs';

const ROOT = path.join(__dirname, '..');
const TEST_DB = path.join(ROOT, 'data', 'test-integration.db');
export const TEST_PORT = 4178;
export const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

let server: ChildProcess | undefined;

async function waitForServer(url: string, timeoutMs = 60000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Server at ${url} did not become ready within ${timeoutMs}ms`);
}

export async function setup() {
  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const p = TEST_DB + suffix;
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }

  const env = {
    ...process.env,
    DATABASE_URL: TEST_DB,
    KEK_BASE64: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    SESSION_SECRET: 'test-session-secret-at-least-32-chars-long-000000',
    INSECURE_COOKIES: 'true',
    PORT: String(TEST_PORT),
  };

  // Apply schema + seed registry against the integration test DB before boot.
  const { execSync } = await import('node:child_process');
  execSync('npx tsx scripts/migrate.ts', { cwd: ROOT, env, stdio: 'inherit' });
  execSync('npx tsx scripts/seed.ts', { cwd: ROOT, env, stdio: 'inherit' });

  server = spawn('npx', ['next', 'dev', '-p', String(TEST_PORT)], {
    cwd: ROOT,
    env,
    stdio: 'pipe',
    detached: true, // own process group, so we can kill next's child processes too
  });
  server.stdout?.on('data', () => {});
  server.stderr?.on('data', () => {});

  await waitForServer(`${BASE_URL}/api/auth/me`);
}

export async function teardown() {
  if (server && server.pid) {
    try {
      process.kill(-server.pid, 'SIGKILL'); // kill whole process group (next spawns children)
    } catch {
      server.kill('SIGKILL');
    }
  }
}
