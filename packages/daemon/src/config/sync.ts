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

export function loadSyncWorkerConfig(): SyncWorkerConfig {
  const baseIntervalMs = parsePositiveInt('VRRBOSE_SYNC_BASE_INTERVAL_MS', 30_000);
  const maxBackoffMs = Math.max(baseIntervalMs, parsePositiveInt('VRRBOSE_SYNC_MAX_BACKOFF_MS', 3_600_000));
  const circuitOpenMs = parsePositiveInt('VRRBOSE_SYNC_CIRCUIT_OPEN_MS', 300_000);
  const failureThreshold = parsePositiveInt('VRRBOSE_SYNC_FAILURE_THRESHOLD', 5);
  const batchSize = parsePositiveInt('VRRBOSE_SYNC_BATCH_SIZE', 200);

  return {
    apiUrl: process.env['VRRBOSE_API_URL'] ?? 'https://api.vrrbose.dev',
    baseIntervalMs,
    maxBackoffMs,
    circuitOpenMs,
    failureThreshold,
    batchSize,
  };
}
