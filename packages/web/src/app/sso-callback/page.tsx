'use client';
import { useEffect } from 'react';
import { useClerk } from '@clerk/nextjs';

export default function SSOCallbackPage() {
  const { handleRedirectCallback } = useClerk();

  useEffect(() => {
    handleRedirectCallback({ redirectUrl: '/dashboard' });
  }, [handleRedirectCallback]);

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#001524',
      color: 'rgba(255,236,209,0.4)',
      fontFamily: 'system-ui, sans-serif',
      fontSize: '14px',
    }}>
      Signing in…
    </div>
  );
}
