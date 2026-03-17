import { Router } from 'express';
import type Database from 'better-sqlite3';
import { getSyncState, setSyncState } from '../../db/client.js';

interface NotionDestinationConfig {
  enabled: boolean;
  workspaceName: string | null;
  databaseId: string | null;
  tokenMasked: string | null;
}

const KEYS = {
  enabled: 'dest.notion.enabled',
  workspaceName: 'dest.notion.workspace_name',
  databaseId: 'dest.notion.database_id',
  token: 'dest.notion.token',
} as const;

function readConfig(db: Database.Database): NotionDestinationConfig {
  const enabled = getSyncState(db, KEYS.enabled) === '1';
  const workspaceName = getSyncState(db, KEYS.workspaceName);
  const databaseId = getSyncState(db, KEYS.databaseId);
  const token = getSyncState(db, KEYS.token);

  return {
    enabled,
    workspaceName,
    databaseId,
    tokenMasked: token ? maskToken(token) : null,
  };
}

function maskToken(token: string): string {
  if (token.length <= 8) return '********';
  return `${token.slice(0, 4)}...${token.slice(-4)}`;
}

function validateNotionInput(databaseId: string | null, token: string | null): string | null {
  if (token && !token.startsWith('secret_')) {
    return 'Notion token should start with secret_';
  }

  if (databaseId && !/^[a-f0-9-]{32,36}$/i.test(databaseId)) {
    return 'Database ID must be a valid Notion database id';
  }

  return null;
}

export function destinationsRouter(db: Database.Database): Router {
  const router = Router();

  router.get('/notion', (_req, res) => {
    res.json({ ok: true, data: readConfig(db) });
  });

  router.post('/notion', (req, res) => {
    const body = req.body as {
      enabled?: boolean;
      workspaceName?: string;
      databaseId?: string;
      token?: string;
    };

    const current = readConfig(db);
    const enabled = body.enabled ?? current.enabled;
    const workspaceName = body.workspaceName?.trim() ?? current.workspaceName ?? null;
    const databaseId = body.databaseId?.trim() ?? current.databaseId ?? null;

    let token: string | null = null;
    const incomingToken = body.token?.trim();
    if (incomingToken && incomingToken.length > 0) {
      token = incomingToken;
    } else {
      token = getSyncState(db, KEYS.token);
    }

    const validationError = validateNotionInput(databaseId, token);
    if (validationError) {
      res.status(400).json({ ok: false, error: validationError });
      return;
    }

    setSyncState(db, KEYS.enabled, enabled ? '1' : '0');
    setSyncState(db, KEYS.workspaceName, workspaceName ?? '');
    setSyncState(db, KEYS.databaseId, databaseId ?? '');
    if (incomingToken && incomingToken.length > 0) {
      setSyncState(db, KEYS.token, incomingToken);
    }

    res.json({ ok: true, data: readConfig(db) });
  });

  router.post('/notion/test', (_req, res) => {
    const token = getSyncState(db, KEYS.token);
    const databaseId = getSyncState(db, KEYS.databaseId);
    const error = validateNotionInput(databaseId, token);

    if (!token || !databaseId) {
      res.status(400).json({ ok: false, error: 'Notion token and database id are required' });
      return;
    }

    if (error) {
      res.status(400).json({ ok: false, error });
      return;
    }

    res.json({ ok: true, data: { reachable: true, message: 'Notion destination configuration looks valid.' } });
  });

  return router;
}
