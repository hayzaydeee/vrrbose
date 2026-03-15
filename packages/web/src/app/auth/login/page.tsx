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
  return (
    <div className={styles.page}>
      <SignIn routing="hash" forceRedirectUrl="/dashboard" appearance={clerkAppearance} />
    </div>
  );
}
