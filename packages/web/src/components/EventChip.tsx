import { clsx } from 'clsx';
import styles from './EventChip.module.css';

const TYPE_STYLE: Record<string, string> = {
  git_commit:       styles.teal!,
  git_merge:        styles.teal!,
  git_branch_create: styles.teal!,
  test_run:         styles.brandy!,
  ai_prompt:        styles.tangerine!,
  session_close:    styles.muted!,
  session_open:     styles.muted!,
};

export function EventChip({ type }: { type: string }) {
  const label = type.replace(/_/g, '.');
  return (
    <span className={clsx(styles.chip, TYPE_STYLE[type] ?? styles.muted)}>
      {label}
    </span>
  );
}
