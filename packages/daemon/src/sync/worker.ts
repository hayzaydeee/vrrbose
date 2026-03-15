import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type Database from 'better-sqlite3';
import {
  getPendingSyncEvents,
  markEventsSynced,
  getPendingSyncSessions,
  markSessionsSynced,
} from '../db/client.js';

const ENV_PATH   = join(homedir(), '.vrrbose', '.env');
const API_URL    = process.env['VRRBOSE_API_URL'] ?? 'https://api.vrrbose.dev';
const INTERVAL   = 30_000; // 30 seconds
const BATCH_SIZE = 200;

function readToken(): string | null {
  if (!existsSync(ENV_PATH)) return null;
  const content = readFileSync(ENV_PATH, 'utf8');
  const match = content.match(/^VRRBOSE_TOKEN=(.+)$/m);
  return match?.[1]?.trim() ?? null;
}

async function flushEvents(db: Database.Database, token: string): Promise<void> {
  const events = getPendingSyncEvents(db, BATCH_SIZE);
  if (events.length === 0) return;

  const res = await fetch(`${API_URL}/sync/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ events }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`events sync failed ${res.status}: ${body}`);
  }

  markEventsSynced(db, events.map(e => e.id));
  console.log(`[sync] flushed ${events.length} events`);
}

async function flushSessions(db: Database.Database, token: string): Promise<void> {
  const sessions = getPendingSyncSessions(db, BATCH_SIZE);
  if (sessions.length === 0) return;

  const res = await fetch(`${API_URL}/sync/sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ sessions }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`sessions sync failed ${res.status}: ${body}`);
  }

  markSessionsSynced(db, sessions.map(s => s.id));
  console.log(`[sync] flushed ${sessions.length} sessions`);
}

async function tick(db: Database.Database): Promise<void> {
  const token = readToken();
  if (!token) return; // not logged in — silently skip

  try {
    await flushEvents(db, token);
    await flushSessions(db, token);
  } catch (err) {
    // Offline or API error — log and retry next tick
    console.warn('[sync] flush failed (will retry):', (err as Error).message);
  }
}

export function startSyncWorker(db: Database.Database): () => void {
  // Run immediately on start, then on interval
  tick(db).catch(() => {});
  const timer = setInterval(() => tick(db).catch(() => {}), INTERVAL);

  return () => clearInterval(timer);
}
