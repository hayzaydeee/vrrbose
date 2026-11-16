import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import './globals.css';

export const metadata: Metadata = {
  title: 'Vrrbose',
  description: 'An agent that watches your code being built',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link
            href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600&family=Google+Sans+Code:wght@400;500&family=Goudy+Bookletter+1911&display=swap"
            rel="stylesheet"
          />
        </head>
        <body>
          <a className="skip-link" href="#main-content">Skip to main content</a>
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, background: '#1a1a1a', borderBottom: '1px solid #333', padding: '10px 16px', textAlign: 'center', fontSize: '13px', color: '#999' }}>
            <strong style={{ color: '#fff' }}>This package is deprecated.</strong> A new release is coming <strong style={{ color: '#fff' }}>Feb 1, 2027</strong>.
          </div>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
