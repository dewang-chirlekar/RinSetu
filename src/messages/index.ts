/**
 * src/messages/index.ts
 *
 * A 40-line stand-in for next-intl.
 *
 * Session 1 must not wire next-intl (that is Phase 7), but hard rule 3 requires
 * every string to be a key from now on. So this resolves a dotted key against
 * en.json and substitutes {braced} placeholders. The call sites are written the
 * way next-intl call sites are written, so Phase 7 replaces this file and the
 * provider, not the components.
 *
 * Deliberately strict: a missing key throws in development rather than rendering
 * the key itself. A screen reading 'predicate.AGE_WITHIN_RANGE.fail' at a demo
 * is worse than a stack trace during development.
 */

import en from './en.json';
import hi from './hi.json';
import mr from './mr.json';

export type MessageValues = Record<string, string | number | null | undefined>;

const CATALOGUES = { en, hi, mr } as const;
export type Locale = keyof typeof CATALOGUES;
export const DEFAULT_LOCALE: Locale = 'en';

/** Locales the UI offers. hi/mr populated 2026-09-05 (human-written UI keys, scheme names/amounts kept English per glossary). */
export const PLANNED_LOCALES = ['en', 'hi', 'mr'] as const;
export const LOCALES = PLANNED_LOCALES;

function lookup(catalogue: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, segment) => {
    if (node && typeof node === 'object' && segment in node) {
      return (node as Record<string, unknown>)[segment];
    }
    return undefined;
  }, catalogue);
}

function interpolate(template: string, values?: MessageValues): string {
  if (!values) return template;
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = values[name];
    return value === undefined || value === null ? whole : String(value);
  });
}

declare global {
  // Set per-request by server components (layout, result, apply) after `await getLocale()`.
  // Lets `translate` stay sync while still being request-locale-aware on the server.
  var __RINSETU_LOCALE__: Locale | undefined;
}

export function translate(key: string, values?: MessageValues, locale: Locale = DEFAULT_LOCALE): string {
  // Effective locale: explicit param wins, else per-request global (server), else
  // client `locale` cookie (client components like ApplyForm), else default.
  let effective: Locale = locale;
  if (locale === DEFAULT_LOCALE) {
    const fromGlobal =
      typeof globalThis !== 'undefined' ? (globalThis as unknown as { __RINSETU_LOCALE__?: Locale }).__RINSETU_LOCALE__ : undefined;
    if (fromGlobal && (LOCALES as readonly string[]).includes(fromGlobal)) {
      effective = fromGlobal;
    } else if (typeof document !== 'undefined') {
      try {
        const m = document.cookie.match(/(?:^|; )locale=([^;]+)/);
        const fromCookie = m?.[1];
        if (fromCookie && (LOCALES as readonly string[]).includes(fromCookie)) {
          effective = fromCookie as Locale;
        }
      } catch {
        // ignore
      }
    }
  }
  const found = lookup(CATALOGUES[effective], key) ?? lookup(CATALOGUES[DEFAULT_LOCALE], key);
  if (typeof found !== 'string') {
    throw new Error(`Missing message key '${key}'. Add it to src/messages/en.json.`);
  }
  return interpolate(found, values);
}

/** Same lookup, but returns null instead of throwing. For optional notes_key. */
export function translateOptional(
  key: string | null | undefined,
  values?: MessageValues,
  locale: Locale = DEFAULT_LOCALE,
): string | null {
  if (!key) return null;
  const found = lookup(CATALOGUES[locale], key) ?? lookup(CATALOGUES[DEFAULT_LOCALE], key);
  return typeof found === 'string' ? interpolate(found, values) : null;
}

export function hasMessage(key: string, locale: Locale = DEFAULT_LOCALE): boolean {
  return typeof lookup(CATALOGUES[locale], key) === 'string';
}

/** Every leaf key in a catalogue. Used by tests/messages.coverage.test.ts. */
export function allMessageKeys(locale: Locale = DEFAULT_LOCALE): string[] {
  const out: string[] = [];
  const walk = (node: unknown, prefix: string): void => {
    if (typeof node === 'string') {
      out.push(prefix);
      return;
    }
    if (node && typeof node === 'object') {
      for (const [name, child] of Object.entries(node as Record<string, unknown>)) {
        walk(child, prefix ? `${prefix}.${name}` : name);
      }
    }
  };
  walk(CATALOGUES[locale], '');
  return out.filter((key) => !key.startsWith('_'));
}

/** Convenience alias so components read like next-intl call sites. */
export const t = translate;
