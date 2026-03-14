'use client';
import { useEffect, useState } from 'react';
import { GlobalNav } from '../../components/GlobalNav';
import { SparkBar } from '../../components/SparkBar';
import { api } from '../../lib/api';
import type { Session } from '@vrrbose/shared';
import styles from './page.module.css';

export default function MetricsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);

  useEffect(() => { api.sessions(28).then(setSessions).catch(() => {}); }, []);

  const DAY = 86400_000;
  const now = Date.now();
  const commitsByDay = Array.from({ length: 7 }, (_, i) => {
    const s = now - (6 - i) * DAY;
    return sessions.filter(x => x.startedAt >= s && x.startedAt < s + DAY)
      .reduce((sum, x) => sum + x.commitCount, 0);
  });

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main className={styles.main}>
        <h1 className={styles.heading}>Metrics</h1>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Commits / day — last 7 days</h2>
          <SparkBar values={commitsByDay} label="commits per day" />
        </section>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Session scores</h2>
          <SparkBar values={sessions.slice(0, 14).map(s => s.score ?? 0)} label="session score" />
        </section>
      </main>
    </div>
  );
}
