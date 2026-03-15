import styles from './MetricsChart.module.css';

interface Props {
  values: number[];
  labels?: string[];
  label?: string;
  /** Color each bar based on a threshold fn */
  colorFn?: (value: number) => 'green' | 'amber' | 'red' | 'default';
  height?: number;
}

export function MetricsChart({ values, labels, label, colorFn, height = 80 }: Props) {
  const max = Math.max(...values, 1);
  const w = 40;
  const gap = 6;
  const totalW = values.length * w + (values.length - 1) * gap;
  const labelH = labels ? 18 : 0;
  const svgH = height + labelH + 8;

  function barColor(v: number): string {
    if (!colorFn) return 'var(--color-accent)';
    const c = colorFn(v);
    if (c === 'green') return '#22c55e';
    if (c === 'amber') return 'var(--color-cta)';
    if (c === 'red')   return '#f97316';
    return 'var(--color-accent)';
  }

  return (
    <div className={styles.wrap}>
      <svg
        width="100%"
        viewBox={`0 0 ${totalW} ${svgH}`}
        preserveAspectRatio="xMidYMid meet"
        className={styles.svg}
      >
        {values.map((v, i) => {
          const barH = max > 0 ? Math.max(3, (v / max) * height) : 3;
          const x = i * (w + gap);
          const y = height - barH;
          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width={w}
                height={barH}
                fill={v === max && !colorFn ? 'var(--color-cta)' : barColor(v)}
                rx={2}
                opacity={v === 0 ? 0.2 : 1}
              />
              {labels && (
                <text
                  x={x + w / 2}
                  y={height + labelH}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--color-text-muted)"
                  fontFamily="var(--font-code)"
                >
                  {labels[i] ?? ''}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {label && <div className={styles.label}>{label}</div>}
    </div>
  );
}
