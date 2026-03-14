import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

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

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, projectName, configPath, vrrboseMdPath }));
  } else {
    console.log(`\nVrrbose initialised for "${projectName}"`);
    console.log('Run `vrrbose status` after starting the daemon.');
  }
}
