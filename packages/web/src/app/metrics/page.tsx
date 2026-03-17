'use client';
import { useEffect, useState } from 'react';
import { GlobalNav } from '../../components/GlobalNav';
import { MetricsChart } from '../../components/MetricsChart';
import { api } from '../../lib/api';
import type { Session } from '@vrrbose/shared';
import styles from './page.module.css';

function formatActiveTime(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function MetricsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.sessions(90).then(s => { setSessions(s); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const DAY = 86400_000;
  const now = Date.now();

  // 28-day window
  const sessions28 = sessions.filter(s => s.startedAt >= now - 28 * DAY);
  const totalCommits = sessions28.reduce((n, s) => n + s.commitCount, 0);
  const totalActiveMs = sessions28.reduce((n, s) => n + (s.activeTimeMs ?? 0), 0);
  const scores = sessions28.filter(s => s.score !== null).map(s => s.score as number);
  const avgScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  // Commits per day — last 14 days
  const commitDayLabels = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * DAY);
    return d.toLocaleDateString('en', { weekday: 'narrow' });
  });
  const commitsByDay14 = Array.from({ length: 14 }, (_, i) => {
    const s = now - (13 - i) * DAY;
    return sessions.filter(x => x.startedAt >= s && x.startedAt < s + DAY)
      .reduce((sum, x) => sum + x.commitCount, 0);
  });

  // Session scores — last 20 sessions
  const recent20 = sessions.slice(0, 20);
  const sessionScores = recent20.map(s => s.score ?? 0);

  // Session durations — last 14 sessions
  const recent14 = sessions.slice(0, 14);
  const sessionDurations = recent14.map(s =>
    s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : 0,
  );
  const sessionDurationLabels = recent14.map(s =>
    new Date(s.startedAt).toLocaleDateString('en', { weekday: 'narrow' }),
  ).reverse();

  function scoreColor(v: number): 'green' | 'amber' | 'red' | 'default' {
    if (v === 0) return 'default';
    if (v >= 80) return 'green';
    if (v >= 60) return 'amber';
    return 'red';
  }

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main id="main-content" tabIndex={-1} className={styles.main}>
        <h1 className={styles.heading}>Metrics</h1>

        {loading && <p className={styles.muted}>Loading…</p>}

        {!loading && (
          <>
            {/* Stat cards */}
            <div className={styles.statRow}>
              <div className={styles.statCard}>
                <div className={styles.statNum}>{sessions28.length}</div>
                <div className={styles.statLabel}>sessions</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statNum}>{totalCommits}</div>
                <div className={styles.statLabel}>commits</div>
              </div>
              <div className={styles.statCard}>
                <div className={styles.statNum}>{formatActiveTime(totalActiveMs)}</div>
                <div className={styles.statLabel}>active time</div>
              </div>
              {avgScore !== null && (
                <div className={styles.statCard}>
                  <div className={styles.statNum}>{avgScore}</div>
                  <div className={styles.statLabel}>avg score</div>
                </div>
              )}
            </div>

            <div className={styles.period}>Last 28 days</div>

            {/* Charts */}
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Commits per day — last 14 days</div>
              <MetricsChart
                values={commitsByDay14}
                labels={commitDayLabels}
                label="commits"
                height={100}
              />
            </div>

            {sessions.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Session scores — last {recent20.length} sessions</div>
                <MetricsChart
                  values={sessionScores}
                  label="score (0–100)"
                  colorFn={scoreColor}
                  height={100}
                />
              </div>
            )}

            {sessions.length > 0 && (
              <div className={styles.section}>
                <div className={styles.sectionTitle}>Session durations — last {recent14.length} sessions (minutes)</div>
                <MetricsChart
                  values={sessionDurations}
                  labels={sessionDurationLabels}
                  label="minutes"
                  height={100}
                />
              </div>
            )}

            {sessions.length === 0 && (
              <div className={styles.empty}>
                <p>No session data yet.</p>
                <p>Start the daemon and make some commits to begin seeing metrics.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
