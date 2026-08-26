import type { Metadata } from 'next';
import { Geist, Geist_Mono, Source_Serif_4 } from 'next/font/google';
import { translate } from '@/messages';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin'],
  weight: ['600'],
});

export const metadata: Metadata = {
  title: translate('ui.meta.title'),
  description: translate('ui.meta.description'),
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} antialiased`}
      >
        <header className="border-rule bg-paper-edge border-b">
          <div className="mx-auto flex max-w-3xl flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
            <a href="/" className="font-serif text-lg leading-none font-semibold tracking-tight">
              {translate('ui.brand')}
            </a>
            {/*
              No tagline here. It is the front page's <h1>, and printing the same
              sentence twice on the same screen was the loudest bit of clutter on it.
              The footer carries what this build is.
            */}
            <nav className="no-print ml-auto flex gap-4 text-xs">
              <a href="/apply" className="text-accent hover:underline">
                {translate('ui.nav.apply')}
              </a>
              <a href="/personas" className="text-accent hover:underline">
                {translate('ui.nav.personas')}
              </a>
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 pt-6 pb-16">{children}</main>

        <footer className="border-rule text-ink-3 border-t px-4 py-6 text-xs">
          <div className="mx-auto max-w-3xl">
            <p>{translate('ui.footer.build')}</p>
            <p className="mt-2">{translate('ui.footer.not_an_offer')}</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
