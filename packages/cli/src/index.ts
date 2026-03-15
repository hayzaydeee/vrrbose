#!/usr/bin/env node
import { Command } from 'commander';
import { DAEMON_VERSION } from '@vrrbose/shared';
import { statusCommand } from './commands/status.js';
import { askCommand } from './commands/ask.js';
import { replayCommand } from './commands/replay.js';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { stopCommand } from './commands/stop.js';

const program = new Command();

program
  .name('vrrbose')
  .description('Developer documentation system — archivist for your code')
  .version(DAEMON_VERSION);

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
