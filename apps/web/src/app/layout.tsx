import type { Metadata, Viewport } from 'next';
import { IBM_Plex_Sans, Newsreader } from 'next/font/google';
import type { ReactNode } from 'react';
import '@/styles/main.css';
import { Banner } from '@/components/Banner';
import { Header } from '@/components/Header';
import { Providers } from '@/components/providers/providers';

const newsreader = Newsreader({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  display: 'swap',
  variable: '--font-newsreader',
});

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-plex-sans',
});

export const metadata: Metadata = {
  title: { default: 'Spirith', template: '%s · Spirith' },
  description: 'A non-custodial endowment for ENS names. Deposit once; the name renews itself.',
};

export const viewport: Viewport = { themeColor: '#edefea' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${newsreader.variable} ${plexSans.variable}`}>
      <body className="flex min-h-screen flex-col">
        <Providers>
          <Header />
          <Banner />
          {children}
          <footer className="mx-auto w-full max-w-6xl px-6 py-10 text-sm text-muted">
            Built for ETHGlobal ETHOnline 2026 on the ENSv2 Sepolia beta.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
