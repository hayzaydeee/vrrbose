import { SESSION_DEFAULTS } from '@vrrbose/shared';

export interface SessionMetrics {
  commitCount: number;
  activeTimeMs: number;
  fileChurn: number; // lines changed
}

const WEIGHTS = SESSION_DEFAULTS.SCORE_WEIGHTS;

/**
 * Score a session 0–100 based on commit activity, active time, and file churn.
 * Higher score = more productive / significant session.
 */
export function scoreSession(metrics: SessionMetrics): number {
  const activeHours = metrics.activeTimeMs / (1000 * 60 * 60);

  const raw =
    metrics.commitCount * WEIGHTS.commitCount +
    activeHours * WEIGHTS.activeTimeHours +
    metrics.fileChurn * WEIGHTS.fileChurnLines;

  // Clamp to 0–100
  return Math.min(100, Math.max(0, raw));
}
