import styles from './DiffViewer.module.css';

interface DiffLine { type: 'add' | 'remove' | 'context'; content: string; }
interface Props { filePath: string; additions: number; deletions: number; lines?: DiffLine[]; }

export function DiffViewer({ filePath, additions, deletions, lines = [] }: Props) {
  return (
    <div className={styles.viewer}>
      <div className={styles.header}>
        <span className={styles.path}>{filePath}</span>
        <span className={styles.stat}>
          <span className={styles.add}>+{additions}</span>
          <span className={styles.del}>-{deletions}</span>
        </span>
      </div>
      <div className={styles.body}>
        {lines.length === 0
          ? <div className={styles.empty}>No diff available</div>
          : lines.map((l, i) => (
              <div key={i} className={`${styles.line} ${styles[l.type]}`}>
                <code>{l.content}</code>
              </div>
            ))
        }
      </div>
    </div>
  );
}
