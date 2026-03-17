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
  const [notionEnabled, setNotionEnabled] = useState(false);
  const [notionWorkspace, setNotionWorkspace] = useState('');
  const [notionDatabaseId, setNotionDatabaseId] = useState('');
  const [notionToken, setNotionToken] = useState('');
  const [notionTokenMasked, setNotionTokenMasked] = useState<string | null>(null);
  const [notionSaving, setNotionSaving] = useState(false);
  const [notionStatus, setNotionStatus] = useState<string | null>(null);

  useEffect(() => {
    api.status()
      .then(s => {
        setDaemonOnline(true);
        setDaemonPort((s as unknown as Record<string, unknown>)['port'] as number ?? null);
      })
      .catch(() => setDaemonOnline(false));

    api.notionDestination()
      .then((config) => {
        setNotionEnabled(config.enabled);
        setNotionWorkspace(config.workspaceName ?? '');
        setNotionDatabaseId(config.databaseId ?? '');
        setNotionTokenMasked(config.tokenMasked ?? null);
      })
      .catch(() => {});
  }, []);

  function copyStartCmd() {
    navigator.clipboard.writeText('vrrbose start').catch(() => {});
    setCopiedPort(true);
    setTimeout(() => setCopiedPort(false), 2000);
  }

  async function saveNotion() {
    setNotionSaving(true);
    setNotionStatus(null);
    try {
      const updated = await api.updateNotionDestination({
        enabled: notionEnabled,
        workspaceName: notionWorkspace,
        databaseId: notionDatabaseId,
        token: notionToken,
      });

      setNotionToken('');
      setNotionTokenMasked(updated.tokenMasked ?? null);
      setNotionStatus('Saved Notion destination settings.');
    } catch (e) {
      setNotionStatus(e instanceof Error ? e.message : 'Failed to save Notion settings');
    } finally {
      setNotionSaving(false);
    }
  }

  async function testNotion() {
    setNotionStatus(null);
    try {
      const result = await api.testNotionDestination();
      setNotionStatus(result.message);
    } catch (e) {
      setNotionStatus(e instanceof Error ? e.message : 'Notion test failed');
    }
  }

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main id="main-content" tabIndex={-1} className={styles.main}>
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

        {/* Destination: Notion */}
        <section className={styles.section}>
          <div className={styles.sectionLabel}>Destination - Notion</div>
          <p className={styles.configDesc}>
            Configure Notion as your first publishing destination for generated documents.
          </p>

          <div className={styles.destinationGrid}>
            <label className={styles.destinationLabel}>
              <span>Enabled</span>
              <input
                type="checkbox"
                checked={notionEnabled}
                onChange={(e) => setNotionEnabled(e.target.checked)}
              />
            </label>

            <label className={styles.destinationLabel}>
              <span>Workspace</span>
              <input
                className={styles.destinationInput}
                value={notionWorkspace}
                onChange={(e) => setNotionWorkspace(e.target.value)}
                placeholder="My Team Workspace"
              />
            </label>

            <label className={styles.destinationLabel}>
              <span>Database ID</span>
              <input
                className={styles.destinationInput}
                value={notionDatabaseId}
                onChange={(e) => setNotionDatabaseId(e.target.value)}
                placeholder="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
              />
            </label>

            <label className={styles.destinationLabel}>
              <span>Integration Token</span>
              <input
                className={styles.destinationInput}
                value={notionToken}
                onChange={(e) => setNotionToken(e.target.value)}
                placeholder={notionTokenMasked ?? 'secret_xxx'}
                type="password"
              />
            </label>
          </div>

          <div className={styles.destinationActions}>
            <button className={styles.destinationBtn} onClick={saveNotion} disabled={notionSaving}>
              {notionSaving ? 'Saving...' : 'Save'}
            </button>
            <button className={styles.destinationGhostBtn} onClick={testNotion}>
              Test connection
            </button>
          </div>

          {notionStatus && <p className={styles.destinationStatus}>{notionStatus}</p>}
        </section>
      </main>
    </div>
  );
}
