'use client';
import { useState } from 'react';
import { useSignIn } from '@clerk/nextjs';
import styles from './page.module.css';

export default function VerifyPage() {
  const { signIn, isLoaded } = useSignIn();
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);

  async function resend() {
    if (!isLoaded || resending) return;
    setResending(true);
    try {
      await signIn.prepareFirstFactor({
        strategy: 'email_link',
        emailAddressId: signIn.supportedFirstFactors?.find(
          f => f.strategy === 'email_link'
        )?.emailAddressId ?? '',
        redirectUrl: `${window.location.origin}/auth/verify`,
      });
      setResent(true);
    } finally {
      setResending(false);
    }
  }

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

        <p className={styles.resendRow}>
          {resent ? (
            <span className={styles.resendDone}>Link resent.</span>
          ) : (
            <>
              Didn&apos;t get it?{' '}
              <button className={styles.resendBtn} onClick={resend} disabled={resending}>
                {resending ? 'Sending…' : 'Resend link'}
              </button>
            </>
          )}
        </p>

        <a href="/auth/login" className={styles.back}>← Back to sign in</a>
      </div>
    </div>
  );
}
