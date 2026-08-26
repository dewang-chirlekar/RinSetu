/**
 * src/core/eligibility/predicates.ts
 *
 * One function per rule. Each returns a Verdict carrying a code, the actual and
 * required values, and an i18n messageKey — never an English sentence
 * (CLAUDE.md hard rule 3). A hardcoded sentence anywhere under src/core/ is a
 * bug, because it makes multilingual support a rewrite of business logic.
 *
 * Three outcomes, not two:
 *
 *   passed: true,  evaluable: true   the rule is satisfied
 *   passed: false, evaluable: true   the rule is broken, and we can say by how much
 *   passed: false, evaluable: false  we could not decide, and `missing` says why
 *
 * The third state matters. If a scheme's age band has not been transcribed yet,
 * telling an applicant they are ineligible would be a lie of exactly the kind
 * this project exists to prevent. INDETERMINATE is an honest answer; a confident
 * wrong one is not.
 */

import type {
  ApplicantProfile,
  GlobalEligibility,
  PredicateCode,
  SchemeSpec,
  Verdict,
} from '../types';
import { resolveCostCeiling } from '../finance/rules';

export interface PredicateContext {
  applicant: ApplicantProfile;
  scheme: SchemeSpec;
  global: GlobalEligibility;
}

export type PredicateFn = (ctx: PredicateContext) => Verdict;

function key(code: PredicateCode, outcome: 'pass' | 'fail' | 'unknown'): string {
  return `predicate.${code}.${outcome}`;
}

function unknown(
  code: PredicateCode,
  missing: string[],
  actual: Verdict['actual'] = null,
  required: Verdict['required'] = null,
): Verdict {
  return {
    code,
    passed: false,
    evaluable: false,
    actual,
    required,
    messageKey: key(code, 'unknown'),
    missing,
  };
}

function decide(
  code: PredicateCode,
  passed: boolean,
  actual: Verdict['actual'],
  required: Verdict['required'],
): Verdict {
  return {
    code,
    passed,
    evaluable: true,
    actual,
    required,
    messageKey: key(code, passed ? 'pass' : 'fail'),
  };
}

/* ------------------------------------------------------------------------- */

export const incomeWithinCap: PredicateFn = ({ applicant, global }) => {
  const code: PredicateCode = 'INCOME_WITHIN_CAP';
  if (global.annual_family_income_cap == null) {
    return unknown(code, ['global.annual_family_income_cap'], applicant.annual_family_income);
  }
  if (applicant.annual_family_income == null) {
    return unknown(code, ['applicant.annual_family_income'], null, global.annual_family_income_cap);
  }
  return decide(
    code,
    applicant.annual_family_income <= global.annual_family_income_cap,
    applicant.annual_family_income,
    global.annual_family_income_cap,
  );
};

export const categoryIsSc: PredicateFn = ({ applicant, global }) => {
  const code: PredicateCode = 'CATEGORY_SC';
  if (global.category_requirement == null) {
    return unknown(code, ['global.category_requirement'], applicant.category);
  }
  if (applicant.category === 'UNKNOWN') {
    return unknown(code, ['applicant.category'], applicant.category, global.category_requirement);
  }
  return decide(
    code,
    applicant.category === global.category_requirement,
    applicant.category,
    global.category_requirement,
  );
};

export const casteCertAvailable: PredicateFn = ({ applicant }) => {
  const code: PredicateCode = 'CASTE_CERT_AVAILABLE';
  const has = applicant.documents_available.includes('CASTE_CERT');
  return decide(code, has, has, true);
};

export const incomeProofAvailable: PredicateFn = ({ applicant }) => {
  const code: PredicateCode = 'INCOME_PROOF_AVAILABLE';
  const has = applicant.documents_available.includes('INCOME_CERT');
  return decide(code, has, has, true);
};

export const ageWithinRange: PredicateFn = ({ applicant, global }) => {
  const code: PredicateCode = 'AGE_WITHIN_RANGE';
  const gaps: string[] = [];
  if (global.age_min == null) gaps.push('global.age_min');
  if (global.age_max == null) gaps.push('global.age_max');
  if (gaps.length > 0) return unknown(code, gaps, applicant.age);
  if (applicant.age == null) {
    return unknown(code, ['applicant.age'], null, `${global.age_min}-${global.age_max}`);
  }
  const min = global.age_min as number;
  const max = global.age_max as number;
  return decide(code, applicant.age >= min && applicant.age <= max, applicant.age, `${min}-${max}`);
};

export const projectCostWithinUnitCost: PredicateFn = ({ applicant, scheme }) => {
  const code: PredicateCode = 'PROJECT_COST_WITHIN_UNIT_COST';
  const ceiling = resolveCostCeiling(scheme, applicant.purpose);
  if (ceiling.max_unit_cost == null) {
    return unknown(code, ['scheme.max_unit_cost'], applicant.project_cost);
  }
  if (applicant.project_cost == null) {
    return unknown(code, ['applicant.project_cost'], null, ceiling.max_unit_cost);
  }
  return decide(
    code,
    applicant.project_cost <= ceiling.max_unit_cost,
    applicant.project_cost,
    ceiling.max_unit_cost,
  );
};

/**
 * The MICRO/TERM boundary. ROADMAP flags the floor that separates the two as an
 * open question, so this predicate is unevaluable until it is transcribed rather
 * than defaulting to zero — a zero floor would silently make every small project
 * eligible for the term loan.
 */
export const projectCostAboveMicroFloor: PredicateFn = ({ applicant, scheme }) => {
  const code: PredicateCode = 'PROJECT_COST_ABOVE_MICRO_FLOOR';
  if (scheme.min_project_cost == null) {
    return unknown(code, ['scheme.min_project_cost'], applicant.project_cost);
  }
  if (applicant.project_cost == null) {
    return unknown(code, ['applicant.project_cost'], null, scheme.min_project_cost);
  }
  return decide(
    code,
    applicant.project_cost >= scheme.min_project_cost,
    applicant.project_cost,
    scheme.min_project_cost,
  );
};

export const purposeEligible: PredicateFn = ({ applicant, scheme }) => {
  const code: PredicateCode = 'PURPOSE_ELIGIBLE';
  if (scheme.eligible_purposes.length === 0) {
    return unknown(code, ['scheme.eligible_purposes'], applicant.purpose);
  }
  if (applicant.purpose == null) {
    return unknown(code, ['applicant.purpose'], null, scheme.eligible_purposes);
  }
  return decide(
    code,
    scheme.eligible_purposes.includes(applicant.purpose),
    applicant.purpose,
    scheme.eligible_purposes,
  );
};

export const admissionConfirmed: PredicateFn = ({ applicant }) => {
  const code: PredicateCode = 'ADMISSION_CONFIRMED';
  const confirmed = applicant.education?.admission_confirmed;
  if (confirmed == null) {
    return unknown(code, ['applicant.education.admission_confirmed'], null, true);
  }
  return decide(code, confirmed === true, confirmed, true);
};

export const courseEligible: PredicateFn = ({ applicant, scheme }) => {
  const code: PredicateCode = 'COURSE_ELIGIBLE';
  if (scheme.eligible_purposes.length === 0) {
    return unknown(code, ['scheme.eligible_purposes'], applicant.purpose);
  }
  if (applicant.purpose == null) {
    return unknown(code, ['applicant.purpose'], null, scheme.eligible_purposes);
  }
  return decide(
    code,
    scheme.eligible_purposes.includes(applicant.purpose),
    applicant.purpose,
    scheme.eligible_purposes,
  );
};

/* ------------------------------------------------------------------------- */

/**
 * The registry the engine walks. A scheme's `predicates` array names the rules
 * that apply to it, so adding a rule to a scheme is a data change, and adding a
 * new rule type is one function plus one entry here plus two message keys.
 */
export const PREDICATE_REGISTRY: Record<PredicateCode, PredicateFn> = {
  INCOME_WITHIN_CAP: incomeWithinCap,
  CATEGORY_SC: categoryIsSc,
  CASTE_CERT_AVAILABLE: casteCertAvailable,
  INCOME_PROOF_AVAILABLE: incomeProofAvailable,
  AGE_WITHIN_RANGE: ageWithinRange,
  PROJECT_COST_WITHIN_UNIT_COST: projectCostWithinUnitCost,
  PROJECT_COST_ABOVE_MICRO_FLOOR: projectCostAboveMicroFloor,
  PURPOSE_ELIGIBLE: purposeEligible,
  ADMISSION_CONFIRMED: admissionConfirmed,
  COURSE_ELIGIBLE: courseEligible,
};
