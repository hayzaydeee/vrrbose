import { GlobalNav } from '../../components/GlobalNav';
import styles from './page.module.css';

export default function CapsulesPage() {
  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main className={styles.main}>
        <h1 className={styles.heading}>Capsules</h1>
        <p className={styles.muted}>Time capsules appear here after merges, tags, or manual captures.</p>
      </main>
    </div>
  );
}
