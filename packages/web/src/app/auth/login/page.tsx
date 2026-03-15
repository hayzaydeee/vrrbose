'use client';
import { useState } from 'react';
import { useSignIn } from '@clerk/nextjs';
import styles from './page.module.css';

export default function LoginPage() {
  const { signIn, isLoaded } = useSignIn();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!isLoaded || !email.trim()) return;
    setLoading(true);
    setError('');
    try {
      await signIn.create({
        strategy: 'email_link',
        identifier: email.trim(),
        redirectUrl: `${window.location.origin}/auth/verify`,
      });
      window.location.href = '/auth/verify';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong.';
      setError(msg);
      setLoading(false);
    }
  }

  async function continueWithGitHub() {
    if (!isLoaded) return;
    await signIn.authenticateWithRedirect({
      strategy: 'oauth_github',
      redirectUrl: '/sso-callback',
      redirectUrlComplete: '/dashboard',
    });
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.logo}>
          vrrbose<span className={styles.dot}>.</span>dev
        </div>

        <h1 className={styles.heading}>Sign in to Vrrbose</h1>

        <form className={styles.form} onSubmit={sendMagicLink}>
          <input
            className={styles.input}
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            autoFocus
            required
          />
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.btnPrimary} type="submit" disabled={loading || !isLoaded}>
            {loading ? 'Sending…' : 'Send magic link'}
          </button>
        </form>

        <div className={styles.divider}>
          <span className={styles.dividerText}>or</span>
        </div>

        <button className={styles.btnGithub} onClick={continueWithGitHub} disabled={!isLoaded}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
          </svg>
          Continue with GitHub
        </button>

        <p className={styles.hint}>
          Already using the CLI? Your local data syncs automatically on first sign-in.
        </p>
      </div>
    </div>
  );
}
