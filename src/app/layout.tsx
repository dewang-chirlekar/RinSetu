import type { Metadata } from 'next';
import { Geist, Geist_Mono, Source_Serif_4 } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { LocaleSwitcher } from '@/components/LocaleSwitcher';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin'],
  weight: ['600'],
});

export async function generateMetadata(): Promise<Metadata> {
  // Browser tab title must stay English even when UI is hi/mr (do-not-translate glossary).
  // `RinSetu` brand and meta are English-only; page content below still switches via `getLocale()` + `translate(..., locale)`.
  const { translate: t } = await import('@/messages');
  return {
    title: t('ui.meta.title', undefined, 'en'),
    description: t('ui.meta.description', undefined, 'en'),
  };
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  // Make `translate` without explicit locale use this request's locale (server)
  (globalThis as unknown as { __RINSETU_LOCALE__?: string }).__RINSETU_LOCALE__ = locale;
  const messages = await getMessages();
  const { translate: t } = await import('@/messages');

  return (
    <html lang={locale}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${sourceSerif.variable} antialiased`}
      >
        <NextIntlClientProvider messages={messages} locale={locale}>
          <header className="border-rule bg-paper-edge border-b">
            <div className="mx-auto flex max-w-3xl flex-wrap items-baseline gap-x-4 gap-y-1 px-4 py-3">
              <a href="/" className="font-serif text-lg leading-none font-semibold tracking-tight">
                RinSetu
              </a>
              {/*
              No tagline here. It is the front page's <h1>, and printing the same
              sentence twice on the same screen was the loudest bit of clutter on it.
              The footer carries what this build is.
            */}
              <nav className="no-print ml-auto flex items-center gap-4 text-xs">
                <a href="/apply" className="text-accent hover:underline">
                  {t('ui.nav.apply', undefined, locale as never)}
                </a>
                <a href="/personas" className="text-accent hover:underline">
                  {t('ui.nav.personas', undefined, locale as never)}
                </a>
                <LocaleSwitcher />
              </nav>
            </div>
          </header>

          <main className="mx-auto max-w-3xl px-4 pt-6 pb-16">{children}</main>

          <footer className="border-rule text-ink-3 border-t px-4 py-6 text-xs">
            <div className="mx-auto max-w-3xl">
              <p>{t('ui.footer.build', undefined, locale as never)}</p>
              <p className="mt-2">{t('ui.footer.not_an_offer', undefined, locale as never)}</p>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
