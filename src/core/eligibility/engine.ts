/**
 * src/core/eligibility/engine.ts
 *
 * Runs every scheme's predicates and returns a verdict for EVERY scheme,
 * passing and failing. CLAUDE.md hard rule 4: the negative case is a headline
 * feature, not an error path, so nothing is filtered out here.
 *
 * Status is three-valued:
 *
 *   ELIGIBLE       every predicate the scheme names passed
 *   NOT_ELIGIBLE   at least one predicate was evaluated and broken
 *   INDETERMINATE  nothing was broken, but at least one predicate could not be
 *                  evaluated for want of data
 *
 * A broken rule outranks an unevaluable one: if we know the applicant's income
 * is over the cap, that is a real answer and it does not become uncertain just
 * because the age band has not been transcribed yet.
 */

import type {
  ApplicantProfile,
  GlobalEligibility,
  SchemeSpec,
  SchemeStatus,
  Verdict,
} from '../types';
import { PREDICATE_REGISTRY } from './predicates';

export interface SchemeEvaluation {
  scheme_code: string;
  status: SchemeStatus;
  verdicts: Verdict[];
  /** Every data path that blocked a decision on this scheme, deduped. */
  blocking_gaps: string[];
}

export function evaluateScheme(
  scheme: SchemeSpec,
  applicant: ApplicantProfile,
  global: GlobalEligibility,
): SchemeEvaluation {
  const ctx = { applicant, scheme, global };

  const verdicts = scheme.predicates.map((code) => {
    const predicate = PREDICATE_REGISTRY[code];
    if (!predicate) {
      // A scheme naming a predicate we do not implement is a data/code mismatch.
      // Fail loudly at seed-load time rather than quietly skipping a rule.
      throw new Error(
        `Scheme ${scheme.code} names predicate '${code}', which is not in PREDICATE_REGISTRY.`,
      );
    }
    return predicate(ctx);
  });

  const anyBroken = verdicts.some((v) => v.evaluable && !v.passed);
  const anyUnevaluable = verdicts.some((v) => !v.evaluable);

  let status: SchemeStatus;
  if (anyBroken) status = 'NOT_ELIGIBLE';
  else if (anyUnevaluable) status = 'INDETERMINATE';
  else status = 'ELIGIBLE';

  const blocking_gaps = Array.from(
    new Set(verdicts.flatMap((v) => (v.evaluable ? [] : (v.missing ?? [])))),
  );

  return { scheme_code: scheme.code, status, verdicts, blocking_gaps };
}

export function evaluateAllSchemes(
  schemes: SchemeSpec[],
  applicant: ApplicantProfile,
  global: GlobalEligibility,
): SchemeEvaluation[] {
  return schemes.map((scheme) => evaluateScheme(scheme, applicant, global));
}
