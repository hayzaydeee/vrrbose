import styles from './SparkBar.module.css';

interface Props { values: number[]; label?: string; }

export function SparkBar({ values, label }: Props) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 1);
  const H = 40;
  return (
    <figure className={styles.figure}>
      <svg className={styles.svg} viewBox={`0 0 ${values.length * 10} ${H}`} preserveAspectRatio="none" aria-hidden>
        {values.map((v, i) => {
          const h = Math.max(2, (v / max) * H);
          return (
            <rect key={i} x={i * 10 + 1} y={H - h} width={8} height={h}
              fill={v === max ? 'var(--color-cta)' : 'var(--color-border)'} rx={1} />
          );
        })}
      </svg>
      {label && <figcaption className={styles.caption}>{label}</figcaption>}
    </figure>
  );
}
