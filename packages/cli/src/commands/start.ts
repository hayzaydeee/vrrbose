import chalk from 'chalk';
import { isDaemonRunning, spawnDaemon, LOG_PATH } from '../daemon.js';
import { DAEMON_PORT } from '@vrrbose/shared';

async function waitForReady(timeoutMs = 10_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${DAEMON_PORT}/health`);
      if (res.ok) return true;
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
}

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
    const ready = await waitForReady();
    if (opts.json) {
      console.log(JSON.stringify({ ok: true, pid, ready, log: LOG_PATH }));
    } else {
      const isTTY = process.stdout.isTTY;
      console.log(isTTY ? chalk.green('Daemon started') + ` (pid ${pid})` : `Daemon started (pid ${pid})`);
      console.log(`  Logs : ${LOG_PATH}`);
      console.log(`  Run \`vrrbose init\` in any project to start tracking it.`);
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
