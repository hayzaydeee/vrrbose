import Database from 'better-sqlite3';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Event, Session, FileSummary, Capsule, Project } from '@vrrbose/shared';

const __dirname = dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

export function getDb(dbPath: string): Database.Database {
  if (db) return db;

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');

  // Look for schema.sql next to the current file (tsc build) or one level up (esbuild bundle)
  const schemaSibling = join(__dirname, 'schema.sql');
  const schemaParent = join(__dirname, '..', 'schema.sql');
  const schemaPath = existsSync(schemaSibling) ? schemaSibling : schemaParent;
  const schema = readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// --- Prepared statement helpers ---

export function insertEvent(db: Database.Database, event: Event): void {
  db.prepare(`
    INSERT OR IGNORE INTO events
      (id, project_id, session_id, type, timestamp, payload, sync_status, created_at)
    VALUES
      (@id, @projectId, @sessionId, @type, @timestamp, @payload, @syncStatus, @createdAt)
  `).run({
    ...event,
    payload: JSON.stringify(event.payload),
  });
}

export function getEvents(
  db: Database.Database,
  projectId: string,
  opts: { limit?: number; offset?: number; sessionId?: string; type?: string } = {}
): Event[] {
  const conditions = ['project_id = @projectId'];
  const params: Record<string, unknown> = { projectId };

  if (opts.sessionId) { conditions.push('session_id = @sessionId'); params['sessionId'] = opts.sessionId; }
  if (opts.type) { conditions.push('type = @type'); params['type'] = opts.type; }

  const limit = opts.limit ?? 100;
  const offset = opts.offset ?? 0;

  const rows = db.prepare(`
    SELECT * FROM events WHERE ${conditions.join(' AND ')}
    ORDER BY timestamp DESC LIMIT @limit OFFSET @offset
  `).all({ ...params, limit, offset }) as Record<string, unknown>[];

  return rows.map(row => ({
    id: row['id'] as string,
    projectId: row['project_id'] as string,
    sessionId: row['session_id'] as string | null,
    type: row['type'] as Event['type'],
    timestamp: row['timestamp'] as number,
    payload: JSON.parse(row['payload'] as string) as Record<string, unknown>,
    syncStatus: row['sync_status'] as Event['syncStatus'],
    createdAt: row['created_at'] as number,
  }));
}

export function insertSession(db: Database.Database, session: Session): void {
  db.prepare(`
    INSERT OR IGNORE INTO sessions
      (id, project_id, started_at, ended_at, idle_threshold_ms, score,
       commit_count, file_churn, active_time_ms, summary, sync_status)
    VALUES
      (@id, @projectId, @startedAt, @endedAt, @idleThresholdMs, @score,
       @commitCount, @fileChurn, @activeTimeMs, @summary, @syncStatus)
  `).run(session);
}

export function updateSession(db: Database.Database, session: Partial<Session> & { id: string }): void {
  const updates: string[] = [];
  const params: Record<string, unknown> = { id: session.id };

  if (session.endedAt !== undefined) { updates.push('ended_at = @endedAt'); params['endedAt'] = session.endedAt; }
  if (session.score !== undefined) { updates.push('score = @score'); params['score'] = session.score; }
  if (session.commitCount !== undefined) { updates.push('commit_count = @commitCount'); params['commitCount'] = session.commitCount; }
  if (session.fileChurn !== undefined) { updates.push('file_churn = @fileChurn'); params['fileChurn'] = session.fileChurn; }
  if (session.activeTimeMs !== undefined) { updates.push('active_time_ms = @activeTimeMs'); params['activeTimeMs'] = session.activeTimeMs; }
  if (session.summary !== undefined) { updates.push('summary = @summary'); params['summary'] = session.summary; }
  if (session.syncStatus !== undefined) { updates.push('sync_status = @syncStatus'); params['syncStatus'] = session.syncStatus; }

  if (updates.length === 0) return;
  db.prepare(`UPDATE sessions SET ${updates.join(', ')} WHERE id = @id`).run(params);
}

export function getSession(db: Database.Database, id: string): Session | null {
  const row = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return rowToSession(row);
}

export function getSessions(
  db: Database.Database,
  projectId: string,
  opts: { limit?: number; offset?: number } = {}
): Session[] {
  const rows = db.prepare(`
    SELECT * FROM sessions WHERE project_id = ?
    ORDER BY started_at DESC LIMIT ? OFFSET ?
  `).all(projectId, opts.limit ?? 20, opts.offset ?? 0) as Record<string, unknown>[];
  return rows.map(rowToSession);
}

function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row['id'] as string,
    projectId: row['project_id'] as string,
    startedAt: row['started_at'] as number,
    endedAt: row['ended_at'] as number | null,
    idleThresholdMs: row['idle_threshold_ms'] as number,
    score: row['score'] as number | null,
    commitCount: row['commit_count'] as number,
    fileChurn: row['file_churn'] as number,
    activeTimeMs: row['active_time_ms'] as number,
    summary: row['summary'] as string | null,
    syncStatus: row['sync_status'] as Session['syncStatus'],
  };
}

export function insertProject(db: Database.Database, project: Project): void {
  db.prepare(`
    INSERT OR IGNORE INTO projects
      (id, name, type, stack, description, root_path, created_at, last_active_at)
    VALUES
      (@id, @name, @type, @stack, @description, @rootPath, @createdAt, @lastActiveAt)
  `).run({ ...project, stack: JSON.stringify(project.stack) });
}

export function getProject(db: Database.Database, rootPath: string): Project | null {
  const row = db.prepare('SELECT * FROM projects WHERE root_path = ?').get(rootPath) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    type: row['type'] as Project['type'],
    stack: JSON.parse(row['stack'] as string) as string[],
    description: row['description'] as string,
    rootPath: row['root_path'] as string,
    createdAt: row['created_at'] as number,
    lastActiveAt: row['last_active_at'] as number,
  };
}

export function getProjectById(db: Database.Database, id: string): Project | null {
  const row = db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row['id'] as string,
    name: row['name'] as string,
    type: row['type'] as Project['type'],
    stack: JSON.parse(row['stack'] as string) as string[],
    description: row['description'] as string,
    rootPath: row['root_path'] as string,
    createdAt: row['created_at'] as number,
    lastActiveAt: row['last_active_at'] as number,
  };
}

export function getAllSessions(
  db: Database.Database,
  opts: { limit?: number; offset?: number } = {}
): Session[] {
  const rows = db.prepare(`
    SELECT * FROM sessions
    ORDER BY started_at DESC LIMIT ? OFFSET ?
  `).all(opts.limit ?? 20, opts.offset ?? 0) as Record<string, unknown>[];
  return rows.map(rowToSession);
}

export function getEventCount(db: Database.Database, projectId: string): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM events WHERE project_id = ?').get(projectId) as { count: number };
  return row.count;
}

export function getSessionCount(db: Database.Database, projectId: string): number {
  const row = db.prepare('SELECT COUNT(*) as count FROM sessions WHERE project_id = ?').get(projectId) as { count: number };
  return row.count;
}

export function getPendingSyncEvents(db: Database.Database, limit = 500): Event[] {
  const rows = db.prepare(`
    SELECT * FROM events WHERE sync_status = 'pending'
    ORDER BY created_at ASC LIMIT ?
  `).all(limit) as Record<string, unknown>[];
  return rows.map(row => ({
    id: row['id'] as string,
    projectId: row['project_id'] as string,
    sessionId: row['session_id'] as string | null,
    type: row['type'] as Event['type'],
    timestamp: row['timestamp'] as number,
    payload: JSON.parse(row['payload'] as string) as Record<string, unknown>,
    syncStatus: row['sync_status'] as Event['syncStatus'],
    createdAt: row['created_at'] as number,
  }));
}

export function markEventsSynced(db: Database.Database, ids: string[]): void {
  if (ids.length === 0) return;
  const placeholders = ids.map(() => '?').join(',');
  db.prepare(`UPDATE events SET sync_status = 'synced' WHERE id IN (${placeholders})`).run(...ids);
}
