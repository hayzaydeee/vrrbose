import { SESSION_DEFAULTS } from '@vrrbose/shared';

export interface SessionMetrics {
  commitCount: number;
  activeTimeMs: number;
  fileChurn: number; // lines changed
  terminalCommandCount?: number;
  testRunCount?: number;
  aiPromptCount?: number;
}

const WEIGHTS = SESSION_DEFAULTS.SCORE_WEIGHTS;

/**
 * Score a session 0–100 based on commit activity, active time, and file churn.
 * Higher score = more productive / significant session.
 */
export function scoreSession(metrics: SessionMetrics): number {
  const activeHours = metrics.activeTimeMs / (1000 * 60 * 60);
  const commandPoints = Math.min(5, (metrics.terminalCommandCount ?? 0) * 0.1);
  const testPoints = Math.min(10, (metrics.testRunCount ?? 0) * 2);
  const promptPoints = Math.min(5, (metrics.aiPromptCount ?? 0) * 0.5);

  const raw =
    metrics.commitCount * WEIGHTS.commitCount +
    activeHours * WEIGHTS.activeTimeHours +
    metrics.fileChurn * WEIGHTS.fileChurnLines +
    commandPoints +
    testPoints +
    promptPoints;

  // Clamp to 0–100
  return Math.min(100, Math.max(0, raw));
}
