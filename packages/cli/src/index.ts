#!/usr/bin/env node
import { Command } from 'commander';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DAEMON_VERSION } from '@vrrbose/shared';
import { statusCommand } from './commands/status.js';
import { askCommand } from './commands/ask.js';
import { replayCommand } from './commands/replay.js';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';
import { uiCommand } from './commands/ui.js';
import { loginCommand } from './commands/login.js';

function resolveCliVersion(): string {
  try {
    let current = dirname(fileURLToPath(import.meta.url));
    while (true) {
      const pkgPath = join(current, 'package.json');
      if (existsSync(pkgPath)) {
        const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string; version?: string };
        if (pkg.name === 'vrrbose' && typeof pkg.version === 'string' && pkg.version.length > 0) {
          return pkg.version;
        }
      }

      const parent = dirname(current);
      if (parent === current || parse(current).root === current) break;
      current = parent;
    }
  } catch {
    // Fall through to constant fallback.
  }
  return DAEMON_VERSION;
}

const program = new Command();

program
  .name('vrrbose')
  .description('Developer documentation system — archivist for your code')
  .version(resolveCliVersion());

program
  .command('login')
  .description('Sign in to your Vrrbose account')
  .option('--json', 'Output as JSON')
  .action((opts) => loginCommand(opts));

program
  .command('start')
  .description('Start the Vrrbose daemon in the background')
  .option('--path <path>', 'Project path to watch (defaults to cwd)')
  .option('--json', 'Output as JSON')
  .action((opts) => startCommand(opts));

program
  .command('stop')
  .description('Stop the Vrrbose daemon')
  .option('--json', 'Output as JSON')
  .action((opts) => stopCommand(opts));

program
  .command('ui')
  .description('Open the Vrrbose web UI in your browser')
  .option('--json', 'Output URL as JSON')
  .action((opts) => uiCommand(opts));

program
  .command('init')
  .description('Initialise Vrrbose for the current project')
  .option('--json', 'Output as JSON')
  .action((opts) => initCommand(opts));

program
  .command('status')
  .description('Show daemon status and active session')
  .option('--json', 'Output as JSON')
  .action((opts) => statusCommand(opts));

program
  .command('ask <query>')
  .description('Ask the archivist agent a question about your work history')
  .option('--json', 'Output as JSON')
  .action((query, opts) => askCommand(query, opts));

program
  .command('replay [session]')
  .description('List sessions or replay a specific session')
  .option('--open', 'Open in web UI')
  .option('--json', 'Output as JSON')
  .action((session, opts) => replayCommand(session, opts));

program.parse();
