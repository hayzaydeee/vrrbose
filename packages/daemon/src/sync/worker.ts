import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createHash } from 'node:crypto';
import type Database from 'better-sqlite3';
import {
  getPendingSyncEvents,
  markEventsSynced,
  getPendingSyncSessions,
  markSessionsSynced,
  getSyncState,
  setSyncState,
} from '../db/client.js';
import { loadSyncWorkerConfig } from '../config/sync.js';

const ENV_PATH   = join(homedir(), '.vrrbose', '.env');
const SYNC_CONFIG = loadSyncWorkerConfig();

type SyncState = {
  consecutiveFailures: number;
  nextRetryAt: number;
  circuitOpenUntil: number;
  authInvalid: number;
};

const SYNC_STATE_KEYS = {
  consecutiveFailures: 'sync.consecutive_failures',
  nextRetryAt: 'sync.next_retry_at',
  circuitOpenUntil: 'sync.circuit_open_until',
  authInvalid: 'sync.auth_invalid',
  totalSuccessfulFlushes: 'sync.total_successful_flushes',
  totalFailedFlushes: 'sync.total_failed_flushes',
  lastSuccessAt: 'sync.last_success_at',
  lastErrorMessage: 'sync.last_error_message',
  lastTokenHash: 'sync.last_token_hash',
} as const;

class SyncHttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function readToken(): string | null {
  if (!existsSync(ENV_PATH)) return null;
  const content = readFileSync(ENV_PATH, 'utf8');
  const match = content.match(/^VRRBOSE_TOKEN=(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

function tokenHash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function logSync(level: 'info' | 'warn' | 'error', message: string, meta: Record<string, unknown> = {}): void {
  const payload = {
    component: 'sync',
    level,
    message,
    time: Date.now(),
    ...meta,
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

function parseStateNumber(value: string | null): number {
  if (!value) return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadSyncState(db: Database.Database): SyncState {
  return {
    consecutiveFailures: parseStateNumber(getSyncState(db, SYNC_STATE_KEYS.consecutiveFailures)),
    nextRetryAt: parseStateNumber(getSyncState(db, SYNC_STATE_KEYS.nextRetryAt)),
    circuitOpenUntil: parseStateNumber(getSyncState(db, SYNC_STATE_KEYS.circuitOpenUntil)),
    authInvalid: parseStateNumber(getSyncState(db, SYNC_STATE_KEYS.authInvalid)),
  };
}

function persistSyncState(db: Database.Database, state: SyncState): void {
  setSyncState(db, SYNC_STATE_KEYS.consecutiveFailures, String(state.consecutiveFailures));
  setSyncState(db, SYNC_STATE_KEYS.nextRetryAt, String(state.nextRetryAt));
  setSyncState(db, SYNC_STATE_KEYS.circuitOpenUntil, String(state.circuitOpenUntil));
  setSyncState(db, SYNC_STATE_KEYS.authInvalid, String(state.authInvalid));
}

function getBackoffDelayMs(failureCount: number): number {
  const exponent = Math.max(0, failureCount - 1);
  const baseDelay = Math.min(SYNC_CONFIG.maxBackoffMs, SYNC_CONFIG.baseIntervalMs * (2 ** exponent));
  // Jitter avoids synchronized retries when many daemons fail at once.
  const jitterMultiplier = 0.85 + (Math.random() * 0.3);
  return Math.max(SYNC_CONFIG.baseIntervalMs, Math.floor(baseDelay * jitterMultiplier));
}

function incrementStateCounter(db: Database.Database, key: string): void {
  const current = parseStateNumber(getSyncState(db, key));
  setSyncState(db, key, String(current + 1));
}

async function flushEvents(db: Database.Database, token: string): Promise<void> {
  const events = getPendingSyncEvents(db, SYNC_CONFIG.batchSize);
  if (events.length === 0) return;

  const res = await fetch(`${SYNC_CONFIG.apiUrl}/sync/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ events }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new SyncHttpError(`events sync failed ${res.status}: ${body}`, res.status);
  }

  markEventsSynced(db, events.map(e => e.id));
  logSync('info', 'events flushed', { count: events.length });
}

async function flushSessions(db: Database.Database, token: string): Promise<void> {
  const sessions = getPendingSyncSessions(db, SYNC_CONFIG.batchSize);
  if (sessions.length === 0) return;

  const res = await fetch(`${SYNC_CONFIG.apiUrl}/sync/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ sessions }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new SyncHttpError(`sessions sync failed ${res.status}: ${body}`, res.status);
  }

  markSessionsSynced(db, sessions.map(s => s.id));
  logSync('info', 'sessions flushed', { count: sessions.length });
}

async function tick(db: Database.Database): Promise<void> {
  const now = Date.now();
  const state = loadSyncState(db);

  if (now < state.circuitOpenUntil) {
    return;
  }

  if (now < state.nextRetryAt) {
    return;
  }

  const token = readToken();
  if (!token) {
    if (state.authInvalid === 1) {
      state.authInvalid = 0;
      persistSyncState(db, state);
    }
    return; // not logged in — silently skip
  }

  const currentTokenHash = tokenHash(token);
  const lastTokenHash = getSyncState(db, SYNC_STATE_KEYS.lastTokenHash);
  if (lastTokenHash !== currentTokenHash) {
    state.authInvalid = 0;
    state.consecutiveFailures = 0;
    state.nextRetryAt = 0;
    state.circuitOpenUntil = 0;
    setSyncState(db, SYNC_STATE_KEYS.lastTokenHash, currentTokenHash);
    persistSyncState(db, state);
    logSync('info', 'token changed; sync retry state reset');
  }

  try {
    await flushEvents(db, token);
    await flushSessions(db, token);

    incrementStateCounter(db, SYNC_STATE_KEYS.totalSuccessfulFlushes);
    setSyncState(db, SYNC_STATE_KEYS.lastSuccessAt, String(Date.now()));
    setSyncState(db, SYNC_STATE_KEYS.lastErrorMessage, '');

    if (state.consecutiveFailures > 0 || state.nextRetryAt !== 0 || state.circuitOpenUntil !== 0) {
      state.consecutiveFailures = 0;
      state.nextRetryAt = 0;
      state.circuitOpenUntil = 0;
      state.authInvalid = 0;
      persistSyncState(db, state);
      logSync('info', 'recovered; retry state reset');
    }
  } catch (err) {
    incrementStateCounter(db, SYNC_STATE_KEYS.totalFailedFlushes);
    setSyncState(db, SYNC_STATE_KEYS.lastErrorMessage, (err as Error).message);

    const isAuthError = err instanceof SyncHttpError && (err.status === 401 || err.status === 403);
    state.consecutiveFailures += 1;

    if (isAuthError) {
      state.authInvalid = 1;
      state.circuitOpenUntil = Date.now() + SYNC_CONFIG.circuitOpenMs;
      state.nextRetryAt = state.circuitOpenUntil;
      persistSyncState(db, state);
      logSync('warn', 'authentication failed; re-run vrrbose login to refresh token', {
        status: (err as SyncHttpError).status,
      });
      return;
    }

    state.authInvalid = 0;

    const retryDelay = getBackoffDelayMs(state.consecutiveFailures);
    state.nextRetryAt = Date.now() + retryDelay;

    if (state.consecutiveFailures >= SYNC_CONFIG.failureThreshold) {
      state.circuitOpenUntil = Date.now() + SYNC_CONFIG.circuitOpenMs;
      state.nextRetryAt = state.circuitOpenUntil;
      logSync('warn', 'circuit opened after repeated failures', {
        circuitOpenMs: SYNC_CONFIG.circuitOpenMs,
        consecutiveFailures: state.consecutiveFailures,
      });
    }

    persistSyncState(db, state);
    logSync('warn', 'flush failed', {
      attempt: state.consecutiveFailures,
      nextRetryInMs: Math.max(0, state.nextRetryAt - Date.now()),
      error: (err as Error).message,
    });
  }
}

export function startSyncWorker(db: Database.Database): () => void {
  let timer: NodeJS.Timeout | null = null;
  let stopped = false;

  const scheduleNext = () => {
    if (stopped) return;
    timer = setTimeout(() => {
      tick(db)
        .catch(() => {})
        .finally(scheduleNext);
    }, SYNC_CONFIG.baseIntervalMs);
  };

  // Run immediately on start, then use fixed cadence with retry gating inside tick.
  tick(db)
    .catch(() => {})
    .finally(scheduleNext);

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
