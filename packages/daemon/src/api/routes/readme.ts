import { Router } from 'express';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { getProjectById } from '../../db/client.js';

interface DiffLine {
  type: 'add' | 'remove' | 'context';
  content: string;
}

const START_MARKER = '<!-- VRRBOSE:living-readme:start -->';
const END_MARKER = '<!-- VRRBOSE:living-readme:end -->';

function buildLivingSection(db: Database.Database, projectId: string): string {
  const files = db.prepare(`
    SELECT
      file_path,
      SUM(edit_count) as edit_count,
      SUM(lines_added) as lines_added,
      SUM(lines_removed) as lines_removed,
      MAX(last_edit_at) as last_edit_at
    FROM file_summaries
    WHERE project_id = @projectId
    GROUP BY file_path
    ORDER BY last_edit_at DESC
    LIMIT 10
  `).all({ projectId }) as Array<{
    file_path: string;
    edit_count: number;
    lines_added: number;
    lines_removed: number;
    last_edit_at: number;
  }>;

  const sessions = db.prepare(`
    SELECT summary, started_at, ended_at, commit_count, file_churn
    FROM sessions
    WHERE project_id = @projectId AND ended_at IS NOT NULL
    ORDER BY started_at DESC
    LIMIT 3
  `).all({ projectId }) as Array<{
    summary: string | null;
    started_at: number;
    ended_at: number;
    commit_count: number;
    file_churn: number;
  }>;

  const topFiles = files.length === 0
    ? '- No file activity has been captured yet.'
    : files
        .map((f) => `- \`${f.file_path}\`: ${f.edit_count} edits (+${f.lines_added}/-${f.lines_removed})`)
        .join('\n');

  const recentSessions = sessions.length === 0
    ? '- No completed sessions yet.'
    : sessions
        .map((s) => {
          const hours = Math.max(0, (s.ended_at - s.started_at) / 3600000);
          const summary = (s.summary ?? '').trim() || 'No summary captured.';
          return `- ${summary} (commits: ${s.commit_count}, churn: ${s.file_churn}, span: ${hours.toFixed(1)}h)`;
        })
        .join('\n');

  return [
    START_MARKER,
    '## Living README',
    '',
    '_Auto-generated from recent Vrrbose activity. Review before publishing._',
    '',
    '### Recent Focus Files',
    topFiles,
    '',
    '### Recent Session Highlights',
    recentSessions,
    END_MARKER,
    '',
  ].join('\n');
}

function upsertLivingReadme(currentContent: string, livingSection: string): string {
  const startIdx = currentContent.indexOf(START_MARKER);
  const endIdx = currentContent.indexOf(END_MARKER);

  if (startIdx >= 0 && endIdx > startIdx) {
    const before = currentContent.slice(0, startIdx).trimEnd();
    const after = currentContent.slice(endIdx + END_MARKER.length).trimStart();
    return `${before}\n\n${livingSection}${after ? `\n${after}` : ''}`.trimEnd() + '\n';
  }

  const base = currentContent.trimEnd();
  if (base.length === 0) {
    return `${livingSection}`;
  }

  return `${base}\n\n${livingSection}`;
}

function makeLineDiff(currentContent: string, proposedContent: string): DiffLine[] {
  const a = currentContent.split(/\r?\n/);
  const b = proposedContent.split(/\r?\n/);
  const max = Math.max(a.length, b.length);
  const out: DiffLine[] = [];

  for (let i = 0; i < max; i += 1) {
    const left = a[i];
    const right = b[i];

    if (left === right && left !== undefined) {
      out.push({ type: 'context', content: ` ${left}` });
      continue;
    }

    if (left !== undefined) {
      out.push({ type: 'remove', content: `-${left}` });
    }

    if (right !== undefined) {
      out.push({ type: 'add', content: `+${right}` });
    }
  }

  return out;
}

function resolveReadmePath(db: Database.Database, projectId: string): string | null {
  const project = getProjectById(db, projectId);
  if (!project) return null;
  return join(project.rootPath, 'README.md');
}

export function readmeRouter(db: Database.Database, defaultProjectId: string): Router {
  const router = Router();

  router.get('/', (req, res) => {
    const projectId = typeof req.query['projectId'] === 'string'
      ? req.query['projectId']
      : defaultProjectId;

    const readmePath = resolveReadmePath(db, projectId);
    if (!readmePath) {
      res.status(404).json({ ok: false, error: 'Project not found' });
      return;
    }

    const current = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '';
    const proposed = upsertLivingReadme(current, buildLivingSection(db, projectId));
    const diff = makeLineDiff(current, proposed);

    res.json({
      ok: true,
      data: {
        readmePath,
        current,
        proposed,
        diff,
        changed: current !== proposed,
      },
    });
  });

  router.post('/apply', (req, res) => {
    const body = req.body as { projectId?: string };
    const projectId = typeof body.projectId === 'string' && body.projectId.length > 0
      ? body.projectId
      : defaultProjectId;

    const readmePath = resolveReadmePath(db, projectId);
    if (!readmePath) {
      res.status(404).json({ ok: false, error: 'Project not found' });
      return;
    }

    const current = existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '';
    const proposed = upsertLivingReadme(current, buildLivingSection(db, projectId));

    writeFileSync(readmePath, proposed, 'utf8');

    res.json({
      ok: true,
      data: {
        readmePath,
        changed: current !== proposed,
      },
    });
  });

  return router;
}
