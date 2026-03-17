import { Router } from 'express';
import type Database from 'better-sqlite3';
import { getCapsules } from '../../db/client.js';

interface DecisionEntry {
  id: string;
  capsuleId: string;
  createdAt: number;
  title: string;
  summary: string;
  trigger: 'manual' | 'merge' | 'tag' | 'weekly';
}

export function decisionsRouter(db: Database.Database, defaultProjectId: string): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const projectId = typeof req.query['projectId'] === 'string'
      ? req.query['projectId']
      : defaultProjectId;
    const limitRaw = typeof req.query['limit'] === 'string'
      ? Number.parseInt(req.query['limit'], 10)
      : 100;
    const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(limitRaw, 500)) : 100;

    const capsules = getCapsules(db, projectId, { limit });
    const entries = capsules.flatMap((capsule) => {
      if (!Array.isArray(capsule.decisions) || capsule.decisions.length === 0) return [];
      return capsule.decisions.map((decision, idx) => ({
        id: `${capsule.id}:${idx}`,
        capsuleId: capsule.id,
        createdAt: capsule.createdAt,
        title: decision,
        summary: capsule.summary,
        trigger: capsule.trigger,
      } satisfies DecisionEntry));
    });

    res.json({ ok: true, data: entries });
  });

  return router;
}
