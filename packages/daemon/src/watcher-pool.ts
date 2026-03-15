import { v4 as uuidv4 } from 'uuid';
import { basename } from 'node:path';
import type Database from 'better-sqlite3';
import type { Event, Session, Project } from '@vrrbose/shared';
import { SessionManager } from './session/manager.js';
import { GitWatcher } from './watchers/git.js';
import { FsWatcher } from './watchers/fs.js';
import { injectContext } from './agent/context-injector.js';
import { insertProject, getProject } from './db/client.js';

interface ProjectEntry {
  project: Project;
  sessionManager: SessionManager;
  gitWatcher: GitWatcher;
  fsWatcher: FsWatcher;
}

export interface ProjectStatus {
  projectId: string;
  projectPath: string;
  projectName: string;
  activeSession: Session | null;
}

export class WatcherPool {
  private entries = new Map<string, ProjectEntry>(); // projectPath → entry

  constructor(
    private db: Database.Database,
    private onBroadcast: (event: Event) => void,
  ) {}

  addProject(projectPath: string): { projectId: string; projectName: string; created: boolean } {
    if (this.entries.has(projectPath)) {
      const existing = this.entries.get(projectPath)!;
      return { projectId: existing.project.id, projectName: existing.project.name, created: false };
    }

    // Get or create project record (getProject queries by root_path)
    let project = getProject(this.db, projectPath);
    let created = false;
    if (!project) {
      const name = basename(projectPath) || 'unnamed';
      project = {
        id: uuidv4(),
        name,
        type: 'other',
        stack: [],
        description: '',
        rootPath: projectPath,
        createdAt: Date.now(),
        lastActiveAt: Date.now(),
      };
      insertProject(this.db, project);
      created = true;
      console.log(`[pool] registered project: ${project.id} (${name})`);
    }

    const db = this.db;
    const projectId = project.id;
    const broadcast = this.onBroadcast;

    const sessionManager = new SessionManager(db, projectId, {
      onSessionClose: () => {
        injectContext(db, projectId, projectPath, { claudeCode: true }).catch(err =>
          console.error('[inject] context injection failed:', err)
        );
      },
    });
    sessionManager.start();

    const onEvent = (event: Event) => {
      const sessionId = sessionManager.getCurrentSessionId();
      if (sessionId) {
        db.prepare('UPDATE events SET session_id = ? WHERE id = ?').run(sessionId, event.id);
      }
      broadcast({ ...event, sessionId });
    };

    const gitWatcher = new GitWatcher({
      db,
      projectId,
      projectPath,
      onActivity: () => {
        sessionManager.recordActivity();
        sessionManager.updateSessionMetrics({ commitCount: 1 });
      },
      onEvent,
    });

    const fsWatcher = new FsWatcher({
      db,
      projectId,
      projectPath,
      onActivity: () => sessionManager.recordActivity(),
      onEvent,
    });

    gitWatcher.start();
    fsWatcher.start();

    this.entries.set(projectPath, { project, sessionManager, gitWatcher, fsWatcher });
    console.log(`[pool] watching ${projectPath} (${projectId.slice(0, 8)})`);
    return { projectId, projectName: project.name, created };
  }

  removeProject(projectPath: string): boolean {
    const entry = this.entries.get(projectPath);
    if (!entry) return false;
    entry.gitWatcher.stop();
    entry.fsWatcher.stop();
    entry.sessionManager.stop();
    this.entries.delete(projectPath);
    console.log(`[pool] stopped watching ${projectPath}`);
    return true;
  }

  getStatuses(): ProjectStatus[] {
    return Array.from(this.entries.entries()).map(([path, e]) => ({
      projectId: e.project.id,
      projectPath: path,
      projectName: e.project.name,
      activeSession: e.sessionManager.getActiveSession(),
    }));
  }

  /** Returns the active session for a given projectId (not path). */
  getActiveSessionForProject(projectId: string): Session | null {
    for (const entry of this.entries.values()) {
      if (entry.project.id === projectId) {
        return entry.sessionManager.getActiveSession();
      }
    }
    return null;
  }

  /** Returns the projectId for a given path, or null if not watched. */
  getProjectIdForPath(projectPath: string): string | null {
    return this.entries.get(projectPath)?.project.id ?? null;
  }

  stopAll(): void {
    for (const path of Array.from(this.entries.keys())) {
      this.removeProject(path);
    }
  }
}
