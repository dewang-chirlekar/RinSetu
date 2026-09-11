/**
 * src/app/applications/[id]/page.tsx
 *
 * Shows one saved receipt exactly as it was stored. Does not re-run
 * recommend() — the point is that a file reopened months later still shows
 * the numbers it was actually given that day (prisma/schema.prisma:367).
 */

import { getLocale } from 'next-intl/server';
import { translate, type Locale } from '@/messages';
import { getPrisma, hasDatabaseUrl, isDbUnreachableError } from '@/lib/db';
import { applicantToParams } from '@/lib/applicant-params';
import { loadBundle } from '@/lib/dataset';
import { humanisePurpose, longDateTime, rupees } from '@/lib/format';
import { SchemeCard } from '@/components/SchemeCard';
import { DatasetBanner } from '@/components/DatasetBanner';
import { FieldRow, SecondaryLink, Section } from '@/components/ui';
import type { ApplicantProfile, RecommendationResult, SchemeSpec } from '@/core/types';

export const dynamic = 'force-dynamic';

function schemeFor(map: Map<string, SchemeSpec>, code: string): SchemeSpec {
  const s = map.get(code);
  if (!s) throw new Error(`No SchemeSpec for '${code}'`);
  return s;
}

function AnswerSummary({ applicant, locale }: { applicant: ApplicantProfile; locale: Locale }) {
  const t = (k: string, v?: Record<string, string | number | null | undefined>) => translate(k, v, locale);
  const unknown = t('common.unknown');
  const rows: { label: string; value: string }[] = [
    { label: t('ui.apply.age'), value: applicant.age === null ? unknown : String(applicant.age) },
    { label: t('ui.apply.category'), value: t(`ui.category.${applicant.category}`) },
    { label: t('ui.apply.income'), value: applicant.annual_family_income === null ? unknown : rupees(applicant.annual_family_income) },
    { label: t('ui.apply.state'), value: applicant.state ?? unknown },
    { label: t('ui.apply.district'), value: applicant.district ?? unknown },
    { label: t('ui.apply.intent'), value: t(`ui.intent.${applicant.intent}`) },
    { label: t('ui.apply.purpose'), value: applicant.purpose === null ? unknown : humanisePurpose(applicant.purpose) },
    { label: t('ui.apply.project_cost'), value: applicant.project_cost === null ? unknown : rupees(applicant.project_cost) },
  ];
  if (applicant.education) {
    const a = applicant.education.admission_confirmed;
    rows.push({ label: t('ui.apply.edu_admission'), value: a === null ? unknown : a ? t('common.yes') : t('common.no') });
  }
  return (
    <dl className="border-rule border-t">
      {rows.map((r) => (
        <FieldRow key={r.label} label={r.label} value={r.value} />
      ))}
    </dl>
  );
}

export default async function ApplicationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const locale = (await getLocale()) as Locale;
  (globalThis as unknown as { __RINSETU_LOCALE__?: string }).__RINSETU_LOCALE__ = locale;
  const t = (k: string, v?: Record<string, string | number | null | undefined>) => translate(k, v, locale);

  if (!hasDatabaseUrl()) {
    return (
      <div className="sheet mt-6 px-4 py-5">
        <h1 className="text-ink font-serif text-xl font-semibold">{t('ui.applications.needs_db_heading')}</h1>
        <p className="text-ink-2 mt-2 text-sm leading-relaxed">{t('ui.applications.needs_db_detail')}</p>
      </div>
    );
  }

  let row: {
    id: string;
    applicant: unknown;
    result: unknown;
    schemeCode: string | null;
    partnerCode: string | null;
    datasetLabel: string;
    figuresAuthoritative: boolean;
    language: string;
    createdAt: Date;
    updatedAt: Date;
  } | null = null;

  try {
    const db = getPrisma();
    row = await db.application.findUnique({
      where: { id },
      select: {
        id: true,
        applicant: true,
        result: true,
        schemeCode: true,
        partnerCode: true,
        datasetLabel: true,
        figuresAuthoritative: true,
        language: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  } catch (e) {
    if (isDbUnreachableError(e)) {
      return (
        <div className="sheet mt-6 px-4 py-5">
          <h1 className="text-ink font-serif text-xl font-semibold">{t('ui.applications.save_error')}</h1>
          <p className="text-ink-2 mt-2 text-sm">Database unreachable — try again.</p>
        </div>
      );
    }
    throw e;
  }

  if (!row) {
    return (
      <div className="sheet mt-6 px-4 py-5">
        <h1 className="text-ink font-serif text-xl font-semibold">{t('ui.applications.not_found_heading')}</h1>
        <p className="text-ink-2 mt-2 text-sm leading-relaxed">{t('ui.applications.not_found_detail')}</p>
        <div className="mt-4">
          <SecondaryLink href="/applications">{t('ui.applications.back_to_list')}</SecondaryLink>
        </div>
      </div>
    );
  }

  const applicant = row.applicant as unknown as ApplicantProfile;
  const result = row.result as unknown as RecommendationResult;
  const bundle = loadBundle();
  const schemeByCode = new Map(bundle.dataset.schemes.map((s) => [s.code, s]));
  const recommended = result.schemes.find((s) => s.scheme_code === result.recommended_scheme_code) ?? null;
  const others = result.schemes.filter((s) => s !== recommended);
  const editHref = `/apply?${applicantToParams(applicant).toString()}`;
  const reapplyHref = `/result?${applicantToParams(applicant).toString()}`;

  // Build a tiny dataset banner from stored fields (label + authoritative flag).
  // Full provenance lives inside result.schemes[*].computation.rate_provenance etc.
  const datasetForBanner = {
    label: row.datasetLabel,
    figures_authoritative: row.figuresAuthoritative,
    overlay_applied: row.datasetLabel.includes('DEMO'),
    notes: row.figuresAuthoritative ? [] : ['dataset.note.unverified_figures_present'],
    schemes: bundle.dataset.schemes,
    global: bundle.dataset.global,
  } as unknown as typeof bundle.dataset;

  return (
    <div>
      <DatasetBanner dataset={datasetForBanner} />

      <div className="mt-3 flex flex-wrap gap-2">
        <SecondaryLink href="/applications">{t('ui.applications.back_to_list')}</SecondaryLink>
        <SecondaryLink href={editHref}>{t('ui.result.edit')}</SecondaryLink>
        <a href={reapplyHref} className="border-rule text-ink inline-flex items-center border bg-white px-3 py-1.5 text-xs hover:bg-[var(--paper-sunk)]">
          {t('ui.applications.reapply')}
        </a>
      </div>

      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="text-ink font-serif text-2xl font-semibold">
          {applicant.name ? t('ui.result.for', { name: applicant.name }) : t('ui.result.heading')}
        </h1>
        <span className="text-ink-3 text-xs">{t('ui.applications.saved_at', { date: longDateTime(row.createdAt.toISOString()) })}</span>
      </div>
      <p className="text-ink-3 mt-1 text-xs">
        {t('recommendation.generated_at', { timestamp: longDateTime(result.generated_at) })} · <span className="font-mono">{row.id.slice(0, 8)}</span> · {row.datasetLabel} {row.figuresAuthoritative ? '' : '· Illustrative'}
      </p>

      <Section title={t('ui.result.answers_heading')}>
        <AnswerSummary applicant={applicant} locale={locale} />
      </Section>

      {recommended ? (
        <>
          <SchemeCard recommendation={recommended} scheme={schemeFor(schemeByCode, recommended.scheme_code)} applicant={applicant} isRecommended />
          <div className="sheet mt-4 px-4 py-4">
            <h3 className="text-ink font-serif text-sm font-semibold">{t('ui.result.download_packet')}</h3>
            <p className="text-ink-2 mt-1 text-xs leading-relaxed">{t('ui.result.download_packet_detail')}</p>
            <div className="mt-3">
              <a
                href={`/api/packet?${applicantToParams(applicant).toString()}`}
                className="bg-accent text-paper inline-flex items-center px-4 py-2 text-sm font-medium"
                target="_blank"
                rel="noopener"
              >
                {t('ui.result.download_packet')}
              </a>
            </div>
          </div>
        </>
      ) : (
        <p className="border-hold bg-hold-soft text-ink mt-6 border-l-[3px] px-3.5 py-3 text-sm">{t('recommendation.none')}</p>
      )}

      <Section title={t('ui.result.schemes_heading')}>
        <p className="text-ink-2 text-xs leading-relaxed">{t('ui.result.schemes_note')}</p>
        {others.map((entry) => (
          <SchemeCard key={entry.scheme_code} recommendation={entry} scheme={schemeFor(schemeByCode, entry.scheme_code)} applicant={applicant} isRecommended={false} />
        ))}
      </Section>
    </div>
  );
}
