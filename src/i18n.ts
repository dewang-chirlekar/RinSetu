import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';

export default getRequestConfig(async ({ requestLocale }) => {
  const supported = ['en', 'hi', 'mr'] as const;

  // 1) next-intl's requestLocale (from middleware / URL segment, if present)
  const fromNextIntl = await requestLocale;

  // 2) Our `locale` cookie — set by <LocaleSwitcher>
  let fromCookie: string | undefined;
  try {
    fromCookie = (await cookies()).get('locale')?.value;
  } catch {
    // next/headers only in server context
  }

  // 3) Accept-Language header fallback
  let fromHeader: string | undefined;
  try {
    const accept = (await headers()).get('accept-language');
    if (accept) fromHeader = accept.split(',')[0]?.split(';')[0]?.trim();
  } catch {
    // ignore
  }

  const raw = fromNextIntl ?? fromCookie ?? fromHeader ?? 'en';
  const lower = raw.toLowerCase().slice(0, 2);
  const resolved = (supported as readonly string[]).includes(lower) ? lower : 'en';

  // Static imports for bundler — variable template would create a context
  let messages: Record<string, unknown>;
  if (resolved === 'hi') messages = (await import('./messages/hi.json')).default;
  else if (resolved === 'mr') messages = (await import('./messages/mr.json')).default;
  else messages = (await import('./messages/en.json')).default;

  return {
    locale: resolved,
    messages,
  };
});
