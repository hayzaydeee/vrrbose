import { Router } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type Database from 'better-sqlite3';
import { DAEMON_VERSION } from '@vrrbose/shared';
import { getEventCount, getSessionCount, getPendingSyncEvents, getPendingSyncSessions } from '../../db/client.js';
import type { WatcherPool } from '../../watcher-pool.js';

function hasToken(): boolean {
  const envPath = join(homedir(), '.vrrbose', '.env');
  if (!existsSync(envPath)) return false;
  return /^VRRBOSE_TOKEN=.+$/m.test(readFileSync(envPath, 'utf8'));
}

export function statusRouter(
  db: Database.Database,
  pool: WatcherPool,
  startTime: number,
): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const statuses = pool.getStatuses().map(s => ({
      ...s,
      eventCount: getEventCount(db, s.projectId),
      sessionCount: getSessionCount(db, s.projectId),
    }));

    // Backward-compat: surface first project's fields at the top level
    const first = statuses[0];

    res.json({
      ok: true,
      data: {
        daemon: 'running',
        version: DAEMON_VERSION,
        uptime: Date.now() - startTime,
        projects: statuses,
        sync: {
          loggedIn: hasToken(),
          pendingEvents: getPendingSyncEvents(db, 5000).length,
          pendingSessions: getPendingSyncSessions(db, 5000).length,
        },
        // Backward-compat fields
        activeSession: first?.activeSession ?? null,
        projectId: first?.projectId ?? '',
        eventCount: first?.eventCount ?? 0,
        sessionCount: first?.sessionCount ?? 0,
      },
    });
  });

  return router;
}
