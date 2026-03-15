import chalk from 'chalk';
import { getStatus } from '../client.js';
import { isDaemonRunning } from '../daemon.js';

function sparkline(values: number[]): string {
  const bars = '▁▂▃▄▅▆▇█';
  if (values.length === 0) return '';
  const max = Math.max(...values, 1);
  return values.map(v => bars[Math.floor((v / max) * (bars.length - 1))] ?? '▁').join('');
}

export async function statusCommand(opts: { json?: boolean }): Promise<void> {
  if (!isDaemonRunning()) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, running: false, error: 'Daemon not running' }));
    } else {
      const isTTY = process.stdout.isTTY;
      const msg = isTTY
        ? chalk.dim('Daemon not running.') + ' Run ' + chalk.cyan('vrrbose start') + ' to start it.'
        : 'Daemon not running. Run `vrrbose start` to start it.';
      console.log(msg);
    }
    process.exit(1);
  }

  try {
    const status = await getStatus();

    if (opts.json) {
      console.log(JSON.stringify(status, null, 2));
      return;
    }

    const isTTY = process.stdout.isTTY;
    const c = (s: string, fn: (s: string) => string) => isTTY ? fn(s) : s;

    console.log(c('Vrrbose daemon', chalk.bold) + c(' running', chalk.green));
    console.log(`  Version  : ${status.version}`);
    console.log(`  Uptime   : ${Math.round(status.uptime / 60000)}m`);

    const projects = status.projects ?? [];
    if (projects.length === 0) {
      console.log('\n' + c('No projects watched', chalk.dim) + '  Run ' + c('vrrbose init', chalk.cyan) + ' in a project to start tracking it.');
    } else {
      for (const p of projects) {
        console.log('\n' + c(p.projectName, chalk.bold));
        console.log(`  ID       : ${p.projectId.slice(0, 8)}`);
        console.log(`  Events   : ${p.eventCount}`);
        console.log(`  Sessions : ${p.sessionCount}`);
        if (p.activeSession) {
          const s = p.activeSession;
          const dur = Math.round((Date.now() - s.startedAt) / 60000);
          console.log('  ' + c('● active', chalk.green) + `  ${dur}m  ${s.commitCount} commits  ${s.fileChurn} lines churn`);
        } else {
          console.log('  ' + c('○ idle', chalk.dim));
        }
      }
    }

    const sync = (status as unknown as Record<string, unknown>)['sync'] as { loggedIn: boolean; pendingEvents: number; pendingSessions: number } | undefined;
    if (sync) {
      console.log('');
      if (sync.loggedIn) {
        const pending = sync.pendingEvents + sync.pendingSessions;
        if (pending === 0) {
          console.log('  ' + c('↑ synced', chalk.green));
        } else {
          console.log('  ' + c(`↑ ${pending} pending sync`, chalk.yellow));
        }
      } else {
        console.log('  ' + c('↑ not logged in', chalk.dim) + '  Run ' + c('vrrbose login', chalk.cyan) + ' to sync to cloud.');
      }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(process.stdout.isTTY ? chalk.red('Error: ') + msg : `Error: ${msg}`);
    process.exit(2);
  }
}
