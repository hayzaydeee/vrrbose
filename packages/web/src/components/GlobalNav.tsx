'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StatusBadge } from './StatusBadge';
import { useAppStore } from '../lib/store';
import styles from './GlobalNav.module.css';

const NAV = [
  { href: '/',          label: 'Dashboard' },
  { href: '/sessions',  label: 'Sessions' },
  { href: '/agent',     label: 'Ask' },
  { href: '/capsules',  label: 'Capsules' },
  { href: '/metrics',   label: 'Metrics' },
  { href: '/settings',  label: 'Settings' },
];

export function GlobalNav() {
  const pathname = usePathname();
  const { daemonOnline, activeSession } = useAppStore();
  const status = !daemonOnline ? 'offline' : activeSession ? 'capturing' : 'idle';

  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>
        <span className={styles.logoText}>Vrrbose</span>
      </div>
      <ul className={styles.items}>
        {NAV.map(({ href, label }) => (
          <li key={href}>
            <Link href={href} className={`${styles.item} ${pathname === href ? styles.active : ''}`}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        <StatusBadge status={status} />
      </div>
    </nav>
  );
}
