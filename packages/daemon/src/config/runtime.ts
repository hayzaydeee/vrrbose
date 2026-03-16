import { DAEMON_PORT } from '@vrrbose/shared';
import { getConfigValue, loadMergedConfig } from './source.js';

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
  const projectPath = rawProjectPath && rawProjectPath.length > 0 ? rawProjectPath : undefined;
  const mergedConfig = loadMergedConfig(projectPath);

  const configuredDaemonPort = getConfigValue<number>(mergedConfig, ['daemon', 'port']);
  const configuredMcpEnabled = getConfigValue<boolean>(mergedConfig, ['mcp_server', 'enabled']);
  const fallbackPort = Number.isFinite(configuredDaemonPort) ? configuredDaemonPort : DAEMON_PORT;

  return {
    port: parsePort(process.env['VRRBOSE_PORT'] ?? String(fallbackPort)),
    initialProjectPath: projectPath,
    mcpEnabled: process.env['VRRBOSE_MCP'] === '1'
      ? true
      : (configuredMcpEnabled ?? false),
  };
}
