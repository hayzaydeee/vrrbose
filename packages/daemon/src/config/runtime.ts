import { DAEMON_PORT } from '@vrrbose/shared';

export interface RuntimeConfig {
  port: number;
  initialProjectPath: string | undefined;
  mcpEnabled: boolean;
}

function parsePort(value: string | undefined): number {
  if (!value) return DAEMON_PORT;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1024 || parsed > 65535) {
    console.warn(`[config] invalid VRRBOSE_PORT=${value}; using ${DAEMON_PORT}`);
    return DAEMON_PORT;
  }
  return parsed;
}

export function loadRuntimeConfig(): RuntimeConfig {
  const rawProjectPath = process.env['VRRBOSE_PROJECT_PATH']?.trim();
  return {
    port: parsePort(process.env['VRRBOSE_PORT']),
    initialProjectPath: rawProjectPath && rawProjectPath.length > 0 ? rawProjectPath : undefined,
    mcpEnabled: process.env['VRRBOSE_MCP'] === '1',
  };
}
