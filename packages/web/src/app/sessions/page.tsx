'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GlobalNav } from '../../components/GlobalNav';
import { EventChip } from '../../components/EventChip';
import { api } from '../../lib/api';
import type { Session } from '@vrrbose/shared';
import styles from './page.module.css';

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.sessions(50), api.status()])
      .then(([s, status]) => {
        setSessions(s);
        setActiveSessionId(status.activeSession?.id ?? null);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main className={styles.main}>
        <h1 className={styles.heading}>Sessions</h1>
        {loading && <p className={styles.muted}>Loading...</p>}
        {error && <p className={styles.error}>{error}</p>}
        {!loading && !error && sessions.length === 0 && (
          <p className={styles.muted}>No sessions yet. Start the daemon and make some commits.</p>
        )}
        <div className={styles.list}>
          {sessions.map(s => <SessionRow key={s.id} session={s} isActive={s.id === activeSessionId} />)}
        </div>
      </main>
    </div>
  );
}

function SessionRow({ session: s, isActive }: { session: Session; isActive: boolean }) {
  const date = new Date(s.startedAt);
  const dur = s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : null;
  const dateLabel = date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLabel = date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  const isOrphaned = !s.endedAt && !isActive;
  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.dateLabel}>{dateLabel}, {timeLabel}</span>
        {dur !== null && <span className={styles.dur}>{dur}m</span>}
        {isActive && <EventChip type="session_open" />}
        {isOrphaned && <span className={styles.orphaned}>orphaned</span>}
      </div>
      <div className={styles.rowMeta}>
        {s.commitCount > 0 && <span>{s.commitCount} commits</span>}
        {s.fileChurn > 0 && <span>{s.fileChurn} lines</span>}
        {s.score !== null && <span>score {s.score.toFixed(0)}</span>}
      </div>
      <Link href={`/sessions/detail?id=${s.id}`} className={styles.link}>View replay →</Link>
    </div>
  );
}
