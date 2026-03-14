import styles from './StatusBadge.module.css';

type Status = 'capturing' | 'idle' | 'no-extension' | 'offline';

const LABELS: Record<Status, string> = {
  capturing:      'Capturing',
  idle:           'Idle',
  'no-extension': 'Extension not connected',
  offline:        'Daemon not running',
};
const DOT: Record<Status, string> = {
  capturing:      styles.green!,
  idle:           styles.muted!,
  'no-extension': styles.tangerine!,
  offline:        styles.brandy!,
};

export function StatusBadge({ status, lastEventAt }: { status: Status; lastEventAt?: number }) {
  const ago = lastEventAt ? `${Math.round((Date.now() - lastEventAt) / 60000)}m ago` : null;
  return (
    <span className={styles.badge}>
      <span className={`${styles.dot} ${DOT[status]}`} />
      <span className={styles.label}>{LABELS[status]}</span>
      {ago && <span className={styles.ago}>{ago}</span>}
    </span>
  );
}
