'use client';

import { useState } from 'react';
import { SignIn } from '@clerk/nextjs';
import styles from './page.module.css';

const clerkAppearance = {
  variables: {
    colorBackground: '#001e35',
    colorInputBackground: 'rgba(255,236,209,0.05)',
    colorInputText: 'rgba(255,236,209,0.9)',
    colorText: 'rgba(255,236,209,0.85)',
    colorTextSecondary: 'rgba(255,236,209,0.45)',
    colorPrimary: '#ff914d',
    borderRadius: '10px',
    fontFamily: 'Bricolage Grotesque, system-ui, sans-serif',
  },
  elements: {
    card: { boxShadow: 'none', border: '1px solid rgba(255,236,209,0.1)' },
    headerTitle: { fontFamily: 'Goudy Bookletter 1911, Georgia, serif' },
  },
} as const;

export default function LoginPage() {
  const [acknowledged, setAcknowledged] = useState(false);

  return (
    <div className={styles.page}>
      <div className={styles.logo}>
        <span style={{color:'#FF7D00'}}>v</span><span style={{color:'#FFECD1'}}>r</span><span style={{color:'#15616D'}}>r</span>bose<span className={styles.dot}>.</span>dev
      </div>
      {!acknowledged ? (
        <div style={{
          width: '100%',
          maxWidth: '380px',
          background: '#001e35',
          border: '1px solid rgba(255,236,209,0.1)',
          borderRadius: '10px',
          padding: '2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1.25rem',
          fontFamily: 'Bricolage Grotesque, system-ui, sans-serif',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#FF7D00', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Notice</p>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 500, color: '#FFECD1', fontFamily: 'Goudy Bookletter 1911, Georgia, serif' }}>This package is deprecated</h2>
          </div>
          <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: 'rgba(255,236,209,0.7)' }}>
            A new release is coming <strong style={{ color: '#FFECD1' }}>October 1, 2026</strong>. The current version will remain accessible but will no longer receive updates.
          </p>
          <button
            onClick={() => setAcknowledged(true)}
            style={{
              background: '#FF7D00',
              color: '#001524',
              border: 'none',
              borderRadius: '6px',
              padding: '10px 16px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'Bricolage Grotesque, system-ui, sans-serif',
            }}
          >
            Continue anyway
          </button>
        </div>
      ) : (
        <SignIn routing="hash" forceRedirectUrl="/dashboard" appearance={clerkAppearance} />
      )}
    </div>
  );
}
