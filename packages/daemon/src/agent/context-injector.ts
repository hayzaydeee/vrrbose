import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type Database from 'better-sqlite3';
import { CONTEXT_INJECTION } from '@vrrbose/shared';
import { getSessions, getEvents } from '../db/client.js';

const { BLOCK_START, BLOCK_END, MAX_WORDS } = CONTEXT_INJECTION;

export async function injectContext(
  db: Database.Database,
  projectId: string,
  projectPath: string,
  targets: {
    claudeCode?: boolean;
    cursor?: boolean;
    copilot?: boolean;
  } = { claudeCode: true }
): Promise<void> {
  const block = buildContextBlock(db, projectId);

  const targetPaths: string[] = [];
  if (targets.claudeCode) targetPaths.push(join(projectPath, 'CLAUDE.md'));
  if (targets.cursor) targetPaths.push(join(projectPath, '.cursor', 'rules'));
  if (targets.copilot) targetPaths.push(join(projectPath, '.github', 'copilot-instructions.md'));
  // Always write the local context file
  targetPaths.push(join(projectPath, '.vrrbose', 'context.md'));

  for (const filePath of targetPaths) {
    upsertBlock(filePath, block);
  }
}

function buildContextBlock(db: Database.Database, projectId: string): string {
  const sessions = getSessions(db, projectId, { limit: 5 });
  const recentEvents = getEvents(db, projectId, { limit: 30 });

  const lines: string[] = ['## Vrrbose: recent project context'];

  if (sessions.length > 0) {
    lines.push('');
    lines.push('### Recent sessions');
    for (const s of sessions.slice(0, 3)) {
      const date = new Date(s.startedAt).toISOString().slice(0, 10);
      const dur = s.endedAt ? `${Math.round((s.endedAt - s.startedAt) / 60000)}m` : 'ongoing';
      lines.push(`- ${date}: ${dur}, ${s.commitCount} commits, score ${s.score?.toFixed(0) ?? 'n/a'}`);
      if (s.summary) lines.push(`  ${s.summary}`);
    }
  }

  const commits = recentEvents.filter(e => e.type === 'git_commit').slice(0, 5);
  if (commits.length > 0) {
    lines.push('');
    lines.push('### Recent commits');
    for (const c of commits) {
      const msg = String(c.payload['message'] ?? '').slice(0, 80);
      const date = new Date(c.timestamp).toISOString().slice(0, 10);
      lines.push(`- ${date}: ${msg}`);
    }
  }

  const raw = lines.join('\n');
  return truncateToWordLimit(raw, MAX_WORDS);
}

function upsertBlock(filePath: string, content: string): void {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const block = `${BLOCK_START}\n${content}\n${BLOCK_END}`;

  if (!existsSync(filePath)) {
    writeFileSync(filePath, block + '\n', 'utf8');
    console.log(`[inject] created ${filePath}`);
    return;
  }

  const existing = readFileSync(filePath, 'utf8');
  const startIdx = existing.indexOf(BLOCK_START);
  const endIdx = existing.indexOf(BLOCK_END);

  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx);
    const after = existing.slice(endIdx + BLOCK_END.length);
    writeFileSync(filePath, before + block + after, 'utf8');
  } else {
    const separator = existing.endsWith('\n') ? '\n' : '\n\n';
    writeFileSync(filePath, existing + separator + block + '\n', 'utf8');
  }
  console.log(`[inject] updated ${filePath}`);
}

function truncateToWordLimit(text: string, maxWords: number): string {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return text;
  return words.slice(0, maxWords).join(' ') + '\n[...truncated for context limit]';
}
