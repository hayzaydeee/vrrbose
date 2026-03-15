import { Router } from 'express';
import type Database from 'better-sqlite3';
import { getEvents } from '../../db/client.js';

export function eventsRouter(db: Database.Database, projectId: string): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const limit = Math.min(parseInt(req.query['limit'] as string ?? '50', 10), 500);
    const offset = parseInt(req.query['offset'] as string ?? '0', 10);
    const sessionId = req.query['sessionId'] as string | undefined;
    const type = req.query['type'] as string | undefined;
    const effectiveProjectId = (req.query['projectId'] as string) || projectId;

    const events = getEvents(db, effectiveProjectId, {
      limit,
      offset,
      ...(sessionId !== undefined && { sessionId }),
      ...(type !== undefined && { type }),
    });
    res.json({ ok: true, data: events });
  });

  return router;
}
