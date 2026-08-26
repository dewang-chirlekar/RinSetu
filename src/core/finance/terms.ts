/**
 * src/core/finance/terms.ts
 *
 * Derives the moratorium length and the number of repayment instalments from
 * the scheme's term parameters and whatever the applicant asked for.
 *
 * This exists as its own file because of one unresolved question in ROADMAP
 * §8.1: **is the maximum tenure inclusive or exclusive of the moratorium?**
 * The two readings differ by up to a year of instalments on the same loan, so
 * `tenure_includes_moratorium` is a scheme field and a null value makes the
 * whole computation NOT COMPUTABLE. We would rather show a judge "we are
 * waiting on this one field" than show them a confidently wrong schedule.
 */

import type { ApplicantProfile, SchemeSpec } from '../types';
import { clamp } from './rounding';

export interface TermsResolved {
  computable: true;
  moratoriumMonths: number;
  repaymentMonths: number;
  /** Moratorium + repayment, i.e. how long the borrower is on the hook. */
  tenureMonthsTotal: number;
}

export interface TermsNotComputable {
  computable: false;
  missing: string[];
}

export type TermsResolution = TermsResolved | TermsNotComputable;

export function resolveTerms(scheme: SchemeSpec, applicant: ApplicantProfile): TermsResolution {
  const missing: string[] = [];

  if (scheme.moratorium_months_min == null) missing.push('scheme.moratorium_months_min');
  if (scheme.moratorium_months_max == null) missing.push('scheme.moratorium_months_max');
  if (scheme.tenure_months_max == null) missing.push('scheme.tenure_months_max');
  if (scheme.tenure_includes_moratorium == null) missing.push('scheme.tenure_includes_moratorium');

  if (missing.length > 0) return { computable: false, missing };

  const moratoriumMin = scheme.moratorium_months_min as number;
  const moratoriumMax = scheme.moratorium_months_max as number;
  const tenureMax = scheme.tenure_months_max as number;
  const includesMoratorium = scheme.tenure_includes_moratorium as boolean;

  // Preference order: what the applicant asked for, then the scheme's UI
  // pre-fill, then the scheme's own minimum. The pre-fill is a convenience, not
  // a rule — see the note on moratorium_months_default in types.ts.
  const requestedMoratorium =
    applicant.requested_moratorium_months ?? scheme.moratorium_months_default ?? moratoriumMin;
  const moratoriumMonths = Math.round(clamp(requestedMoratorium, moratoriumMin, moratoriumMax));

  const requestedTenure = applicant.requested_tenure_months ?? tenureMax;
  const tenureCap = Math.round(clamp(requestedTenure, 1, tenureMax));

  const repaymentMonths = includesMoratorium ? tenureCap - moratoriumMonths : tenureCap;

  if (repaymentMonths < 1) {
    // Not a missing figure but a contradictory one: the tenure is inclusive of
    // the moratorium and leaves no instalments. Surfaced as a diagnostic path so
    // it lands in the same "why is there no number" panel as the data gaps.
    return {
      computable: false,
      missing: ['derived.repayment_months_below_one'],
    };
  }

  return {
    computable: true,
    moratoriumMonths,
    repaymentMonths,
    tenureMonthsTotal: moratoriumMonths + repaymentMonths,
  };
}
