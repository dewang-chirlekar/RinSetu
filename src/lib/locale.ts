/**
 * src/lib/locale.ts
 *
 * Phase 7 — locale detection. Boring, readable, no cleverness.
 *
 * Order: explicit `?hl=` or `?locale=` param > `locale` cookie > Accept-Language header > default 'en'.
 * `hl` is used in the UI switcher so a shared link preserves language.
 * Scheme names / amounts are never translated — see do-not-translate glossary in
 * src/messages/en.json `_README` and `docs/PROGRESS.md` §3.3.
 */

import type { Locale } from '@/messages';
import { DEFAULT_LOCALE, LOCALES } from '@/messages';

function normalize(value: string | null | undefined): Locale | null {
  if (!value) return null;
  const lower = value.toLowerCase().slice(0, 2);
  if ((LOCALES as readonly string[]).includes(lower)) return lower as Locale;
  // 'hi-IN' -> 'hi', 'mr-IN' -> 'mr'
  if (lower === 'hi' || lower === 'mr') return lower as Locale;
  return null;
}

export async function getLocaleFromRequest(request?: Request): Promise<Locale> {
  // 1) URL param `hl` or `locale` (for sharing)
  if (request) {
    try {
      const url = new URL(request.url);
      const param = url.searchParams.get('hl') ?? url.searchParams.get('locale');
      const fromParam = normalize(param);
      if (fromParam) return fromParam;
    } catch {
      // ignore
    }
  }

  // 2) Cookie `locale` — set by LocaleSwitcher (client) or middleware
  try {
    const { cookies } = await import('next/headers');
    const store = await cookies();
    const fromCookie = normalize(store.get('locale')?.value);
    if (fromCookie) return fromCookie;
  } catch {
    // next/headers only works in server context
  }

  // 3) Accept-Language header
  try {
    const { headers } = await import('next/headers');
    const h = await headers();
    const accept = h.get('accept-language');
    if (accept) {
      for (const part of accept.split(',')) {
        const lang = part.split(';')[0]?.trim();
        const norm = normalize(lang);
        if (norm) return norm;
      }
    }
  } catch {
    // ignore
  }

  return DEFAULT_LOCALE;
}

/** For client components — reads cookie or navigator language. */
export function getLocaleClient(): Locale {
  if (typeof document !== 'undefined') {
    const cookie = document.cookie
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('locale='));
    const fromCookie = normalize(cookie?.split('=')[1]);
    if (fromCookie) return fromCookie;
  }
  if (typeof navigator !== 'undefined') {
    const norm = normalize(navigator.language);
    if (norm) return norm;
  }
  return DEFAULT_LOCALE;
}
