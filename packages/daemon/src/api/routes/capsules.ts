import { Router } from 'express';
import type Database from 'better-sqlite3';
import { getCapsules, getCapsule, getEvents } from '../../db/client.js';

export function capsulesRouter(db: Database.Database, defaultProjectId: string): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const projectId = (req.query['projectId'] as string) || defaultProjectId;
    if (!projectId) {
      res.status(400).json({ ok: false, error: 'projectId is required' });
      return;
    }

    const limit = Math.min(parseInt((req.query['limit'] as string) ?? '20', 10), 100);
    const offset = parseInt((req.query['offset'] as string) ?? '0', 10);
    const sessionId = req.query['sessionId'] as string | undefined;

    const capsules = getCapsules(db, projectId, {
      limit,
      offset,
      ...(sessionId && { sessionId }),
    });

    res.json({ ok: true, data: capsules });
  });

  router.get('/:id', (req, res) => {
    const capsule = getCapsule(db, req.params['id'] ?? '');
    if (!capsule) {
      res.status(404).json({ ok: false, error: 'Capsule not found' });
      return;
    }

    const supportingEvents = getEvents(db, capsule.projectId, {
      ...(capsule.sessionId ? { sessionId: capsule.sessionId } : {}),
      limit: 100,
    });

    res.json({ ok: true, data: { capsule, events: supportingEvents } });
  });

  return router;
}
