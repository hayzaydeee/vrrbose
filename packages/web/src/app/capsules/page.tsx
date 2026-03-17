'use client';
import { useEffect, useState } from 'react';
import { GlobalNav } from '../../components/GlobalNav';
import { api, type Capsule } from '../../lib/api';
import styles from './page.module.css';

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
    <button className={`${styles.card} ${active ? styles.cardActive : ''}`} onClick={() => onSelect(capsule.id)}>
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.capsules().then(cs => {
      setCapsules(cs);
      if (cs.length > 0) {
        api.capsule(cs[0].id)
          .then((detail) => setSelected(detail.capsule))
          .catch(() => setSelected(cs[0]));
      }
      setLoading(false);
    });
  }, []);

  async function selectCapsule(id: string) {
    const detail = await api.capsule(id);
    setSelected(detail.capsule);
  }

  const selectedIndex = selected ? capsules.findIndex((c) => c.id === selected.id) : -1;
  const previous = selectedIndex >= 0 ? capsules[selectedIndex + 1] : null;
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

        {!loading && capsules.length > 0 && (
          <div className={styles.content}>
            <div className={styles.grid}>
              {capsules.map(c => (
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
      </main>
    </div>
  );
}
