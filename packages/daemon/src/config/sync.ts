import { getConfigValue, loadMergedConfig } from './source.js';

export interface SyncWorkerConfig {
  apiUrl: string;
  baseIntervalMs: number;
  maxBackoffMs: number;
  circuitOpenMs: number;
  failureThreshold: number;
  batchSize: number;
}

function parsePositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    console.warn(`[config] invalid ${name}=${raw}; using ${fallback}`);
    return fallback;
  }

  return parsed;
}

function parsePositiveNumber(value: unknown): number | undefined {
  if (typeof value !== 'number') return undefined;
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return value;
}

export function loadSyncWorkerConfig(projectPath?: string): SyncWorkerConfig {
  const mergedConfig = loadMergedConfig(projectPath);
  const configuredSyncMinutes = parsePositiveNumber(getConfigValue<number>(mergedConfig, ['cloud', 'sync_interval_minutes']));
  const configuredRetryDelaySeconds = parsePositiveNumber(getConfigValue<number>(mergedConfig, ['daemon', 'sync_retry_delay_seconds']));
  const configuredRetryAttempts = parsePositiveNumber(getConfigValue<number>(mergedConfig, ['daemon', 'sync_retry_attempts']));
  const configuredBatchSize = parsePositiveNumber(getConfigValue<number>(mergedConfig, ['daemon', 'sync_batch_size']));
  const configuredSyncEndpoint = getConfigValue<string>(mergedConfig, ['cloud', 'sync_endpoint']);

  const fallbackBaseIntervalMs = configuredSyncMinutes
    ? Math.max(1000, Math.floor(configuredSyncMinutes * 60_000))
    : 30_000;

  const fallbackCircuitOpenMs = configuredRetryDelaySeconds
    ? Math.max(1000, Math.floor(configuredRetryDelaySeconds * 1000))
    : 300_000;

  const fallbackFailureThreshold = configuredRetryAttempts
    ? Math.max(1, Math.floor(configuredRetryAttempts))
    : 5;

  const baseIntervalMs = parsePositiveInt('VRRBOSE_SYNC_BASE_INTERVAL_MS', fallbackBaseIntervalMs);
  const maxBackoffMs = Math.max(baseIntervalMs, parsePositiveInt('VRRBOSE_SYNC_MAX_BACKOFF_MS', 3_600_000));
  const circuitOpenMs = parsePositiveInt('VRRBOSE_SYNC_CIRCUIT_OPEN_MS', fallbackCircuitOpenMs);
  const failureThreshold = parsePositiveInt('VRRBOSE_SYNC_FAILURE_THRESHOLD', fallbackFailureThreshold);
  const batchSize = parsePositiveInt('VRRBOSE_SYNC_BATCH_SIZE', configuredBatchSize ? Math.floor(configuredBatchSize) : 200);
  const apiUrlFromConfig = typeof configuredSyncEndpoint === 'string' && configuredSyncEndpoint.length > 0
    ? configuredSyncEndpoint
    : 'https://api.vrrbose.dev';

  return {
    apiUrl: process.env['VRRBOSE_API_URL'] ?? apiUrlFromConfig,
    baseIntervalMs,
    maxBackoffMs,
    circuitOpenMs,
    failureThreshold,
    batchSize,
  };
}
