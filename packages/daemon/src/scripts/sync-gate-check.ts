import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import {
  getDb,
  closeDb,
  insertProject,
  insertSession,
  insertEvent,
  insertCapsule,
  getPendingSyncEvents,
  getPendingSyncSessions,
  getPendingSyncCapsules,
} from '../db/client.js';
import type { Event, Session, Capsule } from '@vrrbose/shared';

const HOME_DIR = join(tmpdir(), `vrrbose-sync-gate-${Date.now()}`);
const VRRBOSE_DIR = join(HOME_DIR, '.vrrbose');
const ENV_PATH = join(VRRBOSE_DIR, '.env');
const DB_PATH = join(VRRBOSE_DIR, 'sync-gate.db');

const SYNC_TIMEOUT_MS = 20_000;
const BASE_INTERVAL_MS = 200;

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
  throw new Error(`Timed out waiting for: ${description}`);
}

async function main(): Promise<void> {
  mkdirSync(VRRBOSE_DIR, { recursive: true });

  const previousHome = process.env['HOME'];
  const previousUserProfile = process.env['USERPROFILE'];
  const previousEnvFile = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : null;

  const projectPath = join(process.cwd(), '..', '..');
  const projectId = randomUUID();

  const receivedEventBatches: string[][] = [];
  const receivedSessionBatches: string[][] = [];
  const receivedCapsuleBatches: string[][] = [];
  let failFirstEventsRequest = true;
  let requireGoodToken = false;
  const goodToken = 'good-token';

  const server = createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end('method not allowed');
      return;
    }

    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    req.on('end', () => {
      const body = Buffer.concat(chunks).toString('utf8');
      const parsed = JSON.parse(body) as { events?: Event[]; sessions?: Session[]; capsules?: Capsule[] };
      const authHeader = req.headers['authorization'];
      const token = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '') : '';

      if (requireGoodToken && token !== goodToken) {
        res.writeHead(401).end('invalid token');
        return;
      }

      if (req.url === '/sync/events') {
        const ids = (parsed.events ?? []).map((e) => e.id);
        receivedEventBatches.push(ids);
        if (failFirstEventsRequest) {
          failFirstEventsRequest = false;
          res.writeHead(500).end('forced event failure');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
        return;
      }

      if (req.url === '/sync/sessions') {
        const ids = (parsed.sessions ?? []).map((s) => s.id);
        receivedSessionBatches.push(ids);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
        return;
      }

      if (req.url === '/sync/capsules') {
        const ids = (parsed.capsules ?? []).map((c: Capsule) => c.id);
        receivedCapsuleBatches.push(ids);
        res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
        return;
      }

      res.writeHead(404).end('not found');
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const serverAddress = server.address();
  assert(serverAddress && typeof serverAddress === 'object', 'Failed to bind test server port');
  const port = serverAddress.port;

  process.env['HOME'] = HOME_DIR;
  process.env['USERPROFILE'] = HOME_DIR;
  process.env['VRRBOSE_API_URL'] = `http://127.0.0.1:${port}`;
  process.env['VRRBOSE_SYNC_BASE_INTERVAL_MS'] = String(BASE_INTERVAL_MS);
  process.env['VRRBOSE_SYNC_MAX_BACKOFF_MS'] = '1000';
  process.env['VRRBOSE_SYNC_CIRCUIT_OPEN_MS'] = '2000';
  process.env['VRRBOSE_SYNC_FAILURE_THRESHOLD'] = '4';
  process.env['VRRBOSE_SYNC_BATCH_SIZE'] = '40';
  process.env['VRRBOSE_PROJECT_PATH'] = projectPath;

  writeFileSync(ENV_PATH, 'VRRBOSE_TOKEN=test-token\n', 'utf8');

  const db = getDb(DB_PATH);

  function insertPendingSessionWithEvents(eventCount: number): { sessionId: string; eventIds: string[]; createdAt: number } {
    const sessionId = randomUUID();
    const eventIds = Array.from({ length: eventCount }, () => randomUUID());
    const createdAt = Date.now();

    insertSession(db, {
      id: sessionId,
      projectId,
      startedAt: Date.now() - 5_000,
      endedAt: Date.now() - 1_000,
      idleThresholdMs: 7_200_000,
      score: null,
      commitCount: 0,
      fileChurn: 0,
      activeTimeMs: 0,
      summary: null,
      syncStatus: 'pending',
    });

    for (const id of eventIds) {
      insertEvent(db, {
        id,
        projectId,
        sessionId,
        type: 'file_save',
        timestamp: Date.now(),
        payload: { file: 'src/index.ts' },
        syncStatus: 'pending',
        createdAt,
      });
    }

    return { sessionId, eventIds, createdAt };
  }

  function insertPendingCapsule(sessionId: string): Capsule {
    const capsule: Capsule = {
      id: randomUUID(),
      projectId,
      sessionId,
      title: 'Sync Gate Capsule',
      summary: 'capsule sync verification',
      keyFiles: ['src/index.ts'],
      decisions: [],
      openQuestions: [],
      createdAt: Date.now(),
      trigger: 'manual',
      syncStatus: 'pending',
    };
    insertCapsule(db, capsule);
    return capsule;
  }

  function readSyncStateNumber(key: string): number {
    const row = db.prepare('SELECT value FROM sync_state WHERE key = ?').get(key) as { value?: string } | undefined;
    const parsed = Number(row?.value ?? '0');
    return Number.isFinite(parsed) ? parsed : 0;
  }

  insertProject(db, {
    id: projectId,
    name: 'sync-gate-project',
    type: 'other',
    stack: ['node'],
    description: 'sync gate test project',
    rootPath: projectPath,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  });

  const scenario1 = insertPendingSessionWithEvents(120);
  const scenario1Capsule = insertPendingCapsule(scenario1.sessionId);

  const { startSyncWorker } = await import('../sync/worker.js');
  let stopSyncWorker = startSyncWorker(db);

  try {
    await waitUntil(() => getPendingSyncEvents(db, 1000).length === 0, SYNC_TIMEOUT_MS, 'all events synced');
    await waitUntil(() => getPendingSyncSessions(db, 1000).length === 0, SYNC_TIMEOUT_MS, 'all sessions synced');
    await waitUntil(() => getPendingSyncCapsules(db, 1000).length === 0, SYNC_TIMEOUT_MS, 'all capsules synced');

    // Wait one extra interval to ensure no extra replay after successful sync.
    await sleep(BASE_INTERVAL_MS * 3);

    // Gate 1: failure/recovery path triggered and recovered.
    assert(receivedEventBatches.length >= 2, 'Expected retry after forced event sync failure');

    // Gate 2: once synced, no more batches are sent for already-synced IDs.
    const firstSeen = new Set<string>();
    let duplicatesAfterRecovery = 0;
    for (const batch of receivedEventBatches) {
      for (const id of batch) {
        if (firstSeen.has(id)) duplicatesAfterRecovery += 1;
        firstSeen.add(id);
      }
    }
    // One duplicate pass is expected due to the forced first failure; any additional duplicate rounds are suspicious.
    const expectedDuplicateCount = scenario1.eventIds.length;
    assert(
      duplicatesAfterRecovery <= expectedDuplicateCount,
      `Detected unexpected duplicate uploads after recovery (duplicates=${duplicatesAfterRecovery})`
    );

    // Gate 3: basic sync lag under load.
    const lastSuccessAt = readSyncStateNumber('sync.last_success_at');
    assert(Number.isFinite(lastSuccessAt) && lastSuccessAt > 0, 'Missing sync.last_success_at telemetry');
    const lagMs = lastSuccessAt - scenario1.createdAt;
    assert(lagMs <= 15_000, `Sync lag check failed under load: ${lagMs}ms`);

    console.log('sync-gate: PASS failure/recovery');
    console.log('sync-gate: PASS duplicate-write guard');
    console.log(`sync-gate: PASS lag-under-load (${lagMs}ms)`);
    assert(receivedCapsuleBatches.some((batch) => batch.includes(scenario1Capsule.id)), 'Capsule payload was not synced');
    console.log('sync-gate: PASS capsule-sync');

    // Exploratory-style check 1: restart worker with pending data and verify recovery.
    stopSyncWorker();
    const scenario2 = insertPendingSessionWithEvents(8);
    stopSyncWorker = startSyncWorker(db);
    await waitUntil(
      () => getPendingSyncEvents(db, 1000).every((e) => !scenario2.eventIds.includes(e.id)),
      SYNC_TIMEOUT_MS,
      'events synced after worker restart'
    );
    await waitUntil(() => getPendingSyncSessions(db, 1000).every((s) => s.id !== scenario2.sessionId), SYNC_TIMEOUT_MS, 'session synced after worker restart');
    console.log('sync-gate: PASS restart-during-sync recovery');

    // Exploratory-style check 2: auth failure then token refresh recovery.
    stopSyncWorker();
    const scenario3 = insertPendingSessionWithEvents(6);
    requireGoodToken = true;
    writeFileSync(ENV_PATH, 'VRRBOSE_TOKEN=bad-token\n', 'utf8');
    stopSyncWorker = startSyncWorker(db);

    await waitUntil(() => readSyncStateNumber('sync.auth_invalid') === 1, SYNC_TIMEOUT_MS, 'auth invalid state set');
    writeFileSync(ENV_PATH, `VRRBOSE_TOKEN=${goodToken}\n`, 'utf8');

    await waitUntil(
      () => getPendingSyncEvents(db, 1000).every((e) => !scenario3.eventIds.includes(e.id)),
      SYNC_TIMEOUT_MS,
      'events synced after token refresh'
    );
    await waitUntil(() => getPendingSyncSessions(db, 1000).every((s) => s.id !== scenario3.sessionId), SYNC_TIMEOUT_MS, 'session synced after token refresh');
    await waitUntil(() => readSyncStateNumber('sync.auth_invalid') === 0, SYNC_TIMEOUT_MS, 'auth invalid state cleared');
    console.log('sync-gate: PASS invalid-token recovery');
  } finally {
    stopSyncWorker();
    closeDb();
    await new Promise<void>((resolve) => server.close(() => resolve()));

    if (previousEnvFile === null) {
      if (existsSync(ENV_PATH)) unlinkSync(ENV_PATH);
    } else {
      writeFileSync(ENV_PATH, previousEnvFile, 'utf8');
    }

    if (previousHome !== undefined) process.env['HOME'] = previousHome;
    if (previousUserProfile !== undefined) process.env['USERPROFILE'] = previousUserProfile;
  }
}

main().catch((err) => {
  console.error('sync-gate: FAIL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
