'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { StatusBadge } from './StatusBadge';
import { useAppStore } from '../lib/store';
import { api, type ProjectStatus } from '../lib/api';
import styles from './GlobalNav.module.css';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/sessions',  label: 'Sessions' },
  { href: '/agent',     label: 'Ask' },
  { href: '/capsules',  label: 'Capsules' },
  { href: '/documents', label: 'Documents' },
  { href: '/metrics',   label: 'Metrics' },
  { href: '/settings',  label: 'Settings' },
];

function useElapsed(startedAt: number | undefined) {
  const [elapsed, setElapsed] = useState('');
  useEffect(() => {
    if (!startedAt) { setElapsed(''); return; }
    const tick = () => {
      const ms = Date.now() - startedAt;
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      setElapsed(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const id = setInterval(tick, 30000);
    return () => clearInterval(id);
  }, [startedAt]);
  return elapsed;
}

export function GlobalNav() {
  const pathname = usePathname();
  const { daemonOnline, activeSession } = useAppStore();
  const status = !daemonOnline ? 'offline' : activeSession ? 'capturing' : 'idle';
  const elapsed = useElapsed(activeSession?.startedAt);

  const [projects, setProjects] = useState<ProjectStatus[]>([]);
  const [activeProject, setActiveProject] = useState('');

  useEffect(() => {
    api.projects().then(ps => {
      setProjects(ps);
      if (ps.length > 0) setActiveProject(ps[0].projectName);
    }).catch(() => {});
  }, []);

  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>
        <span className={styles.logoText}><span style={{color:'#FF7D00'}}>v</span><span style={{color:'#FFECD1'}}>r</span><span style={{color:'#15616D'}}>r</span>bose.dev</span>
      </div>
      {projects.length > 1 && (
        <div className={styles.projectSwitcher}>
          <select
            className={styles.projectSelect}
            value={activeProject}
            onChange={e => setActiveProject(e.target.value)}
          >
            {projects.map(p => (
              <option key={p.projectId} value={p.projectName}>{p.projectName}</option>
            ))}
          </select>
        </div>
      )}
      {projects.length === 1 && (
        <div className={styles.projectName}>{activeProject}</div>
      )}
      <ul className={styles.items}>
        {NAV.map(({ href, label }) => (
          <li key={href}>
            <Link href={href} className={`${styles.item} ${pathname === href || (href === '/dashboard' && pathname === '/dashboard') ? styles.active : ''}`}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
      <div className={styles.footer}>
        {activeSession && elapsed && (
          <div className={styles.timer}>
            <span className={styles.timerDot} />
            {elapsed}
          </div>
        )}
        <StatusBadge status={status} lastEventAt={activeSession?.startedAt} />
      </div>
    </nav>
  );
}
