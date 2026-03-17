'use client';
import { useEffect, useMemo, useState } from 'react';
import { GlobalNav } from '../../components/GlobalNav';
import { api, type DecisionEntry } from '../../lib/api';
import styles from './page.module.css';

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString();
}

export default function DecisionsPage() {
  const [items, setItems] = useState<DecisionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const [triggerFilter, setTriggerFilter] = useState<'all' | DecisionEntry['trigger']>('all');

  useEffect(() => {
    setLoading(true);
    setStatus(null);
    api.decisions()
      .then((rows) => setItems(rows))
      .catch((e) => setStatus(e instanceof Error ? e.message : 'Failed to load decisions'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (triggerFilter === 'all') return items;
    return items.filter((i) => i.trigger === triggerFilter);
  }, [items, triggerFilter]);

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.heading}>Decision Log</h1>
            <p className={styles.subhead}>ADR-style decisions derived from session capsules.</p>
          </div>
          <select
            className={styles.filter}
            value={triggerFilter}
            onChange={(e) => setTriggerFilter(e.target.value as 'all' | DecisionEntry['trigger'])}
          >
            <option value="all">All triggers</option>
            <option value="manual">Manual</option>
            <option value="merge">Merge</option>
            <option value="tag">Tag</option>
            <option value="weekly">Weekly</option>
          </select>
        </header>

        {status && <p className={styles.status}>{status}</p>}

        {loading ? (
          <div className={styles.empty}>Loading decisions...</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No decisions found for this filter.</div>
        ) : (
          <ul className={styles.list}>
            {filtered.map((item) => (
              <li key={item.id} className={styles.card}>
                <div className={styles.cardHead}>
                  <h2 className={styles.title}>{item.title}</h2>
                  <span className={styles.badge}>{item.trigger}</span>
                </div>
                <p className={styles.summary}>{item.summary || 'No capsule summary available.'}</p>
                <div className={styles.meta}>
                  <span>{formatTs(item.createdAt)}</span>
                  <span>Capsule {item.capsuleId.slice(0, 8)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
