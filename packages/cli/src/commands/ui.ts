import chalk from 'chalk';
import { isDaemonRunning } from '../daemon.js';
import { DAEMON_PORT } from '@vrrbose/shared';

export async function uiCommand(opts: { json?: boolean }): Promise<void> {
  if (!isDaemonRunning()) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: 'Daemon not running' }));
    } else {
      console.log('Daemon not running. Run `vrrbose start` first.');
    }
    process.exit(1);
  }

  const url = `http://localhost:${DAEMON_PORT}/ui/`;

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, url }));
    return;
  }

  console.log(process.stdout.isTTY ? chalk.cyan(url) : url);

  // Open in default browser
  const { spawn } = await import('node:child_process');
  const opener = process.platform === 'win32' ? 'cmd' :
    process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', url] : [url];
  spawn(opener, args, { detached: true, stdio: 'ignore' }).unref();
}
