'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GlobalNav } from '../../components/GlobalNav';
import { SparkBar } from '../../components/SparkBar';
import { EventChip } from '../../components/EventChip';
import { StatusBadge } from '../../components/StatusBadge';
import { useAppStore } from '../../lib/store';
import { api } from '../../lib/api';
import type { StatusResponse, Session } from '@vrrbose/shared';
import styles from './page.module.css';

export default function DashboardPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [daemonError, setDaemonError] = useState(false);
  const [activeProjectName, setActiveProjectName] = useState<string>('vrrbose');
  const { setDaemonOnline, setActiveSession } = useAppStore();

  useEffect(() => {
    api.status()
      .then(s => {
        setStatus(s);
        setDaemonOnline(true);
        setActiveSession(s.activeSession);
        setDaemonError(false);
      })
      .catch(() => {
        setDaemonOnline(false);
        setDaemonError(true);
      });

    api.sessions(5).then(setSessions).catch(() => {});
    api.projects().then(ps => {
      if (ps.length > 0) setActiveProjectName(ps[0].projectName);
    }).catch(() => {});
  }, [setDaemonOnline, setActiveSession]);

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
        <div className={styles.content}>

          {daemonError && (
            <div className={styles.daemonBanner}>
              ⚠ Daemon not running — events won&apos;t be captured.
              Run <code>pnpm dev</code> in <code>packages/daemon</code> to resume.
            </div>
          )}

          {!daemonError && status ? (
            <>
              <div className={styles.projectHeader}>
                <h1 className={styles.projectName}>{activeProjectName}</h1>
                <StatusBadge
                  status={status.activeSession ? 'capturing' : 'idle'}
                  lastEventAt={status.activeSession?.startedAt}
                />
              </div>

              <div className={styles.weekCard}>
                <div className={styles.weekStats}>
                  <span>{status.eventCount} events</span>
                  <span>{status.sessionCount} sessions</span>
                  {status.activeSession && (
                    <span>{status.activeSession.commitCount} commits this session</span>
                  )}
                </div>
                <SparkBar values={commitsByDay} label="commits per day — last 7 days" />
              </div>

              {status.activeSession && (
                <div className={styles.activeSession}>
                  <div className={styles.sectionLabel}>Active session</div>
                  <div className={styles.sessionRow}>
                    <span>Started {new Date(status.activeSession.startedAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>
                    <span>{status.activeSession.commitCount} commits</span>
                    <span>{status.activeSession.fileChurn} lines changed</span>
                    <Link href={`/sessions/${status.activeSession.id}`} className={styles.link}>View →</Link>
                  </div>
                </div>
              )}

              {sessions.length > 0 && (
                <div className={styles.recentSessions}>
                  <div className={styles.sectionLabel}>Recent sessions</div>
                  {sessions.map(s => {
                    const date = new Date(s.startedAt);
                    const dur = s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : null;
                    return (
                      <div key={s.id} className={styles.sessionRow}>
                        <span>{date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}, {date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</span>
                        {dur && <span>{dur}m</span>}
                        <span>{s.commitCount} commits</span>
                        {!s.endedAt && <EventChip type="session_open" />}
                        <Link href={`/sessions/${s.id}`} className={styles.link}>View replay →</Link>
                      </div>
                    );
                  })}
                  <Link href="/sessions" className={styles.viewAll}>View all sessions →</Link>
                </div>
              )}

              <div className={styles.quickAsk}>
                <div className={styles.sectionLabel}>Ask about this project</div>
                <QuickAsk />
              </div>
            </>
          ) : !daemonError ? (
            <div className={styles.loading}>Connecting to daemon...</div>
          ) : (
            <div className={styles.onboarding}>
              <h2 className={styles.displayHeading}>Watch your code being built</h2>
              <p>Install the CLI to start capturing.</p>
              <div className={styles.codeBlock}>
                <code>npm install -g vrrbose &amp;&amp; vrrbose init</code>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function QuickAsk() {
  const [input, setInput] = useState('');
  const router = useSimpleRouter();

  return (
    <div className={styles.askRow}>
      <input
        className={styles.askInput}
        placeholder="What did I work on this week?"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && input.trim()) router(input); }}
      />
      <Link
        href={`/agent?q=${encodeURIComponent(input)}`}
        className={styles.askBtn}
        onClick={e => { if (!input.trim()) e.preventDefault(); }}
      >
        Ask
      </Link>
    </div>
  );
}

function useSimpleRouter() {
  return (query: string) => {
    window.location.href = `/agent?q=${encodeURIComponent(query)}`;
  };
}
