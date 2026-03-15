import chalk from 'chalk';
import { existsSync, unlinkSync } from 'node:fs';
import { isDaemonRunning, readPid, killDaemon, PID_PATH } from '../daemon.js';

export async function stopCommand(opts: { json?: boolean }): Promise<void> {
  const pid = readPid();

  if (!isDaemonRunning()) {
    if (existsSync(PID_PATH)) unlinkSync(PID_PATH);
    if (opts.json) {
      console.log(JSON.stringify({ ok: true, alreadyStopped: true }));
    } else {
      console.log('Daemon is not running.');
    }
    return;
  }

  try {
    killDaemon(pid!);

    // Wait up to 3s for process to exit
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 100));
      try { process.kill(pid!, 0); } catch { break; }
    }

    if (existsSync(PID_PATH)) unlinkSync(PID_PATH);

    if (opts.json) {
      console.log(JSON.stringify({ ok: true, pid }));
    } else {
      console.log(process.stdout.isTTY ? chalk.green('Daemon stopped.') : 'Daemon stopped.');
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
