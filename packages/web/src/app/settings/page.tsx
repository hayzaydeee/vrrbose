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

  useEffect(() => {
    api.status()
      .then(s => {
        setDaemonOnline(true);
        setDaemonPort((s as unknown as Record<string, unknown>)['port'] as number ?? null);
      })
      .catch(() => setDaemonOnline(false));
  }, []);

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main className={styles.main}>
        <h1 className={styles.heading}>Settings</h1>

        <section style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-code)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>Account</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <div style={{ fontSize: 'var(--text-sm)' }}>{user?.primaryEmailAddress?.emailAddress ?? '—'}</div>
            <button
              onClick={() => signOut({ redirectUrl: '/' })}
              style={{ alignSelf: 'flex-start', marginTop: '0.5rem', padding: '0.375rem 0.875rem', fontSize: 'var(--text-sm)', background: 'transparent', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-sm)', color: 'var(--color-text)', cursor: 'pointer' }}
            >
              Sign out
            </button>
          </div>
        </section>

        <section style={{ marginBottom: '2rem' }}>
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-code)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>Daemon</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: 'var(--text-sm)' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: daemonOnline === null ? 'var(--color-text-muted)' : daemonOnline ? '#22c55e' : 'var(--color-cta-pressed)', display: 'inline-block' }} />
            {daemonOnline === null ? 'Connecting…' : daemonOnline ? `Online${daemonPort ? ` · port ${daemonPort}` : ''}` : 'Offline — run vrrbose start'}
          </div>
        </section>

        <section>
          <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-code)', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>Configuration</div>
          <p className={styles.muted} style={{ fontSize: 'var(--text-sm)' }}>
            Edit <code>VRRBOSE.md</code> in your project root to configure capture rules, session thresholds, and output preferences.
          </p>
        </section>
      </main>
    </div>
  );
}
