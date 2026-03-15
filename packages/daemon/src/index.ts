import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { getDb, closeDb, getAllProjects } from './db/client.js';
import { WatcherPool } from './watcher-pool.js';
import { createApp } from './api/index.js';
import { McpServer } from './mcp/server.js';
import { startSyncWorker } from './sync/worker.js';
import { DAEMON_PORT } from '@vrrbose/shared';

const INITIAL_PROJECT_PATH = process.env['VRRBOSE_PROJECT_PATH'];
const DB_DIR = join(homedir(), '.vrrbose');
const DB_PATH = join(DB_DIR, 'vrrbose.db');
const PORT = parseInt(process.env['VRRBOSE_PORT'] ?? String(DAEMON_PORT), 10);

async function main() {
  // Ensure ~/.vrrbose exists
  mkdirSync(DB_DIR, { recursive: true });

  const db = getDb(DB_PATH);

  // Express + Socket.io (pool needs broadcast, app needs pool — wire lazily)
  let broadcastFn: ((event: import('@vrrbose/shared').Event) => void) | null = null;

  const pool = new WatcherPool(db, (event) => broadcastFn?.(event));

  // Restore all previously registered projects from DB
  const knownProjects = getAllProjects(db);
  for (const p of knownProjects) {
    pool.addProject(p.rootPath);
  }

  // If started with a specific project path not already in DB, register it
  if (INITIAL_PROJECT_PATH && !knownProjects.some(p => p.rootPath === INITIAL_PROJECT_PATH)) {
    pool.addProject(INITIAL_PROJECT_PATH);
  }

  const defaultProjectId = INITIAL_PROJECT_PATH
    ? (pool.getProjectIdForPath(INITIAL_PROJECT_PATH) ?? '')
    : '';

  // Optional MCP server
  let mcpServer: McpServer | null = null;
  if (process.env['VRRBOSE_MCP'] === '1') {
    mcpServer = new McpServer(db, defaultProjectId);
    mcpServer.start();
  }

  const app = createApp({
    db,
    pool,
    defaultProjectId,
    startTime: Date.now(),
    port: PORT,
  });

  broadcastFn = app.broadcast;

  const stopSync = startSyncWorker(db);

  await app.listen(PORT);
  console.log(`[daemon] listening on http://localhost:${PORT}`);

  // Graceful shutdown
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  function shutdown() {
    console.log('\n[daemon] shutting down...');
    stopSync();
    pool.stopAll();
    mcpServer?.stop();
    closeDb();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[daemon] fatal:', err);
  process.exit(2);
});
