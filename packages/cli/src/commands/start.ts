import chalk from 'chalk';
import { isDaemonRunning, spawnDaemon, LOG_PATH } from '../daemon.js';

export async function startCommand(opts: { json?: boolean; path?: string }): Promise<void> {
  if (isDaemonRunning()) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: true, alreadyRunning: true }));
    } else {
      console.log(process.stdout.isTTY ? chalk.green('Daemon already running.') : 'Daemon already running.');
    }
    return;
  }

  const projectPath = opts.path ?? process.cwd();
  try {
    const pid = spawnDaemon(projectPath);
    if (opts.json) {
      console.log(JSON.stringify({ ok: true, pid, projectPath, log: LOG_PATH }));
    } else {
      const isTTY = process.stdout.isTTY;
      console.log(isTTY ? chalk.green('Daemon started') + ` (pid ${pid})` : `Daemon started (pid ${pid})`);
      console.log(`  Project : ${projectPath}`);
      console.log(`  Logs    : ${LOG_PATH}`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: msg }));
    } else {
      console.error(process.stdout.isTTY ? chalk.red('Error: ') + msg : `Error: ${msg}`);
    }
    process.exit(2);
  }
}
