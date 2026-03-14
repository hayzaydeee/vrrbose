import { join } from 'node:path';
import { homedir } from 'node:os';
import { mkdirSync } from 'node:fs';
import { v4 as uuidv4 } from 'uuid';
import { getDb, closeDb, insertProject, getProject } from './db/client.js';
import { SessionManager } from './session/manager.js';
import { GitWatcher } from './watchers/git.js';
import { FsWatcher } from './watchers/fs.js';
import { createApp } from './api/index.js';
import { DAEMON_PORT } from '@vrrbose/shared';
import type { Event } from '@vrrbose/shared';

const PROJECT_PATH = process.env['VRRBOSE_PROJECT_PATH'] ?? process.cwd();
const DB_DIR = join(homedir(), '.vrrbose');
const DB_PATH = join(DB_DIR, 'vrrbose.db');
const PORT = parseInt(process.env['VRRBOSE_PORT'] ?? String(DAEMON_PORT), 10);

async function main() {
  // Ensure ~/.vrrbose exists
  mkdirSync(DB_DIR, { recursive: true });

  const db = getDb(DB_PATH);

  // Ensure project record exists
  let project = getProject(db, PROJECT_PATH);
  if (!project) {
    const name = PROJECT_PATH.split('/').pop() ?? 'unnamed';
    project = {
      id: uuidv4(),
      name,
      type: 'other',
      stack: [],
      description: '',
      rootPath: PROJECT_PATH,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    insertProject(db, project);
    console.log(`[daemon] registered project: ${project.id} (${name})`);
  }

  const projectId = project.id;

  // Session manager
  const sessionManager = new SessionManager(db, projectId);
  sessionManager.start();

  // Event handler — attach session ID to events as they arrive
  function onEvent(event: Event) {
    const sessionId = sessionManager.getCurrentSessionId();
    if (sessionId) {
      // Update the event record's session_id (event was already inserted in watcher)
      db.prepare('UPDATE events SET session_id = ? WHERE id = ?').run(sessionId, event.id);
    }
    app.broadcast({ ...event, sessionId });
  }

  // Git watcher
  const gitWatcher = new GitWatcher({
    db,
    projectId,
    projectPath: PROJECT_PATH,
    onActivity: () => {
      sessionManager.recordActivity();
      sessionManager.updateSessionMetrics({ commitCount: 1 });
    },
    onEvent,
  });

  // FS watcher
  const fsWatcher = new FsWatcher({
    db,
    projectId,
    projectPath: PROJECT_PATH,
    onActivity: () => sessionManager.recordActivity(),
    onEvent,
  });

  // Express + Socket.io
  const app = createApp({
    db,
    projectId,
    startTime: Date.now(),
    getActiveSession: () => sessionManager.getActiveSession(),
    port: PORT,
  });

  await app.listen(PORT);
  console.log(`[daemon] listening on http://localhost:${PORT}`);

  gitWatcher.start();
  fsWatcher.start();

  // Graceful shutdown
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  function shutdown() {
    console.log('\n[daemon] shutting down...');
    gitWatcher.stop();
    fsWatcher.stop();
    sessionManager.stop();
    closeDb();
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('[daemon] fatal:', err);
  process.exit(2);
});
