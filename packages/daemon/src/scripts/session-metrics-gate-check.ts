import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDb, closeDb, getEvents } from '../db/client.js';
import { WatcherPool } from '../watcher-pool.js';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function waitUntil(predicate: () => boolean, timeoutMs: number, description: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function main(): Promise<void> {
  const baseDir = mkdtempSync(join(tmpdir(), 'vrrbose-session-metrics-'));
  const homeDir = join(baseDir, 'home');
  const vrrboseDir = join(homeDir, '.vrrbose');
  const dbPath = join(vrrboseDir, 'metrics-gate.db');
  const projectPath = join(baseDir, 'project');
  const watchedFile = join(projectPath, 'index.ts');

  mkdirSync(vrrboseDir, { recursive: true });
  mkdirSync(projectPath, { recursive: true });
  writeFileSync(watchedFile, 'export const value = 1;\n', 'utf8');

  process.env['HOME'] = homeDir;
  process.env['USERPROFILE'] = homeDir;

  const db = getDb(dbPath);
  const pool = new WatcherPool(db, () => {});

  const registration = pool.addProject(projectPath);
  const projectId = registration.projectId;

  appendFileSync(watchedFile, `// change ${randomUUID()}\n`, 'utf8');
  await sleep(1200);
  appendFileSync(watchedFile, `// another change ${randomUUID()}\n`, 'utf8');

  await waitUntil(
    () => {
      const events = getEvents(db, projectId, { limit: 100 });
      return events.some((e) => e.type === 'file_save') || events.some((e) => e.type === 'file_create');
    },
    12_000,
    'file watcher events'
  );

  await sleep(1000);

  const session = pool.getActiveSessionForProject(projectId);
  assert(session !== null, 'Active session not found');
  assert(session.fileChurn > 0, `Expected fileChurn > 0, got ${session.fileChurn}`);
  assert(session.activeTimeMs > 0, `Expected activeTimeMs > 0, got ${session.activeTimeMs}`);

  console.log(`session-metrics-gate: PASS active-time (${session.activeTimeMs}ms)`);
  console.log(`session-metrics-gate: PASS file-churn (${session.fileChurn})`);

  pool.stopAll();
  closeDb();
}

main().catch((err) => {
  console.error('session-metrics-gate: FAIL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
