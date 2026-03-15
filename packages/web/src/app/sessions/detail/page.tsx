'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GlobalNav } from '../../../components/GlobalNav';
import { ChapterCard } from '../../../components/ChapterCard';
import { DiffViewer } from '../../../components/DiffViewer';
import { EventChip } from '../../../components/EventChip';
import { api } from '../../../lib/api';
import type { Session, Event } from '@vrrbose/shared';
import styles from './page.module.css';

function SessionReplayContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setLoading(false); setError('No session ID provided'); return; }
    api.session(id)
      .then(({ session, events }) => { setSession(session); setEvents(events); })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (error || !session) return <div className={styles.error}>{error ?? 'Not found'}</div>;

  const commits = events.filter(e => e.type === 'git_commit');
  const active = commits[activeIdx];

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <div className={styles.replay}>
        <aside className={styles.chapters}>
          <div className={styles.chaptersHeader}>
            <span className={styles.chaptersTitle}>{commits.length} chapters</span>
          </div>
          {commits.map((c, i) => {
            const msg = String(c.payload['message'] ?? '');
            const stat = String(c.payload['stat'] ?? '');
            const adds = parseInt(stat.match(/(\d+) insertion/)?.[1] ?? '0', 10);
            const dels = parseInt(stat.match(/(\d+) deletion/)?.[1] ?? '0', 10);
            const next = commits[i + 1];
            const durMs = next ? next.timestamp - c.timestamp : (session.endedAt ?? Date.now()) - c.timestamp;
            return (
              <ChapterCard key={c.id} index={i + 1} message={msg} additions={adds} deletions={dels}
                timestamp={c.timestamp} durationMin={Math.round(durMs / 60000)}
                eventTypes={['git_commit']} active={activeIdx === i} onClick={() => setActiveIdx(i)} />
            );
          })}
        </aside>

        <main className={styles.diffPanel}>
          {active
            ? <DiffViewer filePath={String(active.payload['hash'] ?? '').slice(0, 8)} additions={0} deletions={0} />
            : <div className={styles.emptyDiff}>Select a chapter to view the diff</div>
          }
        </main>

        <aside className={styles.whyPanel}>
          <div className={styles.whyTitle}>Events</div>
          {active && (
            <>
              <EventChip type="git_commit" />
              <p className={styles.eventMeta}>{String(active.payload['message'] ?? '').slice(0, 80)}</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

export default function SessionReplayPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading...</div>}>
      <SessionReplayContent />
    </Suspense>
  );
}
