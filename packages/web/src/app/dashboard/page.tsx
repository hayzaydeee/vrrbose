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

function useElapsed(startedAt: number | undefined) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!startedAt) { setElapsed(''); return; }
    const tick = () => {
      const ms = Date.now() - startedAt;
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [startedAt]);
  return elapsed;
}

function scoreBadgeClass(score: number | null): string {
  if (score === null) return '';
  if (score >= 80) return styles.scoreGreen;
  if (score >= 60) return styles.scoreAmber;
  return styles.scoreRed;
}

export default function DashboardPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [daemonError, setDaemonError] = useState(false);
  const [activeProjectName, setActiveProjectName] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const { setDaemonOnline, setActiveSession } = useAppStore();
  const elapsed = useElapsed(status?.activeSession?.startedAt);

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

    api.sessions(8).then(setSessions).catch(() => {});
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

  const weekSessions = sessions.filter(s => s.startedAt >= now - 7 * DAY);
  const weekCommits = weekSessions.reduce((n, s) => n + s.commitCount, 0);

  function copyInstall() {
    navigator.clipboard.writeText('npm install -g vrrbose && vrrbose init').catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main className={styles.main}>
        <div className={styles.content}>

          {daemonError ? (
            <div className={styles.onboarding}>
              <h2 className={styles.displayHeading}>Watch your code being built</h2>
              <p className={styles.onboardingDesc}>Install the CLI to start capturing git events, AI prompts, and session history.</p>
              <div className={styles.codeRow}>
                <code className={styles.codeBlock}>npm install -g vrrbose &amp;&amp; vrrbose init</code>
                <button className={styles.copyBtn} onClick={copyInstall}>{copied ? 'Copied!' : 'Copy'}</button>
              </div>
              <p className={styles.onboardingHint}>Already installed? Run <code>vrrbose start</code> to resume capturing.</p>
            </div>
          ) : !status ? (
            <div className={styles.loading}>Connecting to daemon…</div>
          ) : (
            <>
              {/* Header */}
              <div className={styles.projectHeader}>
                <h1 className={styles.projectName}>{activeProjectName || 'Dashboard'}</h1>
                <StatusBadge
                  status={status.activeSession ? 'capturing' : 'idle'}
                  lastEventAt={status.activeSession?.startedAt}
                />
              </div>

              {/* 3-column stat cards */}
              <div className={styles.statCards}>

                {/* Active session */}
                <div className={`${styles.card} ${status.activeSession ? styles.cardActive : styles.cardMuted}`}>
                  <div className={styles.cardLabel}>Active session</div>
                  {status.activeSession ? (
                    <>
                      <div className={styles.cardStat}>{elapsed}</div>
                      <div className={styles.cardMeta}>
                        <span>{status.activeSession.commitCount} commits</span>
                        {status.activeSession.fileChurn > 0 && <span>{status.activeSession.fileChurn} lines</span>}
                      </div>
                      <Link href={`/sessions/detail?id=${status.activeSession.id}`} className={styles.cardLink}>View session →</Link>
                    </>
                  ) : (
                    <div className={styles.cardEmpty}>No active session</div>
                  )}
                </div>

                {/* This week */}
                <div className={styles.card}>
                  <div className={styles.cardLabel}>This week</div>
                  <div className={styles.weekStats}>
                    <div className={styles.weekStat}>
                      <span className={styles.weekNum}>{weekSessions.length}</span>
                      <span className={styles.weekUnit}>sessions</span>
                    </div>
                    <div className={styles.weekStat}>
                      <span className={styles.weekNum}>{weekCommits}</span>
                      <span className={styles.weekUnit}>commits</span>
                    </div>
                    <div className={styles.weekStat}>
                      <span className={styles.weekNum}>{status.eventCount}</span>
                      <span className={styles.weekUnit}>events</span>
                    </div>
                  </div>
                  <SparkBar values={commitsByDay} label="commits per day — 7 days" />
                </div>

                {/* Quick ask */}
                <div className={styles.card}>
                  <div className={styles.cardLabel}>Ask about this project</div>
                  <QuickAsk />
                </div>
              </div>

              {/* Recent sessions */}
              {sessions.length > 0 && (
                <div className={styles.section}>
                  <div className={styles.sectionLabel}>Recent sessions</div>
                  <div className={styles.sessionList}>
                    {sessions.slice(0, 6).map(s => {
                      const date = new Date(s.startedAt);
                      const dur = s.endedAt ? Math.round((s.endedAt - s.startedAt) / 60000) : null;
                      const isActive = !s.endedAt;
                      return (
                        <div key={s.id} className={styles.sessionRow}>
                          <div className={styles.sessionLeft}>
                            <span className={styles.sessionDate}>
                              {date.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })},{' '}
                              {date.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {dur !== null && <span className={styles.sessionDur}>{dur}m</span>}
                            {isActive && <EventChip type="session_open" />}
                          </div>
                          <div className={styles.sessionMeta}>
                            {s.commitCount > 0 && <span>{s.commitCount} commits</span>}
                            {s.fileChurn > 0 && <span>{s.fileChurn} lines</span>}
                            {s.score !== null && (
                              <span className={`${styles.scoreBadge} ${scoreBadgeClass(s.score)}`}>
                                {s.score.toFixed(0)}
                              </span>
                            )}
                          </div>
                          <Link href={`/sessions/detail?id=${s.id}`} className={styles.sessionLink}>Replay →</Link>
                        </div>
                      );
                    })}
                  </div>
                  <Link href="/sessions" className={styles.viewAll}>View all sessions →</Link>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}

function QuickAsk() {
  const [input, setInput] = useState('');

  return (
    <div className={styles.askWrap}>
      <input
        className={styles.askInput}
        placeholder="What did I work on this week?"
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && input.trim()) {
            window.location.href = `/agent?q=${encodeURIComponent(input)}`;
          }
        }}
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
