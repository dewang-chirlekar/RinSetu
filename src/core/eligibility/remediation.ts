/**
 * src/core/eligibility/remediation.ts
 *
 * Differentiator A: for every rule an applicant fails, the minimum change that
 * would qualify them. ROADMAP §1 — almost nobody builds the negative case, and
 * the problem statement's own impact goal is financial literacy. A rejection
 * with a number attached is guidance; a rejection on its own is a dead end.
 *
 * The mapping follows the shape of the predicate:
 *
 *   numeric      → a signed delta ("income exceeds the cap by ₹X")
 *   boolean      → an action ("obtain this document")
 *   categorical  → the set of valid alternatives
 *   unevaluable  → either "tell us this" (applicant data) or "we are waiting on
 *                  the guideline" (scheme data). Never dressed up as a rejection.
 *
 * Codes and message keys only. No sentences.
 */

import type { PredicateCode, Remediation, Verdict } from '../types';

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Splits the unevaluable case by whose gap it is. An applicant can answer a
 * question about themselves; nobody can answer a question about a guideline we
 * have not transcribed, and pretending otherwise would put the burden on the
 * wrong person.
 */
function remediateUnevaluable(verdict: Verdict): Remediation {
  const missing = verdict.missing ?? [];
  const applicantGaps = missing.filter((path) => path.startsWith('applicant.'));

  if (applicantGaps.length > 0) {
    return {
      code: verdict.code,
      kind: 'PROVIDE_DATA',
      messageKey: 'remediation.provide_data',
      alternatives: applicantGaps,
    };
  }

  return {
    code: verdict.code,
    kind: 'AWAIT_GUIDELINE',
    messageKey: 'remediation.await_guideline',
    alternatives: missing,
  };
}

const BY_CODE: Record<PredicateCode, (verdict: Verdict) => Remediation> = {
  INCOME_WITHIN_CAP: (v) => {
    const actual = asNumber(v.actual);
    const required = asNumber(v.required);
    return {
      code: v.code,
      kind: 'REDUCE_NUMERIC',
      messageKey: 'remediation.INCOME_WITHIN_CAP.reduce',
      delta: actual != null && required != null ? actual - required : undefined,
      target: required,
    };
  },

  // Deliberately not remediable. These schemes are category-reserved by statute;
  // suggesting an "action" here would be both false and offensive. The message
  // key points the applicant at general-category credit routes instead.
  CATEGORY_SC: (v) => ({
    code: v.code,
    kind: 'NOT_REMEDIABLE',
    messageKey: 'remediation.CATEGORY_SC.not_remediable',
    target: typeof v.required === 'string' ? v.required : null,
  }),

  CASTE_CERT_AVAILABLE: (v) => ({
    code: v.code,
    kind: 'OBTAIN_DOCUMENT',
    messageKey: 'remediation.CASTE_CERT_AVAILABLE.obtain',
    target: 'CASTE_CERT',
  }),

  INCOME_PROOF_AVAILABLE: (v) => ({
    code: v.code,
    kind: 'OBTAIN_DOCUMENT',
    messageKey: 'remediation.INCOME_PROOF_AVAILABLE.obtain',
    target: 'INCOME_CERT',
  }),

  AGE_WITHIN_RANGE: (v) => {
    const age = asNumber(v.actual);
    // `required` is the band as "min-max"; parse rather than re-plumb it, since
    // the band is also what the UI renders.
    const band = typeof v.required === 'string' ? v.required.split('-').map(Number) : [];
    const min = Number.isFinite(band[0]) ? band[0] : null;
    const max = Number.isFinite(band[1]) ? band[1] : null;

    if (age != null && min != null && age < min) {
      return {
        code: v.code,
        kind: 'INCREASE_NUMERIC',
        messageKey: 'remediation.AGE_WITHIN_RANGE.too_young',
        delta: min - age,
        target: min,
      };
    }
    return {
      code: v.code,
      kind: 'NOT_REMEDIABLE',
      messageKey: 'remediation.AGE_WITHIN_RANGE.too_old',
      target: max,
    };
  },

  PROJECT_COST_WITHIN_UNIT_COST: (v) => {
    const actual = asNumber(v.actual);
    const required = asNumber(v.required);
    return {
      code: v.code,
      kind: 'REDUCE_NUMERIC',
      messageKey: 'remediation.PROJECT_COST_WITHIN_UNIT_COST.reduce',
      delta: actual != null && required != null ? actual - required : undefined,
      target: required,
    };
  },

  PROJECT_COST_ABOVE_MICRO_FLOOR: (v) => {
    const actual = asNumber(v.actual);
    const required = asNumber(v.required);
    return {
      code: v.code,
      kind: 'INCREASE_NUMERIC',
      messageKey: 'remediation.PROJECT_COST_ABOVE_MICRO_FLOOR.increase',
      delta: actual != null && required != null ? required - actual : undefined,
      target: required,
    };
  },

  PURPOSE_ELIGIBLE: (v) => ({
    code: v.code,
    kind: 'CHANGE_CATEGORICAL',
    messageKey: 'remediation.PURPOSE_ELIGIBLE.choose',
    alternatives: Array.isArray(v.required) ? v.required : [],
  }),

  ADMISSION_CONFIRMED: (v) => ({
    code: v.code,
    kind: 'OBTAIN_DOCUMENT',
    messageKey: 'remediation.ADMISSION_CONFIRMED.obtain',
    target: 'ADMISSION_LETTER',
  }),

  COURSE_ELIGIBLE: (v) => ({
    code: v.code,
    kind: 'CHANGE_CATEGORICAL',
    messageKey: 'remediation.COURSE_ELIGIBLE.choose',
    alternatives: Array.isArray(v.required) ? v.required : [],
  }),
};

/** One remediation for one failing or unevaluable verdict. Passing verdicts get none. */
export function remediate(verdict: Verdict): Remediation | null {
  if (verdict.passed) return null;
  if (!verdict.evaluable) return remediateUnevaluable(verdict);
  return BY_CODE[verdict.code](verdict);
}

export function remediateAll(verdicts: Verdict[]): Remediation[] {
  return verdicts
    .map(remediate)
    .filter((item): item is Remediation => item !== null);
}
