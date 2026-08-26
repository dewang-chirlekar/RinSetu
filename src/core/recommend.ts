/**
 * src/core/recommend.ts
 *
 * The one entry point the UI, the CLI and the tests all call. Takes a validated
 * ApplicantProfile plus the datasets, returns a RecommendationResult covering
 * every scheme.
 *
 * Order of operations, and why:
 *
 *   1. Evaluate eligibility for all schemes, keeping failures (hard rule 4).
 *   2. Compute figures ONLY for eligible schemes. We do not quote an EMI for a
 *      scheme the applicant cannot have — a number on screen reads as an offer.
 *      (Phase 5 will add a clearly-labelled indicative figure to the
 *      path-to-eligibility panel; that is a UI affordance and it will be built
 *      as one, not smuggled in here.)
 *   3. Match partners only once a loan exists, because ticket range is a hard
 *      filter that needs the amount.
 *   4. Resolve the scheme-baseline checklist. The UI re-resolves it against the
 *      chosen partner's type when the applicant picks one.
 *
 * Pure and synchronous. `generated_at` is passed in — the core never reads the
 * clock, so a persona snapshot is byte-stable.
 */

import { evaluateScheme } from './eligibility/engine';
import { remediateAll } from './eligibility/remediation';
import { computeLoan } from './finance/loan';
import { resolveChecklist } from './documents/resolve';
import { matchPartners } from './partners/match';
import type { HealthScoringConfig } from './partners/health';
import type {
  ApplicantProfile,
  DocumentDefinition,
  DocumentRequirement,
  Partner,
  PartnerHealthRecord,
  RecommendationResult,
  SchemeDataset,
  SchemeRecommendation,
} from './types';

export interface RecommendInput {
  applicant: ApplicantProfile;
  dataset: SchemeDataset;
  partners: Partner[];
  health: Map<string, PartnerHealthRecord>;
  healthConfig: HealthScoringConfig;
  documentDefinitions: DocumentDefinition[];
  documentRequirements: DocumentRequirement[];
  /** ISO timestamp supplied by the caller. */
  generatedAt: string;
}

/**
 * How the headline recommendation is chosen when more than one scheme is
 * eligible. This is OUR stated heuristic, not a scheme rule, which is why it is
 * named, exported and rendered in the UI next to the recommendation:
 *
 *   1. Prefer the scheme that funds the largest share of the project cost.
 *   2. Tie-break on the lower interest rate.
 *   3. Tie-break on scheme code, so the result is deterministic.
 *
 * Deliberately not "the largest loan" — a bigger loan is not automatically a
 * better outcome for a borrower, but covering more of the project you actually
 * described is.
 */
export const RECOMMENDATION_POLICY = {
  messageKey: 'recommendation.policy.largest_share_then_lowest_rate',
  criteria: ['SHARE_OF_PROJECT_COST_DESC', 'ANNUAL_RATE_ASC', 'SCHEME_CODE_ASC'] as const,
};

export function recommend(input: RecommendInput): RecommendationResult {
  const {
    applicant,
    dataset,
    partners,
    health,
    healthConfig,
    documentDefinitions,
    documentRequirements,
    generatedAt,
  } = input;

  const schemes: SchemeRecommendation[] = dataset.schemes.map((scheme) => {
    const evaluation = evaluateScheme(scheme, applicant, dataset.global);
    const remediations = remediateAll(evaluation.verdicts);

    const computation = evaluation.status === 'ELIGIBLE' ? computeLoan(scheme, applicant) : null;
    const loan = computation && computation.computable ? computation.loan : null;

    const partnerResult =
      loan != null
        ? matchPartners({ scheme, applicant, partners, health, healthConfig, loan })
        : null;

    const checklist =
      evaluation.status === 'ELIGIBLE'
        ? resolveChecklist({
            scheme,
            partnerType: null,
            applicant,
            definitions: documentDefinitions,
            requirements: documentRequirements,
          })
        : null;

    return {
      scheme_code: scheme.code,
      scheme_type: scheme.type,
      scheme_name_i18n: scheme.name_i18n,
      description_key: scheme.description_key,
      status: evaluation.status,
      verdicts: evaluation.verdicts,
      remediations,
      computation,
      partners: partnerResult,
      checklist,
      scheme_verified: scheme.verified,
    };
  });

  return {
    applicant,
    dataset: {
      label: dataset.label,
      figures_authoritative: dataset.figures_authoritative,
      overlay_applied: dataset.overlay_applied,
      notes: dataset.notes,
    },
    schemes,
    recommended_scheme_code: pickRecommended(schemes),
    generated_at: generatedAt,
  };
}

/**
 * Applies RECOMMENDATION_POLICY. Exported for tests: the seed's three schemes
 * are mutually exclusive (see data/personas.fixtures.json → known_gaps), so no
 * persona can put two eligible schemes in front of this function, and the
 * tie-break ordering would otherwise ship untested.
 */
export function pickRecommended(schemes: SchemeRecommendation[]): string | null {
  const candidates = schemes
    .filter((entry) => entry.status === 'ELIGIBLE')
    .map((entry) => {
      if (!entry.computation || !entry.computation.computable) return null;
      const figures = entry.computation;
      const share = figures.project_cost > 0 ? figures.loan / figures.project_cost : 0;
      return { code: entry.scheme_code, share, rate: figures.annual_rate_pct };
    })
    .filter((entry): entry is { code: string; share: number; rate: number } => entry !== null);

  if (candidates.length === 0) {
    // An eligible scheme whose figures are not computable is still the honest
    // answer to "which scheme applies", so fall back to it rather than to null.
    const eligible = schemes.find((entry) => entry.status === 'ELIGIBLE');
    return eligible ? eligible.scheme_code : null;
  }

  candidates.sort(
    (a, b) => b.share - a.share || a.rate - b.rate || a.code.localeCompare(b.code),
  );
  return candidates[0].code;
}
