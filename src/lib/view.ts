/**
 * src/lib/view.ts
 *
 * The seam between the core's codes and English on screen.
 *
 * The core returns `{ code, messageKey, actual, required }` and never a sentence
 * (CLAUDE.md hard rule 3). Something has to decide that INCOME_WITHIN_CAP's
 * `actual` is money and AGE_WITHIN_RANGE's is a year count. That decision is
 * presentation, so it lives here rather than in src/core/.
 *
 * Note what this file is NOT allowed to do: it never supplies a value the core
 * did not compute, and it never converts a null into a number. A missing figure
 * renders as 'Not known', which is the whole point of the project.
 */

import type { PredicateCode, Remediation, Verdict } from '@/core/types';
import { translate } from '@/messages';
import { humanisePurpose, joinList, months, rupees } from './format';

/**
 * Predicates whose `actual`/`required` are rupee amounts. Everything not listed
 * renders as a plain value. Keep this in sync with PREDICATE_CODES by eye — a
 * miss here shows an unformatted integer, which is ugly but not a lie.
 */
const MONEY_PREDICATES: ReadonlySet<PredicateCode> = new Set([
  'INCOME_WITHIN_CAP',
  'PROJECT_COST_WITHIN_UNIT_COST',
  'PROJECT_COST_ABOVE_MICRO_FLOOR',
]);

function formatVerdictValue(
  code: PredicateCode,
  value: number | string | boolean | string[] | null,
): string {
  if (value === null) return translate('common.unknown');
  if (typeof value === 'boolean') return translate(value ? 'common.yes' : 'common.no');
  if (Array.isArray(value)) return joinList(value.map(humanisePurpose));
  if (typeof value === 'number') {
    return MONEY_PREDICATES.has(code) ? rupees(value) : String(value);
  }
  // AGE_WITHIN_RANGE ships its band as the string 'min-max'. Render an en dash
  // for typography, but only here — remediation.ts parses the raw hyphenated
  // form, so the underlying value must never be rewritten. See docs/FRAGILE.md A3.
  if (code === 'AGE_WITHIN_RANGE' && /^\d+-\d+$/.test(value)) {
    return value.replace('-', '–');
  }
  return value;
}

/** The one-line explanation of a single eligibility check. */
export function verdictSentence(verdict: Verdict): string {
  return translate(verdict.messageKey, {
    actual: formatVerdictValue(verdict.code, verdict.actual),
    required: formatVerdictValue(verdict.code, verdict.required),
  });
}

export function predicateLabel(code: PredicateCode): string {
  return translate(`predicate.${code}.label`);
}

/** 'PASS' | 'FAIL' | 'UNKNOWN' — the three states a check can be in on screen. */
export type VerdictTone = 'PASS' | 'FAIL' | 'UNKNOWN';

export function verdictTone(verdict: Verdict): VerdictTone {
  if (!verdict.evaluable) return 'UNKNOWN';
  return verdict.passed ? 'PASS' : 'FAIL';
}

/**
 * Names a dotted data path for a human: 'applicant.age' → 'your age'.
 *
 * tests/messages.coverage.test.ts asserts a `field.<path>` key exists for every
 * path the core can report as missing, so this cannot throw for real engine
 * output. The fallback exists only so a hand-built path in a future screen
 * degrades to something readable instead of taking the page down mid-demo.
 */
export function fieldLabel(path: string): string {
  const key = `field.${path}`;
  try {
    return translate(key);
  } catch {
    return path;
  }
}

/**
 * The remediation sentence — 'what would change this'.
 *
 * Two payload shapes share the `alternatives` array, and they mean different
 * things, which is the one trap in this function:
 *
 *   PROVIDE_DATA / AWAIT_GUIDELINE → dotted data paths, rendered as field names
 *                                    into {fields}
 *   CHANGE_CATEGORICAL             → purpose or course codes, rendered into
 *                                    {alternatives}
 *
 * See src/core/eligibility/remediation.ts — remediateUnevaluable() puts paths in
 * `alternatives` because the field is generic. Do not "simplify" these two
 * branches together.
 */
export function remediationSentence(remediation: Remediation): string {
  const list = remediation.alternatives ?? [];

  if (remediation.kind === 'PROVIDE_DATA' || remediation.kind === 'AWAIT_GUIDELINE') {
    return translate(remediation.messageKey, {
      fields: joinList(list.map(fieldLabel)),
    });
  }

  return translate(remediation.messageKey, {
    alternatives: joinList(list.map(humanisePurpose)),
    delta: formatRemediationNumber(remediation, remediation.delta),
    target: formatRemediationNumber(remediation, remediation.target),
  });
}

/**
 * A remediation's delta and target are rupees for the money predicates and years
 * for the age predicate. Both are magnitudes — the sign is carried by the choice
 * of message key ('reduce' vs 'increase'), so this takes the absolute value.
 *
 * Never returns undefined. interpolate() in src/messages/index.ts leaves the
 * literal '{delta}' on screen for an undefined value, so an absent number must
 * degrade to 'Not known' here rather than reaching the template.
 */
function formatRemediationNumber(
  remediation: Remediation,
  value: number | string | boolean | null | undefined,
): string | number {
  if (value === undefined || value === null) return translate('common.unknown');
  if (typeof value !== 'number') return String(value);

  const magnitude = Math.abs(value);
  if (MONEY_PREDICATES.has(remediation.code)) return rupees(magnitude);
  return magnitude;
}

/** 'AWAIT_GUIDELINE' means the gap is ours, not the applicant's. The UI says so. */
export function isOurGap(remediation: Remediation): boolean {
  return remediation.kind === 'AWAIT_GUIDELINE';
}

export function monthsLabel(count: number): string {
  return months(count);
}
