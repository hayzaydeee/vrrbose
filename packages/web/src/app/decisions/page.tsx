'use client';
import { useEffect, useMemo, useState } from 'react';
import { GlobalNav } from '../../components/GlobalNav';
import { api, type DecisionEntry } from '../../lib/api';
import styles from './page.module.css';

const PAGE_SIZE = 40;

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString();
}

export default function DecisionsPage() {
  const [items, setItems] = useState<DecisionEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [triggerFilter, setTriggerFilter] = useState<'all' | DecisionEntry['trigger']>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    setLoading(true);
    setStatus(null);
    api.decisions(undefined, PAGE_SIZE, 0, triggerFilter === 'all' ? undefined : triggerFilter)
      .then((rows) => {
        setItems(rows);
        setHasMore(rows.length === PAGE_SIZE);
      })
      .catch((e) => setStatus(e instanceof Error ? e.message : 'Failed to load decisions'))
      .finally(() => setLoading(false));
  }, [triggerFilter]);

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const rows = await api.decisions(undefined, PAGE_SIZE, items.length, triggerFilter === 'all' ? undefined : triggerFilter);
      setItems((prev) => [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => `${i.title} ${i.summary} ${i.capsuleId}`.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main id="main-content" tabIndex={-1} className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.heading}>Decision Log</h1>
            <p className={styles.subhead}>ADR-style decisions derived from session capsules.</p>
          </div>
          <div className={styles.controls}>
            <input
              className={styles.search}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search decisions..."
              aria-label="Search decisions"
            />
            <select
              className={styles.filter}
              value={triggerFilter}
              onChange={(e) => setTriggerFilter(e.target.value as 'all' | DecisionEntry['trigger'])}
              aria-label="Filter decisions by trigger"
            >
              <option value="all">All triggers</option>
              <option value="manual">Manual</option>
              <option value="merge">Merge</option>
              <option value="tag">Tag</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
        </header>

        {status && <p className={styles.status}>{status}</p>}

        {loading ? (
          <div className={styles.empty}>Loading decisions...</div>
        ) : filtered.length === 0 ? (
          <div className={styles.empty}>No decisions found for this filter.</div>
        ) : (
          <>
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
            {hasMore && (
              <div className={styles.moreWrap}>
                <button className={styles.moreBtn} onClick={() => loadMore()} disabled={loadingMore}>
                  {loadingMore ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
