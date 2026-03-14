import { clsx } from 'clsx';
import { EventChip } from './EventChip';
import styles from './ChapterCard.module.css';

interface Props {
  index: number;
  message: string;
  additions: number;
  deletions: number;
  timestamp: number;
  durationMin: number;
  eventTypes: string[];
  active?: boolean;
  onClick?: () => void;
}

export function ChapterCard({ index, message, additions, deletions, timestamp, durationMin, eventTypes, active, onClick }: Props) {
  const time = new Date(timestamp).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className={clsx(styles.card, active && styles.active)} onClick={onClick}
      role="button" tabIndex={0} onKeyDown={e => e.key === 'Enter' && onClick?.()}>
      <div className={styles.header}>
        <span className={styles.index}>{index}</span>
        <span className={styles.message}>{message}</span>
      </div>
      <div className={styles.meta}>
        <span className={styles.stat}>+{additions} -{deletions}</span>
        <span className={styles.dot}>·</span>
        <span className={styles.time}>{time}</span>
        <span className={styles.dot}>·</span>
        <span className={styles.dur}>{durationMin}m</span>
      </div>
      {eventTypes.length > 0 && (
        <div className={styles.chips}>
          {eventTypes.slice(0, 3).map(t => <EventChip key={t} type={t} />)}
        </div>
      )}
    </div>
  );
}
