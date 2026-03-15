import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { isDaemonRunning, spawnDaemon } from '../daemon.js';
import { registerProject } from '../client.js';
import { DAEMON_PORT } from '@vrrbose/shared';

async function waitForDaemon(timeoutMs = 10_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${DAEMON_PORT}/health`);
      if (res.ok) return true;
    } catch { /* not ready */ }
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

const DEFAULT_CONFIG_YAML = `# Vrrbose global config
daemon:
  port: 7331

ai:
  primary: claude
  ollama_model: llama3

output:
  path: ~/.vrrbose/output/
`;

const VRRBOSE_MD_TEMPLATE = `# VRRBOSE

> Project configuration for the Vrrbose agent.

## Project

\`\`\`yaml
name: {PROJECT_NAME}
type: other
stack: []
description: >
  Add a short description of this project.
\`\`\`

## Standing instructions

- We use conventional commits (feat:, fix:, chore:, refactor:, docs:)
- Solo project
`;

export async function initCommand(opts: { json?: boolean }): Promise<void> {
  const cwd = process.cwd();
  const projectName = cwd.split('/').pop() ?? 'unnamed';

  // 1. Check git repo
  const isGitRepo = existsSync(join(cwd, '.git'));
  if (!isGitRepo) {
    console.warn('Warning: no .git directory found. Vrrbose works best in a git repo.');
  }

  // 2. Create ~/.vrrbose
  const vrrboseDir = join(homedir(), '.vrrbose');
  const outputDir = join(vrrboseDir, 'output');
  mkdirSync(outputDir, { recursive: true });

  // 3. Write global config if not exists
  const configPath = join(vrrboseDir, 'config.yaml');
  if (!existsSync(configPath)) {
    writeFileSync(configPath, DEFAULT_CONFIG_YAML, 'utf8');
    console.log(`Created ${configPath}`);
  }

  // 4. Write VRRBOSE.md if not exists
  const vrrboseMdPath = join(cwd, 'VRRBOSE.md');
  if (!existsSync(vrrboseMdPath)) {
    writeFileSync(vrrboseMdPath, VRRBOSE_MD_TEMPLATE.replace('{PROJECT_NAME}', projectName), 'utf8');
    console.log(`Created ${vrrboseMdPath}`);
  }

  // 5. Start daemon if not already running
  let daemonPid: number | null = null;
  let daemonError: string | null = null;
  if (!isDaemonRunning()) {
    try {
      daemonPid = spawnDaemon(cwd);
      await waitForDaemon();
    } catch (err) {
      daemonError = err instanceof Error ? err.message : String(err);
    }
  }

  // 6. Register this project with the daemon
  let projectId: string | null = null;
  if (!daemonError) {
    try {
      const reg = await registerProject(cwd);
      projectId = reg.projectId;
    } catch {
      // Daemon may not be ready yet — non-fatal
    }
  }

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, projectName, configPath, vrrboseMdPath, daemonPid, daemonError, projectId }));
  } else {
    console.log(`\nVrrbose initialised for "${projectName}"`);
    if (daemonPid) {
      console.log(`Daemon started (pid ${daemonPid})`);
    } else if (daemonError) {
      console.log(`Note: daemon not started — ${daemonError}`);
      console.log('Run `vrrbose start` once the daemon is built.');
    } else {
      console.log('Daemon already running.');
    }
    if (projectId) console.log(`Project registered (${projectId.slice(0, 8)})`);
    console.log('Run `vrrbose status` to check.');
  }
}
