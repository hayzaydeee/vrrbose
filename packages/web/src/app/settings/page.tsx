import { GlobalNav } from '../../components/GlobalNav';
import styles from './page.module.css';

export default function SettingsPage() {
  return (
    <div className={styles.layout}>
      <GlobalNav />
      <main className={styles.main}>
        <h1 className={styles.heading}>Settings</h1>
        <p className={styles.muted}>Edit VRRBOSE.md directly to configure capture, session, and output preferences.</p>
      </main>
    </div>
  );
}
