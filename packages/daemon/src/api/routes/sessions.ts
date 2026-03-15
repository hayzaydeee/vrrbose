import { Router } from 'express';
import type Database from 'better-sqlite3';
import { getSessions, getAllSessions, getSession, getEvents } from '../../db/client.js';
import type { WatcherPool } from '../../watcher-pool.js';

export function sessionsRouter(db: Database.Database, pool: WatcherPool): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const limit = Math.min(parseInt(req.query['limit'] as string ?? '20', 10), 100);
    const offset = parseInt(req.query['offset'] as string ?? '0', 10);
    const projectId = req.query['projectId'] as string | undefined;

    const sessions = projectId
      ? getSessions(db, projectId, { limit, offset })
      : getAllSessions(db, { limit, offset });

    res.json({ ok: true, data: sessions });
  });

  router.get('/:id', (req, res) => {
    const session = getSession(db, req.params['id']!);
    if (!session) {
      res.status(404).json({ ok: false, error: 'Session not found' });
      return;
    }

    const events = getEvents(db, session.projectId, { sessionId: req.params['id'], limit: 500 });
    res.json({ ok: true, data: { session, events } });
  });

  return router;
}
