'use client';
import { useEffect, useState } from 'react';
import { GlobalNav } from '../../components/GlobalNav';
import { api, type Capsule } from '../../lib/api';
import styles from './page.module.css';

const PAGE_SIZE = 24;

function capsuleTypeLabel(type: Capsule['type']): string {
  switch (type) {
    case 'merge':  return 'Merge';
    case 'tag':    return 'Tag';
    case 'weekly': return 'Weekly';
    case 'manual': return 'Manual';
    default: return 'Manual';
  }
}

function CapsuleCard({ capsule, active, onSelect }: { capsule: Capsule; active: boolean; onSelect: (id: string) => void }) {
  const date = new Date(capsule.createdAt).toLocaleDateString('en', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });
  const type = capsule.trigger ?? capsule.type ?? 'manual';

  return (
    <button
      className={`${styles.card} ${active ? styles.cardActive : ''}`}
      onClick={() => onSelect(capsule.id)}
      aria-pressed={active}
      aria-label={`Open capsule ${capsule.title}`}
    >
      <div className={styles.cardTop}>
        <span className={`${styles.typeTag} ${styles[`type_${type}`]}`}>
          {capsuleTypeLabel(type)}
        </span>
        <span className={styles.cardDate}>{date}</span>
      </div>
      <div className={styles.cardTitle}>{capsule.title}</div>
      {capsule.summary && (
        <p className={styles.cardSummary}>{capsule.summary}</p>
      )}
      {capsule.fileCount !== undefined && (
        <div className={styles.cardMeta}>{capsule.fileCount} files included</div>
      )}
    </button>
  );
}

export default function CapsulesPage() {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [selected, setSelected] = useState<Capsule | null>(null);
  const [query, setQuery] = useState('');
  const [triggerFilter, setTriggerFilter] = useState<'all' | 'manual' | 'merge' | 'tag' | 'weekly'>('all');
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.capsules(PAGE_SIZE, 0).then(cs => {
      setCapsules(cs);
      setHasMore(cs.length === PAGE_SIZE);
      if (cs.length > 0) {
        api.capsule(cs[0].id)
          .then((detail) => setSelected(detail.capsule))
          .catch(() => setSelected(cs[0]));
      }
      setLoading(false);
    });
  }, []);

  async function loadMore() {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      const next = await api.capsules(PAGE_SIZE, capsules.length);
      setCapsules((prev) => [...prev, ...next]);
      setHasMore(next.length === PAGE_SIZE);
    } finally {
      setLoadingMore(false);
    }
  }

  async function selectCapsule(id: string) {
    const detail = await api.capsule(id);
    setSelected(detail.capsule);
  }

  const q = query.trim().toLowerCase();
  const filteredCapsules = capsules.filter((c) => {
    const type = c.trigger ?? c.type ?? 'manual';
    if (triggerFilter !== 'all' && triggerFilter !== type) return false;
    if (!q) return true;
    return `${c.title} ${c.summary ?? ''}`.toLowerCase().includes(q);
  });

  const selectedIndex = selected ? filteredCapsules.findIndex((c) => c.id === selected.id) : -1;
  const previous = selectedIndex >= 0 ? filteredCapsules[selectedIndex + 1] : null;
  const selectedDecisions = selected?.decisions ?? [];
  const selectedQuestions = selected?.openQuestions ?? [];
  const selectedFiles = selected?.keyFiles ?? [];
  const previousFiles = previous?.keyFiles ?? [];
  const newlyTouched = selectedFiles.filter((f) => !previousFiles.includes(f));

  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main className={styles.main}>
        <h1 className={styles.heading}>Capsules</h1>
        <p className={styles.subtitle}>
          Time capsules snapshot your project&apos;s architecture, decisions, and open TODOs at key moments.
        </p>

        <div className={styles.controls}>
          <input
            className={styles.search}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search capsules..."
            aria-label="Search capsules"
          />
          <select
            className={styles.filter}
            value={triggerFilter}
            onChange={(e) => setTriggerFilter(e.target.value as 'all' | 'manual' | 'merge' | 'tag' | 'weekly')}
            aria-label="Filter capsules by trigger"
          >
            <option value="all">All triggers</option>
            <option value="manual">Manual</option>
            <option value="merge">Merge</option>
            <option value="tag">Tag</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        {loading && <p className={styles.muted}>Loading…</p>}

        {!loading && capsules.length === 0 && (
          <div className={styles.empty}>
            <div className={styles.emptyIcon}>◎</div>
            <h2 className={styles.emptyTitle}>No capsules yet</h2>
            <p className={styles.emptyBody}>
              Capsules are created automatically when you merge to main,
              create a version tag, or on the weekly summary day.
            </p>
            <p className={styles.emptyBody}>
              You can also trigger one manually:
            </p>
            <code className={styles.emptyCode}>vrrbose capsule</code>
            <div className={styles.emptyHints}>
              <div className={styles.hint}>
                <span className={styles.hintKey}>auto_capsule_on_merge</span>
                <span className={styles.hintDesc}>Creates a capsule when merging to main</span>
              </div>
              <div className={styles.hint}>
                <span className={styles.hintKey}>auto_capsule_on_tag</span>
                <span className={styles.hintDesc}>Creates a capsule on version tags</span>
              </div>
              <div className={styles.hint}>
                <span className={styles.hintKey}>weekly_capsule_day</span>
                <span className={styles.hintDesc}>Automatic weekly snapshots (set a day, or &apos;off&apos;)</span>
              </div>
            </div>
            <p className={styles.emptyFootnote}>Configure in <code>VRRBOSE.md</code> → Session settings</p>
          </div>
        )}

        {!loading && capsules.length > 0 && filteredCapsules.length === 0 && (
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>No capsules match this filter</h2>
            <p className={styles.emptyBody}>Adjust your trigger filter or search text to see more results.</p>
          </div>
        )}

        {!loading && filteredCapsules.length > 0 && (
          <div className={styles.content}>
            <div className={styles.grid}>
              {filteredCapsules.map(c => (
                <CapsuleCard
                  key={c.id}
                  capsule={c}
                  active={selected?.id === c.id}
                  onSelect={(capsuleId) => { selectCapsule(capsuleId).catch(() => {}); }}
                />
              ))}
            </div>

            {selected && (
              <aside className={styles.detail}>
                <h2 className={styles.detailTitle}>Capsule detail</h2>
                <p className={styles.detailSummary}>{selected.summary || 'No summary captured for this capsule.'}</p>

                <section className={styles.detailSection}>
                  <h3>Decisions</h3>
                  {selectedDecisions.length === 0 ? <p className={styles.muted}>No decisions recorded.</p> : (
                    <ul className={styles.detailList}>{selectedDecisions.map((d, idx) => <li key={`${selected.id}-d-${idx}`}>{d}</li>)}</ul>
                  )}
                </section>

                <section className={styles.detailSection}>
                  <h3>Open questions</h3>
                  {selectedQuestions.length === 0 ? <p className={styles.muted}>No open questions.</p> : (
                    <ul className={styles.detailList}>{selectedQuestions.map((q, idx) => <li key={`${selected.id}-q-${idx}`}>{q}</li>)}</ul>
                  )}
                </section>

                <section className={styles.detailSection}>
                  <h3>Comparison</h3>
                  {previous ? (
                    <>
                      <p className={styles.muted}>Compared with: {previous.title}</p>
                      <p className={styles.muted}>Newly touched files: {newlyTouched.length}</p>
                      {newlyTouched.length > 0 && (
                        <ul className={styles.detailList}>
                          {newlyTouched.slice(0, 8).map((f) => <li key={`${selected.id}-f-${f}`}>{f}</li>)}
                        </ul>
                      )}
                    </>
                  ) : (
                    <p className={styles.muted}>No previous capsule available for comparison.</p>
                  )}
                </section>
              </aside>
            )}
          </div>
        )}

        {!loading && hasMore && (
          <div className={styles.moreWrap}>
            <button className={styles.moreBtn} onClick={() => loadMore()} disabled={loadingMore}>
              {loadingMore ? 'Loading...' : 'Load more'}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
