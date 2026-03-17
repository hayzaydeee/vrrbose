import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  getDb,
  closeDb,
  insertProject,
  insertSession,
  insertEvent,
  getSession,
  getSyncState,
} from '../db/client.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const homeDir = join(tmpdir(), `vrrbose-migration-gate-${Date.now()}`);
  const vrrboseDir = join(homeDir, '.vrrbose');
  const dbPath = join(vrrboseDir, 'migration-gate.db');
  mkdirSync(vrrboseDir, { recursive: true });

  process.env['HOME'] = homeDir;
  process.env['USERPROFILE'] = homeDir;

  const projectId = randomUUID();
  const sessionId = randomUUID();

  const db1 = getDb(dbPath);
  insertProject(db1, {
    id: projectId,
    name: 'migration-gate-project',
    type: 'other',
    stack: ['node'],
    description: 'migration gate checks',
    rootPath: process.cwd(),
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  });

  const startedAt = Date.now() - 10_000;
  insertSession(db1, {
    id: sessionId,
    projectId,
    startedAt,
    endedAt: Date.now(),
    idleThresholdMs: 7_200_000,
    score: null,
    commitCount: 0,
    fileChurn: 0,
    activeTimeMs: 0,
    summary: null,
    syncStatus: 'pending',
  });

  insertEvent(db1, {
    id: randomUUID(),
    projectId,
    sessionId,
    type: 'file_save',
    timestamp: startedAt + 1000,
    payload: { filePath: 'src/a.ts' },
    syncStatus: 'pending',
    createdAt: startedAt + 1000,
  });

  insertEvent(db1, {
    id: randomUUID(),
    projectId,
    sessionId,
    type: 'git_staged_diff',
    timestamp: startedAt + 4000,
    payload: { insertions: 5, deletions: 3, files: ['src/a.ts'] },
    syncStatus: 'pending',
    createdAt: startedAt + 4000,
  });

  closeDb();

  // Reopen DB to trigger one-time migration/backfill logic.
  const db2 = getDb(dbPath);
  const updated = getSession(db2, sessionId);
  assert(updated !== null, 'Session should exist after reopen');
  assert((updated?.activeTimeMs ?? 0) > 0, `Expected migrated activeTimeMs > 0, got ${updated?.activeTimeMs}`);
  assert((updated?.fileChurn ?? 0) >= 8, `Expected migrated fileChurn >= 8, got ${updated?.fileChurn}`);

  const migrationState = getSyncState(db2, 'migration.20260316.backfill_session_metrics_v1');
  assert(typeof migrationState === 'string' && migrationState.startsWith('done:'), `Expected migration state done marker, got ${migrationState}`);

  console.log(`migration-gate: PASS active-time backfill (${updated?.activeTimeMs}ms)`);
  console.log(`migration-gate: PASS file-churn backfill (${updated?.fileChurn})`);
  console.log('migration-gate: PASS migration marker');

  closeDb();
}

main().catch((err) => {
  console.error('migration-gate: FAIL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
