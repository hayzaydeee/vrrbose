import type Database from 'better-sqlite3';
import type { QueryType } from '@vrrbose/shared';
import { CONTEXT_INJECTION } from '@vrrbose/shared';
import { getEvents, getSessions, getSession } from '../db/client.js';

export interface AssembledContext {
  recentEvents: string;
  sessionSummary: string;
  raw: string;
}

const MAX_WORDS = CONTEXT_INJECTION.MAX_WORDS;

export async function assembleContext(
  db: Database.Database,
  projectId: string,
  queryType: QueryType,
  sessionId?: string
): Promise<AssembledContext> {
  const parts: string[] = [];

  if (queryType === 'METRICS' || queryType === 'RETROSPECTIVE') {
    const sessions = getSessions(db, projectId, { limit: 10 });
    if (sessions.length > 0) {
      parts.push('## Recent Sessions');
      for (const s of sessions.slice(0, 5)) {
        const dur = s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : 'ongoing';
        parts.push(
          `- ${new Date(s.startedAt).toISOString().slice(0, 16)} | ` +
          `${dur}m | commits: ${s.commitCount} | churn: ${s.fileChurn} lines | score: ${s.score?.toFixed(0) ?? 'n/a'}`
        );
      }
    }
  }

  if (queryType === 'REPLAY' || queryType === 'RETROSPECTIVE') {
    const events = getEvents(db, projectId, {
      ...(sessionId !== undefined && { sessionId }),
      limit: 50,
    });
    if (events.length > 0) {
      parts.push('## Recent Events');
      for (const e of events.slice(0, 20)) {
        const ts = new Date(e.timestamp).toISOString().slice(0, 16);
        const summary = summarisePayload(e.type, e.payload);
        parts.push(`- [${ts}] ${e.type}: ${summary}`);
      }
    }
  }

  if (queryType === 'METRICS') {
    // Hot files
    const fileSaves = getEvents(db, projectId, { type: 'file_save', limit: 500 });
    if (fileSaves.length > 0) {
      const counts = new Map<string, number>();
      for (const e of fileSaves) {
        const p = String(e.payload['filePath'] ?? '');
        if (p) counts.set(p, (counts.get(p) ?? 0) + 1);
      }
      const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
      parts.push('## Most-edited files');
      for (const [path, n] of top) parts.push(`- ${path}: ${n} saves`);
    }
    // Recent commits for metrics
    const commits = getEvents(db, projectId, { type: 'git_commit', limit: 50 });
    if (commits.length > 0) {
      parts.push('## Recent commits');
      for (const c of commits.slice(0, 10)) {
        const ts = new Date(c.timestamp).toISOString().slice(0, 10);
        parts.push(`- [${ts}] ${String(c.payload['message'] ?? '').slice(0, 80)}`);
      }
    }
  }

  if (sessionId) {
    const session = getSession(db, sessionId);
    if (session) {
      parts.push('## Current Session');
      parts.push(`Started: ${new Date(session.startedAt).toISOString().slice(0, 16)}`);
      parts.push(`Commits: ${session.commitCount}, Churn: ${session.fileChurn} lines`);
      if (session.summary) parts.push(`Summary: ${session.summary}`);
    }
  }

  const raw = parts.join('\n');
  const truncated = truncateToWordLimit(raw, MAX_WORDS);

  return {
    recentEvents: parts.filter(p => p.startsWith('- [')).join('\n'),
    sessionSummary: parts.filter(p => p.startsWith('## Current Session')).join('\n'),
    raw: truncated,
  };
}

function summarisePayload(type: string, payload: Record<string, unknown>): string {
  switch (type) {
    case 'git_commit': return String(payload['message'] ?? '').slice(0, 80);
    case 'git_branch_create': return `${payload['from']} → ${payload['to']}`;
    case 'file_save':
    case 'file_create':
    case 'file_delete': return String(payload['filePath'] ?? '');
    default: return JSON.stringify(payload).slice(0, 60);
  }
}

function truncateToWordLimit(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '\n[...truncated]';
}
