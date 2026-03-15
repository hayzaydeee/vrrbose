import { Router } from 'express';
import type Database from 'better-sqlite3';
import { getEventCount, getSessionCount } from '../../db/client.js';
import type { WatcherPool } from '../../watcher-pool.js';

export function projectsRouter(db: Database.Database, pool: WatcherPool): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    const statuses = pool.getStatuses().map(s => ({
      ...s,
      eventCount: getEventCount(db, s.projectId),
      sessionCount: getSessionCount(db, s.projectId),
    }));
    res.json({ ok: true, data: statuses });
  });

  router.post('/register', (req, res) => {
    const { path: projectPath } = req.body as { path?: string };
    if (!projectPath || typeof projectPath !== 'string') {
      res.status(400).json({ ok: false, error: 'path is required' });
      return;
    }
    const result = pool.addProject(projectPath);
    res.json({ ok: true, data: { ...result, projectPath } });
  });

  router.delete('/unregister', (req, res) => {
    const { path: projectPath } = req.body as { path?: string };
    if (!projectPath || typeof projectPath !== 'string') {
      res.status(400).json({ ok: false, error: 'path is required' });
      return;
    }
    const removed = pool.removeProject(projectPath);
    res.json({ ok: true, data: { removed, projectPath } });
  });

  return router;
}
