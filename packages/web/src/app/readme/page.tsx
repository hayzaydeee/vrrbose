'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { GlobalNav } from '../../components/GlobalNav';
import { api, type ReadmeDraft } from '../../lib/api';
import styles from './page.module.css';

export default function ReadmePage() {
  const [draft, setDraft] = useState<ReadmeDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setStatus(null);
    try {
      const next = await api.readmeDraft();
      setDraft(next);
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to load README draft');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const stats = useMemo(() => {
    if (!draft) return { add: 0, remove: 0 };
    return {
      add: draft.diff.filter((d) => d.type === 'add').length,
      remove: draft.diff.filter((d) => d.type === 'remove').length,
    };
  }, [draft]);

  async function applyDraft() {
    setApplying(true);
    setStatus(null);
    try {
      await api.applyReadmeDraft();
      setStatus('README updated.');
      await load();
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'Failed to apply README draft');
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.heading}>Living README</h1>
            <p className={styles.subhead}>Review generated README updates, then approve to write.</p>
          </div>
          <div className={styles.actions}>
            <button className={styles.ghost} onClick={() => load()} disabled={loading || applying}>Refresh draft</button>
            <button className={styles.primary} onClick={applyDraft} disabled={loading || applying || !draft?.changed}>
              {applying ? 'Applying...' : 'Approve and apply'}
            </button>
          </div>
        </header>

        {status && <p className={styles.status}>{status}</p>}

        {loading ? (
          <div className={styles.loading}>Loading draft...</div>
        ) : !draft ? (
          <div className={styles.loading}>No README draft available.</div>
        ) : (
          <>
            <section className={styles.metaRow}>
              <span className={styles.metaItem}>Path: {draft.readmePath}</span>
              <span className={styles.metaItem}>+{stats.add}</span>
              <span className={styles.metaItem}>-{stats.remove}</span>
              <span className={styles.metaItem}>{draft.changed ? 'Changes pending' : 'No changes detected'}</span>
            </section>

            <section className={styles.grid}>
              <article className={styles.card}>
                <h2 className={styles.cardTitle}>Current</h2>
                <pre className={styles.pre}>{draft.current || '# README\n'}</pre>
              </article>

              <article className={styles.card}>
                <h2 className={styles.cardTitle}>Proposed</h2>
                <pre className={styles.pre}>{draft.proposed}</pre>
              </article>
            </section>

            <section className={styles.diffCard}>
              <h2 className={styles.cardTitle}>Diff</h2>
              <div className={styles.diffBody}>
                {draft.diff.map((line, i) => (
                  <div key={`${line.type}-${i}`} className={`${styles.diffLine} ${styles[line.type]}`}>
                    <code>{line.content}</code>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
