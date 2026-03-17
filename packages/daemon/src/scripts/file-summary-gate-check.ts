import { mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDb, closeDb, insertProject, insertSession, upsertFileSummary } from '../db/client.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const homeDir = join(tmpdir(), `vrrbose-file-summary-gate-${Date.now()}`);
  const vrrboseDir = join(homeDir, '.vrrbose');
  const dbPath = join(vrrboseDir, 'file-summary-gate.db');
  mkdirSync(vrrboseDir, { recursive: true });

  process.env['HOME'] = homeDir;
  process.env['USERPROFILE'] = homeDir;

  const db = getDb(dbPath);
  const projectId = randomUUID();
  const sessionId = randomUUID();

  insertProject(db, {
    id: projectId,
    name: 'file-summary-gate-project',
    type: 'other',
    stack: ['node'],
    description: 'file summary gate checks',
    rootPath: process.cwd(),
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  });

  insertSession(db, {
    id: sessionId,
    projectId,
    startedAt: Date.now() - 5000,
    endedAt: null,
    idleThresholdMs: 7_200_000,
    score: null,
    commitCount: 0,
    fileChurn: 0,
    activeTimeMs: 0,
    summary: null,
    syncStatus: 'pending',
  });

  upsertFileSummary(db, {
    projectId,
    sessionId,
    filePath: 'src/a.ts',
    linesAdded: 5,
    linesRemoved: 2,
    timestamp: Date.now(),
  });

  upsertFileSummary(db, {
    projectId,
    sessionId,
    filePath: 'src/a.ts',
    linesAdded: 1,
    linesRemoved: 1,
    timestamp: Date.now() + 1,
  });

  const row = db.prepare('SELECT edit_count, lines_added, lines_removed FROM file_summaries WHERE id = ?').get(`${sessionId}:src/a.ts`) as { edit_count: number; lines_added: number; lines_removed: number } | undefined;
  assert(row !== undefined, 'Expected file summary row to exist');
  assert(row.edit_count === 2, `Expected edit_count=2, got ${row.edit_count}`);
  assert(row.lines_added === 6, `Expected lines_added=6, got ${row.lines_added}`);
  assert(row.lines_removed === 3, `Expected lines_removed=3, got ${row.lines_removed}`);

  console.log('file-summary-gate: PASS deterministic summary refresh');

  closeDb();
}

main().catch((err) => {
  console.error('file-summary-gate: FAIL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
