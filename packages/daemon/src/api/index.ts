import express, { type Express } from 'express';
import cors from 'cors';
import { createServer, type Server as HttpServer } from 'node:http';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type Database from 'better-sqlite3';
import type { Event } from '@vrrbose/shared';
import { DAEMON_PORT } from '@vrrbose/shared';
import { sessionsRouter } from './routes/sessions.js';
import { eventsRouter } from './routes/events.js';
import { statusRouter } from './routes/status.js';
import { agentRouter } from './routes/agent.js';
import { projectsRouter } from './routes/projects.js';
import { capsulesRouter } from './routes/capsules.js';
import { documentsRouter } from './routes/documents.js';
import { destinationsRouter } from './routes/destinations.js';
import { readmeRouter } from './routes/readme.js';
import { decisionsRouter } from './routes/decisions.js';
import { createSocketServer, broadcastEvent } from './socket.js';
import type { Server as SocketServer } from 'socket.io';
import type { WatcherPool } from '../watcher-pool.js';

export interface AppOptions {
  db: Database.Database;
  pool: WatcherPool;
  /** Default projectId used by agent route when no ?projectId= given */
  defaultProjectId: string;
  startTime: number;
  port?: number;
}

export interface AppInstance {
  app: Express;
  httpServer: HttpServer;
  io: SocketServer;
  broadcast: (event: Event) => void;
  listen: (port?: number) => Promise<void>;
}

export function createApp(opts: AppOptions): AppInstance {
  const app = express();
  const httpServer = createServer(app);
  const io = createSocketServer(httpServer);

  app.use(cors({ origin: true }));
  app.use(express.json());

  app.use('/api/status', statusRouter(opts.db, opts.pool, opts.startTime));
  app.use('/api/sessions', sessionsRouter(opts.db, opts.pool));
  app.use('/api/events', eventsRouter(opts.db, opts.defaultProjectId));
  app.use('/api/agent', agentRouter(opts.db, opts.defaultProjectId));
  app.use('/api/projects', projectsRouter(opts.db, opts.pool));
  app.use('/api/capsules', capsulesRouter(opts.db, opts.defaultProjectId));
  app.use('/api/documents', documentsRouter());
  app.use('/api/destinations', destinationsRouter(opts.db));
  app.use('/api/readme', readmeRouter(opts.db, opts.defaultProjectId));
  app.use('/api/decisions', decisionsRouter(opts.db, opts.defaultProjectId));

  // Health check
  app.get('/health', (_req, res) => res.json({ ok: true }));

  // Serve bundled web UI at /ui
  const uiDir = join(dirname(fileURLToPath(import.meta.url)), 'ui');
  if (existsSync(uiDir)) {
    app.use('/ui', express.static(uiDir));
    app.get('/ui/*', (_req, res) => res.sendFile(join(uiDir, 'index.html')));
  }

  return {
    app,
    httpServer,
    io,
    broadcast: (event: Event) => broadcastEvent(io, event.projectId, event),
    listen: (port = opts.port ?? DAEMON_PORT) =>
      new Promise<void>((resolve) => httpServer.listen(port, '127.0.0.1', resolve)),
  };
}
