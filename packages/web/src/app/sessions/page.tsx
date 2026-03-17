'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GlobalNav } from '../../components/GlobalNav';
import { EventChip } from '../../components/EventChip';
import { api } from '../../lib/api';
import type { Session } from '@vrrbose/shared';
import styles from './page.module.css';

const PAGE_SIZE = 30;

function getDateGroup(ts: number): string {
  const now = Date.now();
  const DAY = 86400_000;
  const diff = now - ts;
  if (diff < DAY) return 'Today';
  if (diff < 2 * DAY) return 'Yesterday';
  if (diff < 7 * DAY) return 'This week';
  if (diff < 30 * DAY) return 'This month';
  return 'Earlier';
}

function groupSessions(sessions: Session[]): { label: string; sessions: Session[] }[] {
  const groups: Map<string, Session[]> = new Map();
  const order = ['Today', 'Yesterday', 'This week', 'This month', 'Earlier'];
  for (const s of sessions) {
    const g = getDateGroup(s.startedAt);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(s);
  }
  return order.filter(l => groups.has(l)).map(l => ({ label: l, sessions: groups.get(l)! }));
}

function scoreBadgeClass(score: number): string {
  if (score >= 80) return styles.scoreGreen;
  if (score >= 60) return styles.scoreAmber;
  return styles.scoreRed;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'completed' | 'orphaned'>('all');
  const [query, setQuery] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.sessions(PAGE_SIZE, 0), api.status()])
      .then(([s, status]) => {
        setSessions(s);
        setHasMore(s.length === PAGE_SIZE);
        setActiveSessionId(status.activeSession?.id ?? null);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      api.status().then((status) => {
        setActiveSessionId(status.activeSession?.id ?? null);
      }).catch(() => {});
    }, 30000);
    return () => clearInterval(id);
  }, []);

  async function loadMore() {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const next = await api.sessions(PAGE_SIZE, sessions.length);
      setSessions((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  const q = query.trim().toLowerCase();
  const filteredSessions = sessions.filter((s) => {
    const isActive = s.id === activeSessionId;
    const isOrphaned = !s.endedAt && !isActive;
    if (statusFilter === 'active' && !isActive) return false;
    if (statusFilter === 'completed' && !s.endedAt) return false;
    if (statusFilter === 'orphaned' && !isOrphaned) return false;

    if (!q) return true;
    const hay = `${s.id} ${s.summary ?? ''} ${s.commitCount} ${s.fileChurn}`.toLowerCase();
    return hay.includes(q);
  });

  const maxDuration = Math.max(...filteredSessions.map(s => s.endedAt ? s.endedAt - s.startedAt : 0), 1);
  const grouped = groupSessions(filteredSessions);

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main className={styles.main}>
        <h1 className={styles.heading}>Sessions</h1>
        <div className={styles.controls}>
          <input
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by summary, id, stats..."
          />
          <select
            className={styles.filter}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'completed' | 'orphaned')}
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="orphaned">Orphaned</option>
          </select>
        </div>
        {loading && <p className={styles.muted}>Loading…</p>}
        {error && <p className={styles.error}>{error}</p>}
        {!loading && !error && filteredSessions.length === 0 && (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No sessions yet</p>
            <p className={styles.muted}>Start the daemon and make some commits to begin capturing sessions.</p>
            <code className={styles.emptyCode}>vrrbose start</code>
          </div>
        )}
        {grouped.map(group => (
          <div key={group.label} className={styles.group}>
            <div className={styles.groupLabel}>{group.label}</div>
            <div className={styles.groupList}>
              {group.sessions.map(s => (
                <SessionRow
                  key={s.id}
                  session={s}
                  isActive={s.id === activeSessionId}
                  maxDuration={maxDuration}
                />
              ))}
            </div>
          </div>
        ))}

        {!loading && !error && hasMore && (
          <div className={styles.loadMoreWrap}>
            <button className={styles.loadMoreBtn} onClick={() => loadMore()} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function SessionRow({ session: s, isActive, maxDuration }: { session: Session; isActive: boolean; maxDuration: number }) {
  const date = new Date(s.startedAt);
  const durMs = s.endedAt ? s.endedAt - s.startedAt : 0;
  const durMin = durMs ? Math.round(durMs / 60000) : null;
  const durationPct = durMs ? Math.round((durMs / maxDuration) * 100) : 0;
  const isOrphaned = !s.endedAt && !isActive;

  return (
    <div className={styles.row}>
      <div className={styles.rowMain}>
        <div className={styles.rowHeader}>
          <span className={styles.dateLabel}>
            {date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {durMin !== null && <span className={styles.dur}>{durMin}m</span>}
          {isActive && <EventChip type="session_open" />}
          {isOrphaned && <span className={styles.orphaned}>orphaned</span>}
        </div>
        <div className={styles.rowMeta}>
          {s.commitCount > 0 && <span>{s.commitCount} commits</span>}
          {s.fileChurn > 0 && <span>{s.fileChurn} lines</span>}
        </div>
        {durationPct > 0 && (
          <div className={styles.durationTrack}>
            <div className={styles.durationBar} style={{ width: `${durationPct}%` }} />
          </div>
        )}
      </div>
      <div className={styles.rowRight}>
        {s.score !== null && (
          <span className={`${styles.scoreBadge} ${scoreBadgeClass(s.score)}`}>
            {s.score.toFixed(0)}
          </span>
        )}
        <Link href={`/sessions/detail?id=${s.id}`} className={styles.link}>Replay →</Link>
      </div>
    </div>
  );
}
