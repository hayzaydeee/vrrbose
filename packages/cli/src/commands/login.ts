import { randomBytes } from 'node:crypto';
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const VRRBOSE_DIR = join(homedir(), '.vrrbose');
const ENV_PATH    = join(VRRBOSE_DIR, '.env');
const APP_URL     = process.env['VRRBOSE_APP_URL'] ?? 'https://vrrbose.dev';
const API_URL     = process.env['VRRBOSE_API_URL'] ?? 'https://api.vrrbose.dev';
const POLL_MS     = 2000;
const TIMEOUT_MS  = 5 * 60 * 1000; // 5 minutes

export async function loginCommand(opts: { json?: boolean }) {
  const deviceId = randomBytes(16).toString('hex');
  const loginUrl = `${APP_URL}/auth/cli?device_id=${deviceId}`;

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, url: loginUrl, device_id: deviceId }));
  } else {
    console.log('\nOpening Vrrbose in your browser...');
    console.log(`\n  ${loginUrl}\n`);
    console.log('If the browser did not open, paste the URL above manually.\n');
  }

  // Open browser
  const { spawn } = await import('node:child_process');
  const opener = process.platform === 'win32' ? 'cmd' :
    process.platform === 'darwin' ? 'open' : 'xdg-open';
  const args = process.platform === 'win32' ? ['/c', 'start', loginUrl] : [loginUrl];
  spawn(opener, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();

  // Poll for token
  const deadline = Date.now() + TIMEOUT_MS;
  process.stdout.write('Waiting for authentication');

  while (Date.now() < deadline) {
    await sleep(POLL_MS);
    process.stdout.write('.');

    try {
      const res = await fetch(`${API_URL}/auth/device?device_id=${deviceId}`);
      if (!res.ok) continue;

      const data = await res.json() as { token?: string; error?: string };
      if (!data.token) continue;

      // Save token to ~/.vrrbose/.env
      mkdirSync(VRRBOSE_DIR, { recursive: true });
      const existing = existsSync(ENV_PATH) ? readFileSync(ENV_PATH, 'utf8') : '';
      const updated  = setEnvVar(existing, 'VRRBOSE_TOKEN', data.token);
      writeFileSync(ENV_PATH, updated, 'utf8');

      process.stdout.write('\n');
      if (opts.json) {
        console.log(JSON.stringify({ ok: true, authenticated: true }));
      } else {
        console.log('\n✓ Authenticated. Token saved to ~/.vrrbose/.env\n');
      }
      return;
    } catch {
      // Network error — keep polling
    }
  }

  process.stdout.write('\n');
  if (opts.json) {
    console.log(JSON.stringify({ ok: false, error: 'Authentication timed out' }));
  } else {
    console.error('\n✗ Authentication timed out. Run `vrrbose login` to try again.\n');
  }
  process.exit(1);
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function setEnvVar(content: string, key: string, value: string): string {
  const line = `${key}=${value}`;
  const regex = new RegExp(`^${key}=.*$`, 'm');
  return regex.test(content)
    ? content.replace(regex, line)
    : content + (content.endsWith('\n') || !content ? '' : '\n') + line + '\n';
}
