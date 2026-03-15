import styles from './page.module.css';

export default function VerifyPage() {
  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          vrrbose<span className={styles.dot}>.</span>dev
        </div>

        <div className={styles.icon}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <rect x="2" y="4" width="20" height="16" rx="2"/>
            <path d="M2 7l10 7 10-7"/>
          </svg>
        </div>

        <h1 className={styles.heading}>Check your email.</h1>
        <p className={styles.sub}>
          A magic link is on its way. Link expires in 15 minutes.
        </p>

        <a href="/auth/login" className={styles.back}>← Back to sign in</a>
      </div>
    </div>
  );
}
