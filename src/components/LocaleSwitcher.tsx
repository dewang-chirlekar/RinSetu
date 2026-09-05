'use client';

import { useEffect, useRef, useState } from 'react';
import { Globe } from 'lucide-react';
import { LOCALES, type Locale } from '@/messages';
import { getLocaleClient } from '@/lib/locale';

const LABELS: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  mr: 'मराठी',
};

const NATIVE_LABELS: Record<Locale, string> = {
  en: 'English',
  hi: 'हिन्दी — Hindi',
  mr: 'मराठी — Marathi',
};

export function LocaleSwitcher() {
  const [locale, setLocale] = useState<Locale>('en');
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLocale(getLocaleClient());
  }, []);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  function switchTo(next: Locale) {
    document.cookie = `locale=${next}; path=/; max-age=31536000; SameSite=Lax`;
    setOpen(false);
    window.location.reload();
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="border-rule text-ink-2 hover:text-ink hover:bg-paper-sunk inline-flex h-7 w-7 items-center justify-center border bg-white"
        aria-label="Change language"
        aria-expanded={open}
        aria-haspopup="menu"
        title={`Language: ${LABELS[locale]}`}
      >
        <Globe className="h-3.5 w-3.5" aria-hidden />
      </button>
      {open ? (
        <div
          role="menu"
          className="border-rule bg-paper-edge absolute right-0 z-50 mt-1 min-w-[160px] border py-1 shadow-sm"
        >
          {LOCALES.map((code) => {
            const isActive = locale === code;
            return (
              <button
                key={code}
                role="menuitem"
                onClick={() => switchTo(code as Locale)}
                className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs ${isActive ? 'bg-accent text-paper' : 'text-ink hover:bg-paper-sunk'}`}
                aria-current={isActive ? 'true' : undefined}
              >
                <span>{NATIVE_LABELS[code as Locale]}</span>
                {isActive ? <span aria-hidden>✓</span> : null}
              </button>
            );
          })}
          <div className="border-rule mt-1 border-t px-3 py-1.5 text-[0.6875rem] leading-snug text-[#7b766a]">
            Scheme names &amp; amounts stay in English
          </div>
        </div>
      ) : null}
    </div>
  );
}
