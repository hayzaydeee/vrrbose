import { GlobalNav } from '../components/GlobalNav';
import styles from './page.module.css';

export default function DashboardPage() {
  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main className={styles.main}>
        <div className={styles.content}>
          <h1 className={styles.heading}>Dashboard</h1>
          <div className={styles.onboarding}>
            <h2 className={styles.displayHeading}>Watch your code being built</h2>
            <p>Install the CLI to start capturing.</p>
            <div className={styles.codeBlock}>
              <code>npm install -g vrrbose &amp;&amp; vrrbose init</code>
            </div>
            <p style={{ marginTop: '16px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
              Once you run <code>vrrbose init</code> in a project directory, it will appear here automatically.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
