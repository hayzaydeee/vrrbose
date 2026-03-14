import { v4 as uuidv4 } from 'uuid';
import type { Session } from '@vrrbose/shared';
import { SESSION_DEFAULTS } from '@vrrbose/shared';
import type Database from 'better-sqlite3';
import { insertSession, updateSession, getSessions, getSession } from '../db/client.js';
import { scoreSession } from './scorer.js';

export class SessionManager {
  private db: Database.Database;
  private projectId: string;
  private idleThresholdMs: number;
  private currentSessionId: string | null = null;
  private lastActivityAt: number = Date.now();
  private idleCheckInterval: ReturnType<typeof setInterval> | null = null;

  constructor(db: Database.Database, projectId: string, idleThresholdHours = SESSION_DEFAULTS.IDLE_THRESHOLD_HOURS) {
    this.db = db;
    this.projectId = projectId;
    this.idleThresholdMs = idleThresholdHours * 60 * 60 * 1000;
  }

  start(): void {
    this.openSession();
    // Check for idle every minute
    this.idleCheckInterval = setInterval(() => this.checkIdle(), 60_000);
  }

  stop(): void {
    if (this.idleCheckInterval) {
      clearInterval(this.idleCheckInterval);
      this.idleCheckInterval = null;
    }
    this.closeCurrentSession();
  }

  recordActivity(): void {
    this.lastActivityAt = Date.now();
    if (!this.currentSessionId) {
      this.openSession();
    }
  }

  getCurrentSessionId(): string | null {
    return this.currentSessionId;
  }

  getActiveSession(): Session | null {
    if (!this.currentSessionId) return null;
    return getSession(this.db, this.currentSessionId);
  }

  updateSessionMetrics(patch: { commitCount?: number; fileChurn?: number; activeTimeMs?: number }): void {
    if (!this.currentSessionId) return;

    const session = getSession(this.db, this.currentSessionId);
    if (!session) return;

    const updated: Partial<Session> & { id: string } = { id: this.currentSessionId };
    if (patch.commitCount !== undefined) updated.commitCount = session.commitCount + patch.commitCount;
    if (patch.fileChurn !== undefined) updated.fileChurn = session.fileChurn + patch.fileChurn;
    if (patch.activeTimeMs !== undefined) updated.activeTimeMs = session.activeTimeMs + patch.activeTimeMs;

    updateSession(this.db, updated);
  }

  private openSession(): void {
    const now = Date.now();
    const session: Session = {
      id: uuidv4(),
      projectId: this.projectId,
      startedAt: now,
      endedAt: null,
      idleThresholdMs: this.idleThresholdMs,
      score: null,
      commitCount: 0,
      fileChurn: 0,
      activeTimeMs: 0,
      summary: null,
      syncStatus: 'pending',
    };
    insertSession(this.db, session);
    this.currentSessionId = session.id;
    this.lastActivityAt = now;
    console.log(`[session] opened ${session.id}`);
  }

  private closeCurrentSession(): void {
    if (!this.currentSessionId) return;

    const session = getSession(this.db, this.currentSessionId);
    if (!session) return;

    const score = scoreSession({
      commitCount: session.commitCount,
      activeTimeMs: session.activeTimeMs,
      fileChurn: session.fileChurn,
    });

    updateSession(this.db, {
      id: this.currentSessionId,
      endedAt: Date.now(),
      score,
    });

    console.log(`[session] closed ${this.currentSessionId} score=${score.toFixed(1)}`);
    this.currentSessionId = null;
  }

  private checkIdle(): void {
    const idleMs = Date.now() - this.lastActivityAt;
    if (idleMs >= this.idleThresholdMs && this.currentSessionId) {
      console.log(`[session] idle threshold reached (${Math.round(idleMs / 60000)}m), closing session`);
      this.closeCurrentSession();
    }
  }
}
