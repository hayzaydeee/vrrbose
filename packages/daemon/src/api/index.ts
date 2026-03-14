import express, { type Express } from 'express';
import cors from 'cors';
import { createServer, type Server as HttpServer } from 'node:http';
import type Database from 'better-sqlite3';
import type { Session, Event } from '@vrrbose/shared';
import { DAEMON_PORT } from '@vrrbose/shared';
import { sessionsRouter } from './routes/sessions.js';
import { eventsRouter } from './routes/events.js';
import { statusRouter } from './routes/status.js';
import { agentRouter } from './routes/agent.js';
import { createSocketServer, broadcastEvent } from './socket.js';
import type { Server as SocketServer } from 'socket.io';

export interface AppOptions {
  db: Database.Database;
  projectId: string;
  startTime: number;
  getActiveSession: () => Session | null;
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

  app.use('/api/status', statusRouter(opts.db, opts.projectId, opts.startTime, opts.getActiveSession));
  app.use('/api/sessions', sessionsRouter(opts.db, opts.projectId));
  app.use('/api/events', eventsRouter(opts.db, opts.projectId));
  app.use('/api/agent', agentRouter(opts.db, opts.projectId));

  // Health check
  app.get('/health', (_req, res) => res.json({ ok: true }));

  return {
    app,
    httpServer,
    io,
    broadcast: (event: import('@vrrbose/shared').Event) => broadcastEvent(io, opts.projectId, event),
    listen: (port = opts.port ?? DAEMON_PORT) =>
      new Promise<void>((resolve) => httpServer.listen(port, '127.0.0.1', resolve)),
  };
}
