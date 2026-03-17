import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { getDb, closeDb, insertProject, getEvents } from '../db/client.js';
import { GitWatcher } from '../watchers/git.js';
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

function run(command: string, cwd: string): void {
  execSync(command, { cwd, stdio: 'pipe' });
}

async function main(): Promise<void> {
  const baseDir = join(tmpdir(), `vrrbose-capsule-trigger-gate-${Date.now()}`);
  const homeDir = join(baseDir, 'home');
  const vrrboseDir = join(homeDir, '.vrrbose');
  const dbPath = join(vrrboseDir, 'capsule-trigger-gate.db');
  const repoPath = join(baseDir, 'repo');
  mkdirSync(vrrboseDir, { recursive: true });
  mkdirSync(repoPath, { recursive: true });

  process.env['HOME'] = homeDir;
  process.env['USERPROFILE'] = homeDir;

  const weekdays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;
  const today = weekdays[new Date().getDay()] ?? 'sunday';

  writeFileSync(
    join(repoPath, 'VRRBOSE.md'),
    `# Capsule Trigger Gate\n\n\
\`\`\`yaml\nsession:\n  weekly_capsule_day: ${today}\n\`\`\`\n`,
    'utf8',
  );

  run('git init -b main', repoPath);
  run('git config user.email "gate@example.com"', repoPath);
  run('git config user.name "Gate Runner"', repoPath);
  writeFileSync(join(repoPath, 'README.md'), 'hello\n', 'utf8');
  run('git add .', repoPath);
  run('git commit -m "chore: initial"', repoPath);

  run('git checkout -b feature/capsule', repoPath);
  writeFileSync(join(repoPath, 'feature.txt'), 'feature\n', 'utf8');
  run('git add .', repoPath);
  run('git commit -m "feat: feature branch"', repoPath);
  run('git checkout main', repoPath);

  const db = getDb(dbPath);
  const projectId = randomUUID();
  insertProject(db, {
    id: projectId,
    name: 'capsule-trigger-gate-project',
    type: 'other',
    stack: ['node'],
    description: 'capsule trigger gate checks',
    rootPath: repoPath,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  });

  const gitWatcher = new GitWatcher({
    db,
    projectId,
    projectPath: repoPath,
    onActivity: () => {},
    onEvent: () => {},
    pollIntervalMs: 200,
    stagedDiffMode: 'off',
    autoCapsuleOnMerge: true,
    autoCapsuleOnTag: true,
  });
  gitWatcher.start();
  await sleep(750);

  run('git merge --no-ff feature/capsule -m "Merge branch feature/capsule"', repoPath);
  run('git tag v0.0.1', repoPath);

  await waitUntil(
    () => {
      const mergeEvents = getEvents(db, projectId, { type: 'git_merge', limit: 50 });
      const tagEvents = getEvents(db, projectId, { type: 'git_tag', limit: 50 });
      const capsuleEvents = getEvents(db, projectId, { type: 'capsule_create', limit: 200 });
      const triggers = new Set(capsuleEvents.map((e) => String(e.payload['trigger'] ?? '')));
      return mergeEvents.length > 0 && tagEvents.length > 0 && triggers.has('merge') && triggers.has('tag');
    },
    30_000,
    'merge/tag capsule triggers',
  );

  gitWatcher.stop();

  const pool = new WatcherPool(db, () => {});
  const registration = pool.addProject(repoPath);
  const watchedProjectId = registration.projectId;
  const manualOk = pool.triggerManualCapsule(watchedProjectId, 'Manual trigger gate');
  assert(manualOk, 'Manual capsule trigger should succeed');

  await waitUntil(
    () => {
      const events = getEvents(db, watchedProjectId, { type: 'capsule_create', limit: 300 });
      const triggers = new Set(events.map((e) => String(e.payload['trigger'] ?? '')));
      return triggers.has('manual') && triggers.has('weekly');
    },
    15_000,
    'manual/weekly capsule triggers',
  );

  const capsuleEvents = getEvents(db, watchedProjectId, { type: 'capsule_create', limit: 300 });
  const triggers = new Set(capsuleEvents.map((e) => String(e.payload['trigger'] ?? '')));
  assert(triggers.has('merge'), 'Expected merge capsule trigger event');
  assert(triggers.has('tag'), 'Expected tag capsule trigger event');
  assert(triggers.has('manual'), 'Expected manual capsule trigger event');
  assert(triggers.has('weekly'), 'Expected weekly capsule trigger event');

  console.log('capsule-trigger-gate: PASS merge/tag/manual/weekly triggers');

  pool.stopAll();
  await sleep(200);
  closeDb();
  process.exit(0);
}

main().catch((err) => {
  console.error('capsule-trigger-gate: FAIL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
