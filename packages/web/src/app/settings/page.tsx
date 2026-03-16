'use client';
import { useEffect, useState } from 'react';
import { useClerk, useUser } from '@clerk/nextjs';
import { GlobalNav } from '../../components/GlobalNav';
import { api } from '../../lib/api';
import styles from './page.module.css';

export default function SettingsPage() {
  const { signOut } = useClerk();
  const { user } = useUser();
  const [daemonOnline, setDaemonOnline] = useState<boolean | null>(null);
  const [daemonPort, setDaemonPort] = useState<number | null>(null);
  const [copiedPort, setCopiedPort] = useState(false);

  useEffect(() => {
    api.status()
      .then(s => {
        setDaemonOnline(true);
        setDaemonPort((s as unknown as Record<string, unknown>)['port'] as number ?? null);
      })
      .catch(() => setDaemonOnline(false));
  }, []);

  function copyStartCmd() {
    navigator.clipboard.writeText('vrrbose start').catch(() => {});
    setCopiedPort(true);
    setTimeout(() => setCopiedPort(false), 2000);
  }

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main className={styles.main}>
        <h1 className={styles.heading}>Settings</h1>

        {/* Account */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>Account</div>
          <div className={styles.row}>
            <span className={styles.rowKey}>Email</span>
            <span className={styles.rowVal}>{user?.primaryEmailAddress?.emailAddress ?? '—'}</span>
          </div>
          <div className={styles.row}>
            <span className={styles.rowKey}>&nbsp;</span>
            <button
              className={styles.signOutBtn}
              onClick={() => signOut({ redirectUrl: '/' })}
            >
              Sign out
            </button>
          </div>
        </section>

        {/* Daemon */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>Daemon</div>
          <div className={styles.row}>
            <span className={styles.rowKey}>Status</span>
            <span className={styles.rowVal}>
              <span
                className={styles.dot}
                style={{
                  background: daemonOnline === null
                    ? 'var(--color-text-muted)'
                    : daemonOnline ? '#22c55e' : 'var(--color-cta-pressed)',
                }}
              />
              {daemonOnline === null
                ? 'Connecting…'
                : daemonOnline
                ? `Online${daemonPort ? ` · port ${daemonPort}` : ''}`
                : 'Offline'}
            </span>
          </div>
          {!daemonOnline && daemonOnline !== null && (
            <div className={styles.row}>
              <span className={styles.rowKey}>Start</span>
              <div className={styles.cmdRow}>
                <code className={styles.cmd}>vrrbose start</code>
                <button className={styles.copyBtn} onClick={copyStartCmd}>
                  {copiedPort ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          )}
        </section>

        {/* Configuration */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>Configuration</div>
          <div className={styles.configInfo}>
            <p className={styles.configDesc}>
              Vrrbose is configured via <code>VRRBOSE.md</code> in your project root.
              Edit this file to control capture rules, session thresholds, output destinations,
              and AI pair integration.
            </p>
            <div className={styles.configGrid}>
              <div className={styles.configItem}>
                <span className={styles.configKey}>Capture</span>
                <span className={styles.configHint}>staged_diffs, terminal_commands, ai_prompts, test_runs</span>
              </div>
              <div className={styles.configItem}>
                <span className={styles.configKey}>Sessions</span>
                <span className={styles.configHint}>inactivity_threshold, auto_capsule, weekly_capsule_day</span>
              </div>
              <div className={styles.configItem}>
                <span className={styles.configKey}>Outputs</span>
                <span className={styles.configHint}>session_summary, weekly_digest, brag_sheet → local / Notion / Slack</span>
              </div>
              <div className={styles.configItem}>
                <span className={styles.configKey}>AI pairs</span>
                <span className={styles.configHint}>mcp_server, context_injection → claude_code, cursor, copilot</span>
              </div>
            </div>
          </div>
        </section>

        {/* MCP */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>MCP Server</div>
          <p className={styles.configDesc}>
            Enable <code>mcp_server.enabled: true</code> in <code>VRRBOSE.md</code> to expose
            Vrrbose as an MCP server (default port 7332). Connect Claude Code, Cursor, or other
            MCP-compatible tools to give them live access to your project history.
          </p>
        </section>
      </main>
    </div>
  );
}
