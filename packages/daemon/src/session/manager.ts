import { v4 as uuidv4 } from 'uuid';
import type { Session } from '@vrrbose/shared';
import { SESSION_DEFAULTS } from '@vrrbose/shared';
import type Database from 'better-sqlite3';
import { insertSession, updateSession, getSessions, getSession, getEvents } from '../db/client.js';
import { scoreSession } from './scorer.js';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export interface SessionManagerOptions {
  idleThresholdHours?: number;
  onSessionClose?: (sessionId: string) => void;
}

export class SessionManager {
  private db: Database.Database;
  private projectId: string;
  private idleThresholdMs: number;
  private currentSessionId: string | null = null;
  private lastActivityAt: number = Date.now();
  private idleCheckInterval: ReturnType<typeof setInterval> | null = null;
  private onSessionClose: ((sessionId: string) => void) | undefined;

  constructor(db: Database.Database, projectId: string, opts: SessionManagerOptions = {}) {
    this.db = db;
    this.projectId = projectId;
    this.idleThresholdMs = (opts.idleThresholdHours ?? SESSION_DEFAULTS.IDLE_THRESHOLD_HOURS) * 60 * 60 * 1000;
    this.onSessionClose = opts.onSessionClose;
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

    // Resume most recent unclosed session if it's within the idle threshold
    const recent = getSessions(this.db, this.projectId, { limit: 1 });
    const last = recent[0];
    if (last && !last.endedAt && (now - last.startedAt) < this.idleThresholdMs) {
      this.currentSessionId = last.id;
      this.lastActivityAt = now;
      console.log(`[session] resumed ${last.id}`);
      return;
    }

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

    const closedId = this.currentSessionId;
    console.log(`[session] closed ${closedId} score=${score.toFixed(1)}`);
    this.currentSessionId = null;
    this.onSessionClose?.(closedId);
    this.generateSummaryAsync(closedId, session);
  }

  private async generateSummaryAsync(sessionId: string, session: Session): Promise<void> {
    try {
      const events = getEvents(this.db, session.projectId, { sessionId, limit: 50 });
      const eventLines = events.slice(0, 20).map(e => {
        const ts = new Date(e.timestamp).toISOString().slice(0, 16);
        const detail = e.type === 'git_commit'
          ? String(e.payload['message'] ?? '')
          : JSON.stringify(e.payload).slice(0, 60);
        return `[${ts}] ${e.type}: ${detail}`;
      }).join('\n');

      const durationMin = Math.round(((session.endedAt ?? Date.now()) - session.startedAt) / 60000);
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 150,
        messages: [{
          role: 'user',
          content: `Summarise this dev session in 1-2 sentences. Focus on what was built or changed.\n\nSession: ${durationMin}m, ${session.commitCount} commits, ${session.fileChurn} lines changed.\n\nEvents:\n${eventLines || 'No events recorded.'}`,
        }],
      });

      const summary = msg.content[0]?.type === 'text' ? msg.content[0].text.trim() : null;
      if (summary) {
        updateSession(this.db, { id: sessionId, summary });
        console.log(`[session] summary written for ${sessionId.slice(0, 8)}`);
      }
    } catch (err) {
      console.error('[session] summary generation failed:', err);
    }
  }

  private checkIdle(): void {
    const idleMs = Date.now() - this.lastActivityAt;
    if (idleMs >= this.idleThresholdMs && this.currentSessionId) {
      console.log(`[session] idle threshold reached (${Math.round(idleMs / 60000)}m), closing session`);
      this.closeCurrentSession();
    }
  }
}
