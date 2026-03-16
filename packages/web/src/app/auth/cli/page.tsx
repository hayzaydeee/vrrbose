'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@clerk/nextjs';
import { SignIn } from '@clerk/nextjs';
import styles from './page.module.css';

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'https://api.vrrbose.dev';

type Stage = 'loading' | 'sign-in' | 'authorizing' | 'done' | 'error';

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

function CliAuthInner() {
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const deviceId = searchParams.get('device_id');

  const [stage, setStage] = useState<Stage>('loading');
  const [error, setError] = useState('');

  const authorizeDevice = useCallback(async () => {
    if (!deviceId) {
      setError('Missing device_id in URL.');
      setStage('error');
      return;
    }
    setStage('authorizing');
    try {
      const token = await getToken();
      if (!token) throw new Error('No session token');

      const res = await fetch(`${API_URL}/auth/device`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ device_id: deviceId, token }),
      });
      if (!res.ok) {
        const body = await res.json() as { error?: string };
        throw new Error(body.error ?? 'Failed to authorize device');
      }
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authorization failed');
      setStage('error');
    }
  }, [deviceId, getToken]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!deviceId) {
      setError('Missing device_id parameter.');
      setStage('error');
      return;
    }
    if (isSignedIn) {
      authorizeDevice();
    } else {
      setStage('sign-in');
    }
  }, [isLoaded, isSignedIn, deviceId, authorizeDevice]);

  if (stage === 'loading') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}><span style={{color:'#FF7D00'}}>v</span><span style={{color:'#FFECD1'}}>r</span><span style={{color:'#15616D'}}>r</span>bose<span className={styles.dot}>.</span>dev</div>
          <p className={styles.sub}>Loading…</p>
        </div>
      </div>
    );
  }

  if (stage === 'authorizing') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}><span style={{color:'#FF7D00'}}>v</span><span style={{color:'#FFECD1'}}>r</span><span style={{color:'#15616D'}}>r</span>bose<span className={styles.dot}>.</span>dev</div>
          <div className={styles.spinner} />
          <p className={styles.sub}>Authorizing CLI…</p>
        </div>
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}><span style={{color:'#FF7D00'}}>v</span><span style={{color:'#FFECD1'}}>r</span><span style={{color:'#15616D'}}>r</span>bose<span className={styles.dot}>.</span>dev</div>
          <div className={styles.check}>✓</div>
          <h1 className={styles.heading}>You&apos;re authenticated</h1>
          <p className={styles.sub}>The CLI is now signed in. You can close this tab.</p>
        </div>
      </div>
    );
  }

  if (stage === 'error') {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.logo}><span style={{color:'#FF7D00'}}>v</span><span style={{color:'#FFECD1'}}>r</span><span style={{color:'#15616D'}}>r</span>bose<span className={styles.dot}>.</span>dev</div>
          <h1 className={styles.heading}>Something went wrong</h1>
          <p className={styles.errorMsg}>{error}</p>
          <p className={styles.sub}>Run <code>vrrbose login</code> again to retry.</p>
        </div>
      </div>
    );
  }

  // sign-in stage: let Clerk handle auth, redirect back here after
  const returnUrl = `/auth/cli?device_id=${deviceId}`;
  return (
    <div className={styles.page}>
      <div className={styles.signInWrap}>
        <p className={styles.signInHint}>Sign in to authorise the Vrrbose CLI</p>
        <SignIn routing="hash" forceRedirectUrl={returnUrl} appearance={clerkAppearance} />
      </div>
    </div>
  );
}

export default function CliAuthPage() {
  return (
    <Suspense>
      <CliAuthInner />
    </Suspense>
  );
}
