/**
 * src/components/SchemeCard.tsx
 *
 * One scheme, end to end: verdict → figures → where to apply → what to carry.
 *
 * Every scheme in the dataset gets a card, including the ones the applicant fails
 * (CLAUDE.md hard rule 4). The recommended scheme renders open; the rest render
 * collapsed but present, with their status visible on the summary line. Collapsing
 * is a density decision — do not change it into filtering.
 *
 * Note the ordering inside an eligible card: verdict first, then figures. A number
 * shown before the eligibility that justifies it reads as an offer.
 */

import type { ApplicantProfile, SchemeRecommendation, SchemeSpec } from '@/core/types';
import { RECOMMENDATION_POLICY } from '@/core/recommend';
import { translate } from '@/messages';
import { ChecklistPanel } from './ChecklistPanel';
import { LoanFigures } from './LoanFigures';
import { PartnerPanel } from './PartnerPanel';
import { VerdictList } from './VerdictList';
import { Section, StatusPill, ToggleLabel } from './ui';

/** Scheme names are per-locale data, not message keys. English is the fallback. */
function schemeName(names: Record<string, string>, language: string): string {
  return names[language] ?? names.en ?? Object.values(names)[0] ?? '';
}

function CardBody({
  recommendation,
  scheme,
  applicant,
}: {
  recommendation: SchemeRecommendation;
  scheme: SchemeSpec;
  applicant: ApplicantProfile;
}) {
  return (
    <>
      <p className="text-ink-2 mt-2 text-xs leading-relaxed">
        {translate(recommendation.description_key)}
      </p>

      <Section title={translate('status.' + recommendation.status)}>
        <p className="text-ink-2 mb-3 text-xs leading-relaxed">
          {translate(`status.${recommendation.status}_detail`)}
        </p>
        <VerdictList
          verdicts={recommendation.verdicts}
          remediations={recommendation.remediations}
        />
      </Section>

      {recommendation.computation ? (
        <Section title={translate('loan.loan')}>
          <LoanFigures
            scheme={scheme}
            computation={recommendation.computation}
            requestedMoratorium={applicant.requested_moratorium_months ?? null}
          />
        </Section>
      ) : null}

      {recommendation.partners ? (
        <Section title={translate('partner.heading')}>
          <PartnerPanel result={recommendation.partners} />
        </Section>
      ) : null}

      {recommendation.checklist ? (
        <Section title={translate('checklist.heading')}>
          <ChecklistPanel checklist={recommendation.checklist} />
        </Section>
      ) : null}
    </>
  );
}

export function SchemeCard({
  recommendation,
  scheme,
  applicant,
  isRecommended,
}: {
  recommendation: SchemeRecommendation;
  scheme: SchemeSpec;
  applicant: ApplicantProfile;
  isRecommended: boolean;
}) {
  const name = schemeName(recommendation.scheme_name_i18n, applicant.preferred_language);

  const heading = (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <h2 className="text-ink text-lg leading-tight">{name}</h2>
      <StatusPill status={recommendation.status} />
      {isRecommended ? (
        <span className="stamp text-accent">{translate('recommendation.heading')}</span>
      ) : null}
    </div>
  );

  if (isRecommended) {
    return (
      <article className="sheet border-accent mt-5 border-t-2 px-4 py-4 sm:px-5">
        {heading}
        <p className="text-ink-3 mt-1.5 text-xs leading-relaxed">
          {translate(RECOMMENDATION_POLICY.messageKey)}
        </p>
        <CardBody recommendation={recommendation} scheme={scheme} applicant={applicant} />
      </article>
    );
  }

  return (
    <details className="sheet mt-3 px-4 py-3 sm:px-5">
      <summary className="cursor-pointer list-none">
        {heading}
        <ToggleLabel className="text-accent mt-1 inline-block text-xs" />
      </summary>
      <CardBody recommendation={recommendation} scheme={scheme} applicant={applicant} />
    </details>
  );
}
