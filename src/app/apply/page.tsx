/**
 * src/app/apply/page.tsx
 *
 * Server wrapper for the progressive intake form. Loads the dataset (the only
 * place the JSON is read) and hands it to the client component that handles
 * disclosure. The form posts to /api/intake, which stores the validated profile
 * in an HttpOnly cookie and redirects to /result; no personal data is placed in
 * the URL. This page reads that cookie back when the user clicks "Edit", and
 * accepts ?persona=P01 so a fixture can be opened in the form without dumping
 * the fixture's fields into the query string.
 */

import { getLocale } from 'next-intl/server';
import { loadBundle, loadPersonas } from '@/lib/dataset';
import { isEmptyParams } from '@/lib/applicant-params';
import { readProfileCookie } from '@/lib/intake-session';
import { profileToParams } from '@/lib/intake-params';
import { translate, type Locale } from '@/messages';
import { ApplyForm } from '@/components/ApplyForm';
import { FreeTextIntake } from '@/components/FreeTextIntake';

type RawParams = Record<string, string | string[] | undefined>;

export default async function ApplyPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams;
  const locale = (await getLocale()) as Locale;
  (globalThis as unknown as { __RINSETU_LOCALE__?: string }).__RINSETU_LOCALE__ = locale;
  const t = (key: string, values?: Record<string, string | number | null | undefined>) =>
    translate(key, values, locale);
  const { dataset, partners, documentDefinitions, documentRequirements } = loadBundle();

  const personaId = Array.isArray(params.persona) ? params.persona[0] : params.persona;
  const persona = personaId ? loadPersonas().find((entry) => entry.id === personaId) : undefined;

  // Precedence: an explicit persona, then a legacy PII query string (old links
  // still work), then the HttpOnly cookie written by the POST intake. New
  // submissions only ever take the cookie path.
  const legacyParams = { ...params };
  delete legacyParams.persona;
  const hasLegacyParams = !isEmptyParams(legacyParams);
  const cookieProfile = persona || hasLegacyParams ? null : await readProfileCookie();

  const initialParams = persona
    ? profileToParams(persona.applicant)
    : hasLegacyParams
      ? legacyParams
      : cookieProfile
        ? profileToParams(cookieProfile)
        : {};

  return (
    <div>
      <h1 className="text-ink font-serif text-2xl leading-tight font-semibold">{t('ui.apply.heading')}</h1>
      <p className="text-ink-2 mt-2 text-sm leading-relaxed">{t('ui.apply.lede')}</p>
      <p className="border-accent bg-accent-soft text-ink-2 mt-3 border-l-[3px] px-3.5 py-2.5 text-xs leading-relaxed">
        {t('ui.apply.blank_hint')}
      </p>
      <FreeTextIntake />

      <ApplyForm
        dataset={dataset}
        partners={partners}
        documentDefinitions={documentDefinitions}
        documentRequirements={documentRequirements}
        initialParams={initialParams}
      />
    </div>
  );
}
