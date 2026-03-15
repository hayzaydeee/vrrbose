import { spawn, execSync } from 'node:child_process';
import { openSync, readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { createRequire } from 'node:module';

const VRRBOSE_DIR = join(homedir(), '.vrrbose');
export const PID_PATH = join(VRRBOSE_DIR, 'daemon.pid');
export const LOG_PATH = join(VRRBOSE_DIR, 'daemon.log');

export function readPid(): number | null {
  if (!existsSync(PID_PATH)) return null;
  const n = parseInt(readFileSync(PID_PATH, 'utf8').trim(), 10);
  return isNaN(n) ? null : n;
}

export function writePid(pid: number): void {
  writeFileSync(PID_PATH, String(pid), 'utf8');
}

export function isDaemonRunning(): boolean {
  const pid = readPid();
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function findDaemonEntry(): { cmd: string; args: string[] } {
  const override = process.env['VRRBOSE_DAEMON_SCRIPT'];
  if (override) {
    return override.endsWith('.ts')
      ? { cmd: 'tsx', args: [override] }
      : { cmd: process.execPath, args: [override] };
  }

  const req = createRequire(import.meta.url);
  let resolved: string;
  try {
    resolved = req.resolve('@vrrbose/daemon');
  } catch {
    throw new Error('Cannot find @vrrbose/daemon. Run `pnpm build --filter @vrrbose/daemon` first.');
  }

  if (!existsSync(resolved)) {
    throw new Error(`Daemon entry not found at ${resolved}. Run \`pnpm build --filter @vrrbose/daemon\` first.`);
  }

  return { cmd: process.execPath, args: [resolved] };
}

function loadGlobalEnv(): Record<string, string> {
  const envPath = join(VRRBOSE_DIR, '.env');
  if (!existsSync(envPath)) return {};
  const env: Record<string, string> = {};
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m?.[1] && m[2] !== undefined) env[m[1]] = m[2];
  }
  return env;
}

export function spawnDaemon(projectPath: string): number {
  mkdirSync(VRRBOSE_DIR, { recursive: true });
  const { cmd, args } = findDaemonEntry();
  const logFd = openSync(LOG_PATH, 'a');
  const child = spawn(cmd, args, {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      ...loadGlobalEnv(),
      VRRBOSE_PROJECT_PATH: projectPath,
    },
  });
  child.unref();
  if (!child.pid) throw new Error('Failed to spawn daemon process (no pid assigned).');
  writePid(child.pid);
  return child.pid;
}

export function killDaemon(pid: number): void {
  try {
    if (process.platform === 'win32') {
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(pid, 'SIGTERM');
    }
  } catch {
    // Process may already be gone
  }
}
