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
  }
}

function CapsuleCard({ capsule }: { capsule: Capsule }) {
  const date = new Date(capsule.createdAt).toLocaleDateString('en', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  });

  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <span className={`${styles.typeTag} ${styles[`type_${capsule.type}`]}`}>
          {capsuleTypeLabel(capsule.type)}
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
    </div>
  );
}

export default function CapsulesPage() {
  const [capsules, setCapsules] = useState<Capsule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.capsules().then(cs => { setCapsules(cs); setLoading(false); });
  }, []);

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
          <div className={styles.grid}>
            {capsules.map(c => <CapsuleCard key={c.id} capsule={c} />)}
          </div>
        )}
      </main>
    </div>
  );
}
