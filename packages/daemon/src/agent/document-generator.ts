import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type Database from 'better-sqlite3';
import { getEvents, getSessions, getProjectById } from '../db/client.js';

export type DocumentKind =
  | 'session_summary'
  | 'weekly_digest'
  | 'brag_sheet'
  | 'performance_review'
  | 'investor_update'
  | 'cv_bullets';

export interface GeneratedDocument {
  kind: DocumentKind;
  filePath: string;
  markdown: string;
  preview: string[];
}

export function detectDocumentKind(query: string): DocumentKind {
  const q = query.toLowerCase();
  if (q.includes('weekly')) return 'weekly_digest';
  if (q.includes('brag')) return 'brag_sheet';
  if (q.includes('performance')) return 'performance_review';
  if (q.includes('investor')) return 'investor_update';
  if (q.includes('cv') || q.includes('resume') || q.includes('bullet')) return 'cv_bullets';
  return 'session_summary';
}

export function generateDocument(
  db: Database.Database,
  projectId: string,
  query: string,
): GeneratedDocument {
  const kind = detectDocumentKind(query);
  const project = getProjectById(db, projectId);
  const sessions = getSessions(db, projectId, { limit: 20 });
  const events = getEvents(db, projectId, { limit: 500 });

  const projectName = project?.name ?? 'project';
  const period = inferPeriodLabel(sessions);

  const markdown = buildMarkdown(kind, projectName, period, sessions, events);
  const outputDir = join(homedir(), '.vrrbose', 'output');
  mkdirSync(outputDir, { recursive: true });
  const templatesDir = join(homedir(), '.vrrbose', 'templates');
  const learnedDir = join(templatesDir, '_learned');
  mkdirSync(templatesDir, { recursive: true });
  mkdirSync(learnedDir, { recursive: true });

  const datePrefix = new Date().toISOString().slice(0, 10);
  const outputFile = join(outputDir, `${datePrefix}_${kind}_${projectName.replace(/\s+/g, '-').toLowerCase()}.md`);
  writeFileSync(outputFile, markdown, 'utf8');
  const learnedFile = join(learnedDir, `${datePrefix}_${kind}.md`);
  writeFileSync(learnedFile, markdown, 'utf8');

  const preview = markdown
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('#'))
    .slice(0, 2);

  return {
    kind,
    filePath: outputFile,
    markdown,
    preview,
  };
}

export function formatGeneratedDocumentForSurface(doc: GeneratedDocument, format: 'cli' | 'web'): string {
  if (format === 'web') {
    return doc.markdown;
  }

  const previewA = doc.preview[0] ?? 'No summary line available.';
  const previewB = doc.preview[1] ?? 'No additional preview available.';

  return [
    `Writing ${doc.kind}...`,
    '',
    `Saved: ${doc.filePath}`,
    '',
    'Preview:',
    `  ${previewA}`,
    `  ${previewB}`,
    '',
    'Run `vrrbose open output` to view the full document.',
  ].join('\n');
}

function inferPeriodLabel(sessions: Array<{ startedAt: number }>): string {
  if (sessions.length === 0) return new Date().toISOString().slice(0, 10);
  const sorted = sessions.map((s) => s.startedAt).sort((a, b) => a - b);
  const first = new Date(sorted[0] ?? Date.now()).toISOString().slice(0, 10);
  const last = new Date(sorted[sorted.length - 1] ?? Date.now()).toISOString().slice(0, 10);
  return first === last ? first : `${first} to ${last}`;
}

function buildMarkdown(
  kind: DocumentKind,
  projectName: string,
  period: string,
  sessions: Array<{ startedAt: number; endedAt: number | null; commitCount: number; fileChurn: number; summary: string | null }> ,
  events: Array<{ type: string; payload: Record<string, unknown>; timestamp: number }>,
): string {
  const totalCommits = sessions.reduce((sum, s) => sum + s.commitCount, 0);
  const totalChurn = sessions.reduce((sum, s) => sum + s.fileChurn, 0);
  const topFiles = topEditedFiles(events).slice(0, 5);
  const commitMessages = events
    .filter((e) => e.type === 'git_commit')
    .slice(0, 8)
    .map((e) => String(e.payload['message'] ?? '').trim())
    .filter((m) => m.length > 0);

  const templateVars: Record<string, string> = {
    project_name: projectName,
    period,
    session_count: String(sessions.length),
    total_commits: String(totalCommits),
    total_churn: String(totalChurn),
    top_files: topFiles.map((f) => `- ${f.path}: ${f.count} edits`).join('\n'),
    highlights: summariesOrFallback(sessions).join('\n'),
    commit_messages: commitMessages.map((m) => `- ${m}`).join('\n'),
  };

  const customTemplate = loadCustomTemplate(kind);
  if (customTemplate) {
    return applyTemplate(customTemplate, templateVars);
  }

  if (kind === 'session_summary') {
    return [
      `# Session Summary - ${projectName}`,
      '',
      `Period: ${period}`,
      `Sessions: ${sessions.length}`,
      `Commits: ${totalCommits}`,
      `File churn: ${totalChurn}`,
      '',
      '## Highlights',
      ...summariesOrFallback(sessions),
      '',
      '## Top changed files',
      ...topFiles.map((f) => `- ${f.path}: ${f.count} edits`),
    ].join('\n');
  }

  if (kind === 'weekly_digest') {
    return [
      `# Weekly Digest - ${projectName}`,
      '',
      `Window: ${period}`,
      '',
      '## Outcomes',
      `- ${totalCommits} commits landed across ${sessions.length} sessions.`,
      `- ${totalChurn} lines touched while iterating on product and infra paths.`,
      '',
      '## Notable commits',
      ...commitMessages.slice(0, 5).map((m) => `- ${m}`),
      '',
      '## Focus files',
      ...topFiles.map((f) => `- ${f.path}`),
    ].join('\n');
  }

  if (kind === 'brag_sheet') {
    return [
      `# Brag Sheet - ${projectName}`,
      '',
      `Period: ${period}`,
      '',
      '## Impact bullets',
      `- Drove ${totalCommits} production-facing commits with consistent delivery cadence.`,
      `- Advanced key workflows across ${topFiles.length} frequently-touched files and modules.`,
      `- Maintained momentum through ${sessions.length} tracked sessions with ${totalChurn} lines of change.`,
      '',
      '## Evidence',
      ...commitMessages.slice(0, 6).map((m) => `- ${m}`),
    ].join('\n');
  }

  if (kind === 'performance_review') {
    return [
      `# Performance Review Inputs - ${projectName}`,
      '',
      `Period: ${period}`,
      '',
      '## Delivery',
      `- Completed ${sessions.length} focused sessions with ${totalCommits} commits.`,
      '',
      '## Execution quality',
      `- Sustained implementation throughput with ${totalChurn} lines of churn and follow-through on gate checks.`,
      '',
      '## Highlights',
      ...summariesOrFallback(sessions),
    ].join('\n');
  }

  if (kind === 'investor_update') {
    return [
      `# Investor Update Draft - ${projectName}`,
      '',
      `Window: ${period}`,
      '',
      '## Product progress',
      `- Shipped iterative improvements over ${sessions.length} tracked build sessions.`,
      `- Landed ${totalCommits} commits with core infrastructure and capture pipeline expansion.`,
      '',
      '## Execution signal',
      `- ${totalChurn} lines changed with measurable QA gate progress and reliability hardening.`,
      '',
      '## Representative commits',
      ...commitMessages.slice(0, 5).map((m) => `- ${m}`),
    ].join('\n');
  }

  return [
    `# CV Bullets - ${projectName}`,
    '',
    `Period: ${period}`,
    '',
    '- Delivered end-to-end product and platform work with consistent commit velocity and quality gates.',
    `- Executed ${totalCommits} commits across ${sessions.length} sessions, touching ${totalChurn} lines with measurable impact.`,
    `- Led implementation in high-churn modules including ${topFiles.slice(0, 3).map((f) => f.path).join(', ')}.`,
  ].join('\n');
}

function loadCustomTemplate(kind: DocumentKind): string | null {
  const templatePath = join(homedir(), '.vrrbose', 'templates', `${kind}.md`);
  if (!existsSync(templatePath)) return null;
  return readFileSync(templatePath, 'utf8');
}

function applyTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/ig, (_match, key: string) => vars[key] ?? '');
}

function summariesOrFallback(
  sessions: Array<{ summary: string | null; startedAt: number }>,
): string[] {
  const lines = sessions
    .map((s) => s.summary?.trim())
    .filter((s): s is string => Boolean(s))
    .slice(0, 6)
    .map((s) => `- ${s}`);
  if (lines.length > 0) return lines;

  return sessions.slice(0, 4).map((s) => {
    const date = new Date(s.startedAt).toISOString().slice(0, 10);
    return `- Session activity captured on ${date}.`;
  });
}

function topEditedFiles(events: Array<{ type: string; payload: Record<string, unknown> }>): Array<{ path: string; count: number }> {
  const counts = new Map<string, number>();

  for (const event of events) {
    const maybeFilePath = event.payload['filePath'];
    if (typeof maybeFilePath === 'string' && maybeFilePath.length > 0) {
      counts.set(maybeFilePath, (counts.get(maybeFilePath) ?? 0) + 1);
    }

    if (event.type === 'git_staged_diff' && Array.isArray(event.payload['files'])) {
      for (const file of event.payload['files'] as unknown[]) {
        if (typeof file === 'string' && file.length > 0) {
          counts.set(file, (counts.get(file) ?? 0) + 1);
        }
      }
    }
  }

  return Array.from(counts.entries())
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count);
}
