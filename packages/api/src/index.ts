import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import { verifyToken } from '@clerk/backend';
import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const PORT = process.env['PORT'] ? parseInt(process.env['PORT']) : 3001;
const ALLOWED_ORIGIN = process.env['APP_ORIGIN'] ?? 'https://vrrbose.dev';
const CLERK_SECRET_KEY = process.env['CLERK_SECRET_KEY'] ?? '';
const DATA_DIR = process.env['DATA_DIR'] ?? '/data';

// ---------------------------------------------------------------------------
// DB setup
// ---------------------------------------------------------------------------
mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(join(DATA_DIR, 'vrrbose-cloud.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.exec(`
  CREATE TABLE IF NOT EXISTS events (
    id          TEXT NOT NULL,
    user_id     TEXT NOT NULL,
    project_id  TEXT NOT NULL,
    session_id  TEXT,
    type        TEXT NOT NULL,
    timestamp   INTEGER NOT NULL,
    payload     TEXT NOT NULL DEFAULT '{}',
    created_at  INTEGER NOT NULL,
    PRIMARY KEY (id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_cloud_events_user   ON events(user_id);
  CREATE INDEX IF NOT EXISTS idx_cloud_events_ts     ON events(user_id, timestamp);
  CREATE INDEX IF NOT EXISTS idx_cloud_events_proj   ON events(user_id, project_id);

  CREATE TABLE IF NOT EXISTS sessions (
    id              TEXT NOT NULL,
    user_id         TEXT NOT NULL,
    project_id      TEXT NOT NULL,
    started_at      INTEGER NOT NULL,
    ended_at        INTEGER,
    score           REAL,
    commit_count    INTEGER NOT NULL DEFAULT 0,
    file_churn      INTEGER NOT NULL DEFAULT 0,
    active_time_ms  INTEGER NOT NULL DEFAULT 0,
    summary         TEXT,
    PRIMARY KEY (id, user_id)
  );
  CREATE INDEX IF NOT EXISTS idx_cloud_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_cloud_sessions_ts   ON sessions(user_id, started_at);
`);

// ---------------------------------------------------------------------------
// Device grant store
// ---------------------------------------------------------------------------
interface DeviceGrant { token: string; userId: string; expiresAt: number; }
const deviceGrants = new Map<string, DeviceGrant>();
setInterval(() => {
  const now = Date.now();
  for (const [id, g] of deviceGrants) if (g.expiresAt < now) deviceGrants.delete(id);
}, 60_000);

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------
interface AuthRequest extends Request { userId?: string; }

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers['authorization'];
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }
  const token = header.slice(7);
  try {
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
app.use(cors({
  origin: [ALLOWED_ORIGIN, 'http://localhost:3000'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json({ limit: '10mb' }));

// Health
app.get('/health', (_req, res) => res.json({ ok: true }));

// ---------------------------------------------------------------------------
// Auth: device flow
// ---------------------------------------------------------------------------
app.post('/auth/device', async (req, res) => {
  const { device_id, token } = req.body as { device_id?: string; token?: string };
  if (!device_id || !token) { res.status(400).json({ error: 'device_id and token are required' }); return; }

  let userId: string;
  try {
    const payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
    userId = payload.sub;
  } catch {
    res.status(401).json({ error: 'Invalid token' }); return;
  }

  deviceGrants.set(device_id, { token, userId, expiresAt: Date.now() + 10 * 60 * 1000 });
  res.json({ ok: true });
});

app.get('/auth/device', (req, res) => {
  const device_id = req.query['device_id'] as string | undefined;
  if (!device_id) { res.status(400).json({ error: 'device_id is required' }); return; }

  const grant = deviceGrants.get(device_id);
  if (!grant) { res.status(404).json({ pending: true }); return; }
  if (grant.expiresAt < Date.now()) { deviceGrants.delete(device_id); res.status(410).json({ error: 'Grant expired' }); return; }

  deviceGrants.delete(device_id);
  res.json({ token: grant.token, user_id: grant.userId });
});

// ---------------------------------------------------------------------------
// Sync: events
// ---------------------------------------------------------------------------
const insertEvent = db.prepare(`
  INSERT OR REPLACE INTO events
    (id, user_id, project_id, session_id, type, timestamp, payload, created_at)
  VALUES
    (@id, @userId, @projectId, @sessionId, @type, @timestamp, @payload, @createdAt)
`);

app.post('/sync/events', requireAuth as express.RequestHandler, (req: AuthRequest, res) => {
  const { events } = req.body as { events?: unknown[] };
  if (!Array.isArray(events) || events.length === 0) { res.status(400).json({ error: 'events array required' }); return; }

  const upsert = db.transaction((rows: unknown[]) => {
    for (const e of rows) {
      const ev = e as Record<string, unknown>;
      insertEvent.run({
        id: ev['id'],
        userId: req.userId,
        projectId: ev['projectId'],
        sessionId: ev['sessionId'] ?? null,
        type: ev['type'],
        timestamp: ev['timestamp'],
        payload: typeof ev['payload'] === 'string' ? ev['payload'] : JSON.stringify(ev['payload'] ?? {}),
        createdAt: ev['createdAt'] ?? Date.now(),
      });
    }
  });

  upsert(events);
  res.json({ ok: true, synced: events.length });
});

app.get('/sync/events', requireAuth as express.RequestHandler, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query['limit'] as string ?? '100', 10), 500);
  const offset = parseInt(req.query['offset'] as string ?? '0', 10);
  const projectId = req.query['projectId'] as string | undefined;

  let query = 'SELECT * FROM events WHERE user_id = @userId';
  const params: Record<string, unknown> = { userId: req.userId };

  if (projectId) { query += ' AND project_id = @projectId'; params['projectId'] = projectId; }
  query += ' ORDER BY timestamp DESC LIMIT @limit OFFSET @offset';

  const rows = db.prepare(query).all({ ...params, limit, offset });
  res.json({ ok: true, data: rows });
});

// ---------------------------------------------------------------------------
// Sync: sessions
// ---------------------------------------------------------------------------
const insertSession = db.prepare(`
  INSERT OR REPLACE INTO sessions
    (id, user_id, project_id, started_at, ended_at, score,
     commit_count, file_churn, active_time_ms, summary)
  VALUES
    (@id, @userId, @projectId, @startedAt, @endedAt, @score,
     @commitCount, @fileChurn, @activeTimeMs, @summary)
`);

app.post('/sync/sessions', requireAuth as express.RequestHandler, (req: AuthRequest, res) => {
  const { sessions } = req.body as { sessions?: unknown[] };
  if (!Array.isArray(sessions) || sessions.length === 0) { res.status(400).json({ error: 'sessions array required' }); return; }

  const upsert = db.transaction((rows: unknown[]) => {
    for (const s of rows) {
      const sess = s as Record<string, unknown>;
      insertSession.run({
        id: sess['id'],
        userId: req.userId,
        projectId: sess['projectId'],
        startedAt: sess['startedAt'],
        endedAt: sess['endedAt'] ?? null,
        score: sess['score'] ?? null,
        commitCount: sess['commitCount'] ?? 0,
        fileChurn: sess['fileChurn'] ?? 0,
        activeTimeMs: sess['activeTimeMs'] ?? 0,
        summary: sess['summary'] ?? null,
      });
    }
  });

  upsert(sessions);
  res.json({ ok: true, synced: sessions.length });
});

app.get('/sync/sessions', requireAuth as express.RequestHandler, (req: AuthRequest, res) => {
  const limit = Math.min(parseInt(req.query['limit'] as string ?? '20', 10), 100);
  const offset = parseInt(req.query['offset'] as string ?? '0', 10);

  const rows = db.prepare(
    'SELECT * FROM sessions WHERE user_id = @userId ORDER BY started_at DESC LIMIT @limit OFFSET @offset'
  ).all({ userId: req.userId, limit, offset });

  res.json({ ok: true, data: rows });
});

app.listen(PORT, () => console.log(`vrrbose api listening on :${PORT}`));
