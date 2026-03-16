import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventSchema } from '@vrrbose/shared';
import { getDb, closeDb, insertProject, insertEvent, getEvents } from '../db/client.js';
import { TerminalWatcher } from '../watchers/terminal.js';
import { TestRunWatcher } from '../watchers/test.js';
import { AiPromptWatcher } from '../watchers/ai-prompt.js';
import type { Event } from '@vrrbose/shared';

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
    await sleep(50);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function main(): Promise<void> {
  const baseDir = join(tmpdir(), `vrrbose-capture-gate-${Date.now()}`);
  const homeDir = join(baseDir, 'home');
  const vrrboseDir = join(homeDir, '.vrrbose');
  const dbPath = join(vrrboseDir, 'capture-gate.db');
  const terminalLogPath = join(vrrboseDir, 'terminal.log');
  const aiPromptLogPath = join(vrrboseDir, 'ai-prompts.log');

  mkdirSync(vrrboseDir, { recursive: true });
  writeFileSync(terminalLogPath, '', 'utf8');
  writeFileSync(aiPromptLogPath, '', 'utf8');

  process.env['HOME'] = homeDir;
  process.env['USERPROFILE'] = homeDir;

  const db = getDb(dbPath);
  const projectId = randomUUID();

  insertProject(db, {
    id: projectId,
    name: 'capture-gate-project',
    type: 'other',
    stack: ['node'],
    description: 'capture gate checks',
    rootPath: process.cwd(),
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  });

  const capturedEvents: Event[] = [];

  const testWatcher = new TestRunWatcher({
    db,
    projectId,
    onActivity: () => {},
    onEvent: (event) => capturedEvents.push(event),
  });

  const terminalWatcher = new TerminalWatcher({
    db,
    projectId,
    logPath: terminalLogPath,
    pollIntervalMs: 100,
    logMode: 'filtered',
    filterTrivial: true,
    onActivity: () => {},
    onEvent: (event) => {
      capturedEvents.push(event);
      if (event.type === 'terminal_command') {
        const command = event.payload['command'];
        if (typeof command === 'string') {
          testWatcher.handleTerminalCommand(command, event.timestamp);
        }
      }
    },
  });

  const aiPromptWatcher = new AiPromptWatcher({
    db,
    projectId,
    logPath: aiPromptLogPath,
    pollIntervalMs: 100,
    onActivity: () => {},
    onEvent: (event) => capturedEvents.push(event),
  });

  terminalWatcher.start();
  aiPromptWatcher.start();

  const startedAt = Date.now();
  appendFileSync(terminalLogPath, 'pnpm test\n', 'utf8');
  appendFileSync(terminalLogPath, 'ls\n', 'utf8');
  appendFileSync(terminalLogPath, 'export OPENAI_API_KEY=super-secret-value\n', 'utf8');
  appendFileSync(aiPromptLogPath, JSON.stringify({ prompt: 'Refactor auth middleware', toolCalls: ['read_file'] }) + '\n', 'utf8');
  appendFileSync(aiPromptLogPath, JSON.stringify({ prompt: 'token=my-raw-secret-token' }) + '\n', 'utf8');

  await waitUntil(
    () => {
      const events = getEvents(db, projectId, { limit: 200 });
      const types = new Set(events.map((e) => e.type));
      return types.has('terminal_command') && types.has('test_run') && types.has('ai_prompt');
    },
    10_000,
    'terminal/test/ai prompt captures'
  );

  await waitUntil(
    () => getEvents(db, projectId, { limit: 500 }).some((e) => e.type === 'ai_prompt' && String(e.payload['prompt'] ?? '').includes('<redacted>')),
    10_000,
    'sensitive prompt redaction'
  );

  const burstStart = Date.now();
  const burstCount = 120;
  for (let i = 0; i < burstCount; i += 1) {
    appendFileSync(terminalLogPath, `pnpm lint --filter burst-${i}\n`, 'utf8');
  }

  await waitUntil(
    () => {
      const terminalEvents = getEvents(db, projectId, { type: 'terminal_command', limit: 1000 });
      return terminalEvents.length >= burstCount + 1;
    },
    10_000,
    'high-volume terminal burst capture'
  );

  // Add representative staged diff and capsule trigger events to validate schema coverage.
  insertEvent(db, {
    id: randomUUID(),
    projectId,
    sessionId: null,
    type: 'git_staged_diff',
    timestamp: Date.now(),
    payload: {
      files: ['src/index.ts'],
      fileStats: [{ file: 'src/index.ts', insertions: 3, deletions: 1 }],
      insertions: 3,
      deletions: 1,
      mode: 'metadata_only',
    },
    syncStatus: 'pending',
    createdAt: Date.now(),
  });

  insertEvent(db, {
    id: randomUUID(),
    projectId,
    sessionId: null,
    type: 'capsule_create',
    timestamp: Date.now(),
    payload: {
      trigger: 'merge',
      title: 'Merge capsule',
    },
    syncStatus: 'pending',
    createdAt: Date.now(),
  });

  const events = getEvents(db, projectId, { limit: 500 });

  const requiredTypes: Event['type'][] = [
    'terminal_command',
    'test_run',
    'ai_prompt',
    'git_staged_diff',
    'capsule_create',
  ];

  for (const type of requiredTypes) {
    assert(events.some((e) => e.type === type), `Missing expected event type: ${type}`);
  }

  for (const event of events) {
    EventSchema.parse(event);
  }

  const latencyCandidates = events.filter((e) => e.type === 'terminal_command' || e.type === 'test_run' || e.type === 'ai_prompt');
  const slowestLatencyMs = Math.max(...latencyCandidates.map((e) => e.createdAt - startedAt));
  assert(slowestLatencyMs <= 2_000, `Capture write latency too high: ${slowestLatencyMs}ms`);

  const terminalCommands = events
    .filter((e) => e.type === 'terminal_command')
    .map((e) => String(e.payload['command'] ?? ''));
  assert(!terminalCommands.includes('ls'), 'Trivial command should be excluded when filtered mode is enabled');
  assert(!terminalCommands.some((c) => c.includes('OPENAI_API_KEY=super-secret-value')), 'Sensitive terminal command should not be captured');

  const aiPrompts = events
    .filter((e) => e.type === 'ai_prompt')
    .map((e) => String(e.payload['prompt'] ?? ''));
  assert(!aiPrompts.some((p) => p.includes('my-raw-secret-token')), 'Sensitive prompt content should be redacted');

  const burstTerminalEvents = events.filter((e) => e.type === 'terminal_command' && String(e.payload['command'] ?? '').startsWith('pnpm lint --filter burst-'));
  assert(burstTerminalEvents.length === burstCount, `Expected ${burstCount} burst terminal events, got ${burstTerminalEvents.length}`);
  const lastBurstCreatedAt = Math.max(...burstTerminalEvents.map((e) => e.createdAt));
  const burstLatencyMs = lastBurstCreatedAt - burstStart;
  assert(burstLatencyMs <= 8_000, `Burst capture latency too high: ${burstLatencyMs}ms`);

  console.log('capture-gate: PASS schema validation');
  console.log(`capture-gate: PASS write latency (${slowestLatencyMs}ms <= 2000ms)`);
  console.log('capture-gate: PASS ignore/sensitive exclusions');
  console.log(`capture-gate: PASS burst behavior (${burstCount} events in ${burstLatencyMs}ms)`);

  terminalWatcher.stop();
  aiPromptWatcher.stop();
  closeDb();
}

main().catch((err) => {
  console.error('capture-gate: FAIL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
