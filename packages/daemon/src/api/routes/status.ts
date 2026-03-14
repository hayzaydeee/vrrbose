import { Router } from 'express';
import type Database from 'better-sqlite3';
import type { Session } from '@vrrbose/shared';
import { DAEMON_VERSION } from '@vrrbose/shared';
import { getEventCount, getSessionCount } from '../../db/client.js';

export function statusRouter(
  db: Database.Database,
  projectId: string,
  startTime: number,
  getActiveSession: () => Session | null
): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({
      ok: true,
      data: {
        daemon: 'running',
        version: DAEMON_VERSION,
        uptime: Date.now() - startTime,
        activeSession: getActiveSession(),
        projectId,
        eventCount: getEventCount(db, projectId),
        sessionCount: getSessionCount(db, projectId),
      },
    });
  });

  return router;
}
