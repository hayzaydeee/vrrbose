import { mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getDb, closeDb, insertProject, insertSession, insertEvent } from '../db/client.js';
import { generateDocument, formatGeneratedDocumentForSurface } from '../agent/document-generator.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main(): Promise<void> {
  const homeDir = join(tmpdir(), `vrrbose-doc-gate-${Date.now()}`);
  const vrrboseDir = join(homeDir, '.vrrbose');
  const dbPath = join(vrrboseDir, 'document-gate.db');
  mkdirSync(vrrboseDir, { recursive: true });

  process.env['HOME'] = homeDir;
  process.env['USERPROFILE'] = homeDir;
  const templatesDir = join(homeDir, '.vrrbose', 'templates');
  mkdirSync(templatesDir, { recursive: true });
  writeFileSync(
    join(templatesDir, 'weekly_digest.md'),
    '# Custom Weekly Digest\n\nProject: {{project_name}}\nWindow: {{period}}\nCommits: {{total_commits}}\n',
    'utf8',
  );

  const db = getDb(dbPath);
  const projectId = randomUUID();
  insertProject(db, {
    id: projectId,
    name: 'document-gate-project',
    type: 'other',
    stack: ['node'],
    description: 'document generation gate checks',
    rootPath: process.cwd(),
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  });

  const sessionId = randomUUID();
  insertSession(db, {
    id: sessionId,
    projectId,
    startedAt: Date.now() - 15_000,
    endedAt: Date.now() - 1_000,
    idleThresholdMs: 7_200_000,
    score: 42,
    commitCount: 3,
    fileChurn: 18,
    activeTimeMs: 420_000,
    summary: 'Implemented capture gates and fixed sync reliability edge cases.',
    syncStatus: 'pending',
  });

  insertEvent(db, {
    id: randomUUID(),
    projectId,
    sessionId,
    type: 'git_commit',
    timestamp: Date.now() - 8_000,
    payload: { message: 'feat: improve sync and capture gates' },
    syncStatus: 'pending',
    createdAt: Date.now() - 8_000,
  });

  insertEvent(db, {
    id: randomUUID(),
    projectId,
    sessionId,
    type: 'file_save',
    timestamp: Date.now() - 7_000,
    payload: { filePath: 'src/sync/worker.ts' },
    syncStatus: 'pending',
    createdAt: Date.now() - 7_000,
  });

  const prompts = [
    'generate session summary',
    'write weekly digest',
    'create brag sheet',
    'draft performance review',
    'prepare investor update',
    'generate cv bullets',
  ];

  const kinds = new Set<string>();
  for (const prompt of prompts) {
    const generated = generateDocument(db, projectId, prompt);
    kinds.add(generated.kind);
    assert(generated.markdown.length > 40, `Expected markdown output for ${generated.kind}`);

    const cli = formatGeneratedDocumentForSurface(generated, 'cli');
    assert(cli.includes('Saved:'), `CLI output should include Saved: for ${generated.kind}`);
    assert(!cli.includes('# '), `CLI output should not dump markdown headings for ${generated.kind}`);

    const web = formatGeneratedDocumentForSurface(generated, 'web');
    assert(web.startsWith('# '), `Web output should return markdown content for ${generated.kind}`);
  }

  const weekly = generateDocument(db, projectId, 'write weekly digest');
  assert(weekly.markdown.includes('# Custom Weekly Digest'), 'Expected custom template to override weekly digest');
  assert(weekly.markdown.includes('Commits:'), 'Expected template variable interpolation output');

  assert(kinds.size === 6, `Expected 6 document kinds, got ${kinds.size}`);
  console.log('document-gen-gate: PASS six-format generation and surface formatting');
  console.log('document-gen-gate: PASS custom template override');

  closeDb();
}

main().catch((err) => {
  console.error('document-gen-gate: FAIL', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
