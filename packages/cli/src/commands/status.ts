import chalk from 'chalk';
import { getStatus } from '../client.js';

function sparkline(values: number[]): string {
  const bars = '▁▂▃▄▅▆▇█';
  if (values.length === 0) return '';
  const max = Math.max(...values, 1);
  return values.map(v => bars[Math.floor((v / max) * (bars.length - 1))] ?? '▁').join('');
}

export async function statusCommand(opts: { json?: boolean }): Promise<void> {
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
    console.log(`  Project  : ${status.projectId.slice(0, 8)}`);
    console.log(`  Events   : ${status.eventCount}`);
    console.log(`  Sessions : ${status.sessionCount}`);

    if (status.activeSession) {
      const s = status.activeSession;
      const dur = Math.round((Date.now() - s.startedAt) / 60000);
      console.log('\n' + c('Active session', chalk.cyan));
      console.log(`  Duration : ${dur}m`);
      console.log(`  Commits  : ${s.commitCount}`);
      console.log(`  Churn    : ${s.fileChurn} lines`);
    } else {
      console.log('\n' + c('No active session', chalk.dim));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(process.stdout.isTTY ? chalk.red('Error: ') + msg : `Error: ${msg}`);
    process.exit(2);
  }
}
