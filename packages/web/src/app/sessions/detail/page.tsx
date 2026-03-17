'use client';
import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { GlobalNav } from '../../../components/GlobalNav';
import { ChapterCard } from '../../../components/ChapterCard';
import { EventChip } from '../../../components/EventChip';
import { api } from '../../../lib/api';
import type { Session, Event } from '@vrrbose/shared';
import type { Capsule } from '../../../lib/api';
import styles from './page.module.css';

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(ms: number) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function CommitDetail({ event, session, allEvents, index, commits }: {
  event: Event;
  session: Session;
  allEvents: Event[];
  index: number;
  commits: Event[];
}) {
  const msg = String(event.payload['message'] ?? '');
  const stat = String(event.payload['stat'] ?? '');
  const hash = String(event.payload['hash'] ?? '').slice(0, 12);
  const author = String(event.payload['author'] ?? '');
  const adds = parseInt(stat.match(/(\d+) insertion/)?.[1] ?? '0', 10);
  const dels = parseInt(stat.match(/(\d+) deletion/)?.[1] ?? '0', 10);

  // Files changed — may or may not be present in payload
  const filesRaw = event.payload['files'];
  const files: string[] = Array.isArray(filesRaw)
    ? (filesRaw as unknown[]).map(String)
    : typeof filesRaw === 'string' && filesRaw
    ? filesRaw.split('\n').filter(Boolean)
    : [];

  const next = commits[index + 1];
  const windowStart = event.timestamp;
  const windowEnd = next?.timestamp ?? (session.endedAt ?? Date.now());
  const windowEvents = allEvents.filter(
    e => e.type !== 'git_commit' && e.timestamp >= windowStart && e.timestamp <= windowEnd,
  );

  return (
    <div className={styles.commitDetail}>
      {/* Commit header */}
      <div className={styles.commitHeader}>
        <div className={styles.commitMsg}>{msg}</div>
        <div className={styles.commitMeta}>
          {hash && <code className={styles.commitHash}>{hash}</code>}
          {author && <span>{author}</span>}
          <span>{formatTime(event.timestamp)}</span>
          {adds > 0 && <span className={styles.adds}>+{adds}</span>}
          {dels > 0 && <span className={styles.dels}>-{dels}</span>}
        </div>
      </div>

      {/* Files changed */}
      {files.length > 0 && (
        <div className={styles.fileList}>
          <div className={styles.fileListLabel}>Files changed</div>
          {files.map((f, i) => (
            <div key={i} className={styles.fileName}><code>{f}</code></div>
          ))}
        </div>
      )}

      {/* No diff notice (metadata_only mode) */}
      {files.length === 0 && (
        <div className={styles.noDiff}>
          <p>Full diff not captured.</p>
          <p>To capture staged diffs, set <code>staged_diffs: enrich_with_ai</code> in <code>VRRBOSE.md</code>.</p>
        </div>
      )}

      {/* Context events in this window */}
      {windowEvents.length > 0 && (
        <div className={styles.windowEvents}>
          <div className={styles.windowEventsLabel}>Context in this window</div>
          {windowEvents.map(e => (
            <div key={e.id} className={styles.windowEvent}>
              <div className={styles.windowEventHeader}>
                <EventChip type={e.type as Parameters<typeof EventChip>[0]['type']} />
                <span className={styles.windowEventTime}>{formatTime(e.timestamp)}</span>
              </div>
              {e.type === 'ai_prompt' && !!e.payload['prompt'] && (
                <blockquote className={styles.aiPrompt}>{String(e.payload['prompt']).slice(0, 280)}{String(e.payload['prompt']).length > 280 ? '…' : ''}</blockquote>
              )}
              {e.type === 'test_run' && (
                <div className={styles.testResult}>
                  {e.payload['passed'] !== undefined && <span className={Boolean(e.payload['failed']) ? styles.testFail : styles.testPass}>{e.payload['passed'] as number} passed{Boolean(e.payload['failed']) ? `, ${e.payload['failed'] as number} failed` : ''}</span>}
                </div>
              )}
              {e.type === 'terminal_command' && !!e.payload['command'] && (
                <code className={styles.termCmd}>{String(e.payload['command']).slice(0, 120)}</code>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionReplayContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const [session, setSession] = useState<Session | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeedMs] = useState(2200);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) { setLoading(false); setError('No session ID provided'); return; }
    api.session(id)
      .then(({ session, events, capsules }) => {
        setSession(session);
        setEvents(events);
        setCapsules(capsules ?? []);
      })
      .catch(e => setError(e instanceof Error ? e.message : 'Failed'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className={styles.loading}>Loading…</div>;
  if (error || !session) return <div className={styles.error}>{error ?? 'Not found'}</div>;

  const commits = events.filter(e => e.type === 'git_commit');
  const active = commits[activeIdx];

  useEffect(() => {
    if (!isPlaying || commits.length <= 1) return;
    const timer = setTimeout(() => {
      setActiveIdx((prev) => {
        if (prev >= commits.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, speedMs);
    return () => clearTimeout(timer);
  }, [isPlaying, speedMs, activeIdx, commits.length]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if (ev.key === 'ArrowRight') {
        ev.preventDefault();
        setActiveIdx((prev) => Math.min(prev + 1, Math.max(0, commits.length - 1)));
      } else if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        setActiveIdx((prev) => Math.max(0, prev - 1));
      } else if (ev.key === ' ') {
        ev.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [commits.length]);

  const durMs = session.endedAt ? session.endedAt - session.startedAt : Date.now() - session.startedAt;
  const sessionDate = new Date(session.startedAt).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <div className={styles.replay}>

        {/* Left: chapters */}
        <aside className={styles.chapters}>
          <div className={styles.chaptersHeader}>
            <div className={styles.chaptersTitle}>{commits.length} chapter{commits.length !== 1 ? 's' : ''}</div>
            <div className={styles.chaptersDate}>{sessionDate} · {formatDuration(durMs)}</div>
            <div className={styles.playbackRow}>
              <button
                className={styles.playBtn}
                onClick={() => setActiveIdx((prev) => Math.max(0, prev - 1))}
                disabled={activeIdx <= 0}
              >
                Prev
              </button>
              <button
                className={styles.playBtn}
                onClick={() => setIsPlaying((prev) => !prev)}
                disabled={commits.length <= 1}
              >
                {isPlaying ? 'Pause' : 'Play'}
              </button>
              <button
                className={styles.playBtn}
                onClick={() => setActiveIdx((prev) => Math.min(prev + 1, Math.max(0, commits.length - 1)))}
                disabled={activeIdx >= commits.length - 1}
              >
                Next
              </button>
            </div>
            <div className={styles.speedRow}>
              <span>Speed</span>
              <select
                className={styles.speedSelect}
                value={speedMs}
                onChange={(e) => setSpeedMs(Number.parseInt(e.target.value, 10))}
              >
                <option value={3200}>Slow</option>
                <option value={2200}>Normal</option>
                <option value={1200}>Fast</option>
              </select>
            </div>
          </div>
          {commits.map((c, i) => {
            const msg = String(c.payload['message'] ?? '');
            const stat = String(c.payload['stat'] ?? '');
            const adds = parseInt(stat.match(/(\d+) insertion/)?.[1] ?? '0', 10);
            const dels = parseInt(stat.match(/(\d+) deletion/)?.[1] ?? '0', 10);
            const next = commits[i + 1];
            const durMs = next
              ? next.timestamp - c.timestamp
              : (session.endedAt ?? Date.now()) - c.timestamp;

            // Count context events in this window
            const windowEvents = events.filter(
              e => e.type !== 'git_commit' &&
                e.timestamp >= c.timestamp &&
                e.timestamp <= (next?.timestamp ?? (session.endedAt ?? Date.now())),
            );
            const eventTypes = ['git_commit', ...new Set(windowEvents.map(e => e.type))];

            return (
              <ChapterCard
                key={c.id}
                index={i + 1}
                message={msg}
                additions={adds}
                deletions={dels}
                timestamp={c.timestamp}
                durationMin={Math.round(durMs / 60000)}
                eventTypes={eventTypes as Parameters<typeof ChapterCard>[0]['eventTypes']}
                active={activeIdx === i}
                onClick={() => setActiveIdx(i)}
              />
            );
          })}

          {commits.length === 0 && (
            <div className={styles.noChapters}>No commits in this session yet.</div>
          )}
        </aside>

        {/* Center: commit detail / diff */}
        <main className={styles.diffPanel}>
          {active ? (
            <CommitDetail
              event={active}
              session={session}
              allEvents={events}
              index={activeIdx}
              commits={commits}
            />
          ) : (
            <div className={styles.emptyDiff}>
              {commits.length > 0 ? 'Select a chapter to view details' : 'No commits captured in this session'}
            </div>
          )}
        </main>

        {/* Right: events timeline */}
        <aside className={styles.whyPanel}>
          <div className={styles.whyTitle}>All events</div>
          {capsules.length > 0 && (
            <div className={styles.capsuleStrip}>
              {capsules.slice(0, 3).map((c) => (
                <div key={c.id} className={styles.capsulePill}>{c.title}</div>
              ))}
            </div>
          )}
          {events.length === 0 && (
            <p className={styles.eventMeta}>No events recorded.</p>
          )}
          {events.map(e => (
            <div key={e.id} className={`${styles.eventRow} ${e.type === 'git_commit' && events.indexOf(e) === commits.indexOf(active) ? styles.eventActive : ''}`}>
              <div className={styles.eventRowHeader}>
                <EventChip type={e.type as Parameters<typeof EventChip>[0]['type']} />
                <span className={styles.eventTime}>{formatTime(e.timestamp)}</span>
              </div>
              {e.type === 'git_commit' && (
                <p className={styles.eventMeta}>{String(e.payload['message'] ?? '').slice(0, 60)}</p>
              )}
              {e.type === 'ai_prompt' && !!e.payload['prompt'] && (
                <p className={styles.eventMeta}>{String(e.payload['prompt']).slice(0, 80)}…</p>
              )}
              {e.type === 'test_run' && (
                <p className={styles.eventMeta}>
                  {e.payload['passed'] !== undefined ? `${e.payload['passed'] as number} passed` : ''}
                  {Boolean(e.payload['failed']) ? `, ${e.payload['failed'] as number} failed` : ''}
                </p>
              )}
            </div>
          ))}
        </aside>
      </div>
    </div>
  );
}

export default function SessionReplayPage() {
  return (
    <Suspense fallback={<div style={{ padding: '2rem', color: 'var(--color-text-muted)' }}>Loading…</div>}>
      <SessionReplayContent />
    </Suspense>
  );
}
