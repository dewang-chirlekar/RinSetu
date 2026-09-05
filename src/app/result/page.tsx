/**
 * src/app/result/page.tsx
 *
 * The whole answer, on one URL.
 *
 * Reads answers out of the query string, runs the real engine, and renders every
 * scheme. Nothing is computed on this page — `recommend()` produces the result and
 * this file arranges it. That separation is what lets the same numbers be asserted
 * in tests without a browser.
 *
 * Three states other than the happy path, all of them deliberate:
 *
 *   - No answers at all → point back at the form. Not an error.
 *   - A query string the form could not have produced (a hand-edited `age=999`)
 *     → say the link is unreadable rather than parse around it. Zod throws here on
 *     purpose; catching it and substituting a default would silently answer a
 *     question the applicant never asked.
 *   - `?persona=P01` → run a committed fixture instead, labelled as a test case so
 *     nobody mistakes a fixture for a real applicant.
 */

import { ZodError } from 'zod';
import { getLocale } from 'next-intl/server';
import { recommend } from '@/core/recommend';
import type { ApplicantProfile, SchemeSpec } from '@/core/types';
import { loadBundle, loadPersonas } from '@/lib/dataset';
import { isEmptyParams, parseApplicantParams, applicantToParams } from '@/lib/applicant-params';
import { humanisePurpose, longDateTime, rupees } from '@/lib/format';
import { translate, type Locale } from '@/messages';
import { DatasetBanner } from '@/components/DatasetBanner';
import { ExplainPanel } from '@/components/ExplainPanel';
import { LoanConfirmation } from '@/components/LoanConfirmation';
import { SchemeCard } from '@/components/SchemeCard';
import { FieldRow, PrimaryLink, SecondaryLink, Section } from '@/components/ui';

type RawParams = Record<string, string | string[] | undefined>;

function one(params: RawParams, key: string): string | null {
  const value = params[key];
  const candidate = Array.isArray(value) ? value[0] : value;
  return candidate ?? null;
}

/**
 * A scheme the engine evaluated must exist in the dataset the engine was handed —
 * so a miss here is a wiring bug, not a user-facing condition. Fail loudly rather
 * than rendering a card with no parameters behind it.
 */
function schemeFor(map: Map<string, SchemeSpec>, code: string): SchemeSpec {
  const scheme = map.get(code);
  if (!scheme) {
    throw new Error(`No SchemeSpec for '${code}'. recommend() and loadBundle() are out of step.`);
  }
  return scheme;
}

function Notice({
  heading,
  detail,
  children,
}: {
  heading: string;
  detail: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="sheet mt-6 px-4 py-5">
      <h1 className="text-ink font-serif text-xl font-semibold">{heading}</h1>
      <p className="text-ink-2 mt-2 text-sm leading-relaxed">{detail}</p>
      <div className="mt-4 flex flex-wrap gap-3">{children}</div>
    </div>
  );
}

/**
 * What we were told, echoed back before any verdict. An applicant who sees a
 * surprising answer needs to be able to check whether the input was misread — so
 * this list shows unanswered questions as "Not known" rather than omitting them.
 */
function AnswerSummary({ applicant, locale }: { applicant: ApplicantProfile; locale: Locale }) {
  const t = (key: string, values?: Record<string, string | number | null | undefined>) =>
    translate(key, values, locale);
  const unknown = t('common.unknown');
  const rows: { label: string; value: string }[] = [
    { label: t('ui.apply.age'), value: applicant.age === null ? unknown : String(applicant.age) },
    { label: t('ui.apply.category'), value: t(`ui.category.${applicant.category}`) },
    {
      label: t('ui.apply.income'),
      value: applicant.annual_family_income === null ? unknown : rupees(applicant.annual_family_income),
    },
    {
      label: t('ui.apply.state'),
      value: applicant.state ?? unknown,
    },
    {
      label: t('ui.apply.district'),
      value: applicant.district ?? unknown,
    },
    { label: t('ui.apply.intent'), value: t(`ui.intent.${applicant.intent}`) },
    {
      label: t('ui.apply.purpose'),
      value: applicant.purpose === null ? unknown : humanisePurpose(applicant.purpose),
    },
    {
      label: t('ui.apply.project_cost'),
      value: applicant.project_cost === null ? unknown : rupees(applicant.project_cost),
    },
    {
      label: t('ui.apply.own_funds'),
      value:
        applicant.own_funds_available === null || applicant.own_funds_available === undefined
          ? unknown
          : rupees(applicant.own_funds_available),
    },
  ];

  if (applicant.education) {
    const admission = applicant.education.admission_confirmed;
    rows.push({
      label: t('ui.apply.edu_admission'),
      value: admission === null ? unknown : admission ? t('common.yes') : t('common.no'),
    });
    if (applicant.education.study_location) {
      rows.push({
        label: t('ui.apply.edu_location'),
        value: t(`ui.study_location.${applicant.education.study_location}`),
      });
    }
  }

  return (
    <dl className="border-rule border-t">
      {rows.map((row) => (
        <FieldRow key={row.label} label={row.label} value={row.value} />
      ))}
    </dl>
  );
}

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const locale = (await getLocale()) as Locale;
  (globalThis as unknown as { __RINSETU_LOCALE__?: string }).__RINSETU_LOCALE__ = locale;
  const t = (key: string, values?: Record<string, string | number | null | undefined>) =>
    translate(key, values, locale);

  if (isEmptyParams(params)) {
    return (
      <Notice heading={t('ui.result.empty_heading')} detail={t('ui.result.empty_detail')}>
        <PrimaryLink href="/apply">{t('ui.nav.apply')}</PrimaryLink>
        <SecondaryLink href="/personas">{t('ui.nav.personas')}</SecondaryLink>
      </Notice>
    );
  }

  const personaId = one(params, 'persona');
  const persona = personaId ? loadPersonas().find((entry) => entry.id === personaId) : undefined;

  let applicant: ApplicantProfile;
  if (persona) {
    applicant = persona.applicant;
  } else {
    try {
      applicant = parseApplicantParams(params);
    } catch (error) {
      if (!(error instanceof ZodError)) throw error;
      return (
        <Notice heading={t('ui.result.invalid_heading')} detail={t('ui.result.invalid_detail')}>
          <PrimaryLink href="/apply">{t('ui.nav.apply')}</PrimaryLink>
        </Notice>
      );
    }
  }

  const bundle = loadBundle();
  const result = recommend({
    applicant,
    ...bundle,
    generatedAt: new Date().toISOString(),
  });

  const recommended = result.schemes.find(
    (entry) => entry.scheme_code === result.recommended_scheme_code,
  );
  const others = result.schemes.filter((entry) => entry !== recommended);
  const schemeByCode = new Map(bundle.dataset.schemes.map((scheme) => [scheme.code, scheme]));
  const editHref = `/apply?${applicantToParams(applicant).toString()}`;
  const packetHref = persona ? `/api/packet?persona=${persona.id}` : `/api/packet?${applicantToParams(applicant).toString()}`;

  return (
    <div>
      <DatasetBanner dataset={result.dataset} />

      {persona ? (
        <div className="border-rule-strong bg-paper-sunk mt-4 border-l-[3px] px-3.5 py-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="stamp stamp-tilt text-ink-2">
              {t('ui.result.persona_heading', { id: persona.id })}
            </span>
            <span className="text-ink text-xs font-medium">{persona.label}</span>
          </div>
          <p className="text-ink-3 mt-1.5 text-xs leading-relaxed">
            {t('ui.result.persona_detail', { tests: persona.tests.join(' · ') })}
          </p>
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-ink font-serif text-2xl leading-tight font-semibold">
          {applicant.name ? t('ui.result.for', { name: applicant.name }) : t('ui.result.heading')}
        </h1>
        <span className="text-ink-3 text-xs">
          {t('recommendation.generated_at', {
            timestamp: longDateTime(result.generated_at),
          })}
        </span>
      </div>

      <div className="no-print mt-3">
        <SecondaryLink href={editHref}>{t('ui.result.edit')}</SecondaryLink>
      </div>

      <Section title={t('ui.result.answers_heading')}>
        <AnswerSummary applicant={applicant} locale={locale} />
      </Section>

      {recommended ? (
        <>
          <SchemeCard
            recommendation={recommended}
            scheme={schemeFor(schemeByCode, recommended.scheme_code)}
            applicant={applicant}
            isRecommended
          />
          <div className="sheet mt-4 px-4 py-4">
            <h3 className="text-ink font-serif text-sm font-semibold">
              {t('ui.result.download_packet')}
            </h3>
            <p className="text-ink-2 mt-1 text-xs leading-relaxed">
              {t('ui.result.download_packet_detail')}
            </p>
            <div className="mt-3">
              <a
                href={packetHref}
                className="bg-accent text-paper inline-flex items-center px-4 py-2 text-sm font-medium"
                target="_blank"
                rel="noopener"
              >
                {t('ui.result.download_packet')}
              </a>
            </div>
          </div>
          <ExplainPanel result={result} />
          <LoanConfirmation recommendation={recommended} applicant={applicant} />
        </>
      ) : (
        <p className="border-hold bg-hold-soft text-ink mt-6 border-l-[3px] px-3.5 py-3 text-sm">
          {t('recommendation.none')}
        </p>
      )}

      <Section title={t('ui.result.schemes_heading')}>
        <p className="text-ink-2 text-xs leading-relaxed">{t('ui.result.schemes_note')}</p>
        {others.map((entry) => (
          <SchemeCard
            key={entry.scheme_code}
            recommendation={entry}
            scheme={schemeFor(schemeByCode, entry.scheme_code)}
            applicant={applicant}
            isRecommended={false}
          />
        ))}
      </Section>
    </div>
  );
}
