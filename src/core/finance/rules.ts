/**
 * src/core/finance/rules.ts
 *
 * Resolution of condition-keyed scheme rules: the banded interest rate card and
 * the purpose-specific cost ceilings.
 *
 * Rates are a table, not a column, because these schemes band by loan size and
 * possibly by applicant category — ROADMAP §5 explains why a scalar rate column
 * would force us to hardcode a lie. The same applies to education ceilings,
 * which commonly differ for study in India and abroad.
 *
 * Matching rule: a rule applies when every condition it states is satisfied.
 * A condition whose value is null is not a condition. Among applicable rules the
 * most specific wins, specificity being the count of stated conditions; ties go
 * to the earlier rule, so file order is a deliberate tie-break the transcriber
 * controls.
 */

import type {
  FieldProvenance,
  Gender,
  InterestRule,
  SchemeSpec,
} from '../types';

export interface RateContext {
  loan: number;
  purpose: string | null;
  gender: Gender | null;
}

export interface RateResolution {
  annual_rate_pct: number | null;
  provenance: FieldProvenance;
  /** False when no rule in the table matched at all — a data gap, not a zero rate. */
  matched: boolean;
}

const NO_RULE_PROVENANCE: FieldProvenance = {
  source: 'placeholder',
  verified: false,
  note: 'No interest rule in the scheme matched this context.',
};

function conditionCount(applies_when: InterestRule['applies_when']): number {
  let count = 0;
  if (applies_when.loan_band_min != null) count += 1;
  if (applies_when.loan_band_max != null) count += 1;
  if (applies_when.purpose != null) count += 1;
  if (applies_when.gender != null) count += 1;
  return count;
}

function ruleApplies(rule: InterestRule, ctx: RateContext): boolean {
  const w = rule.applies_when;
  if (w.loan_band_min != null && ctx.loan < w.loan_band_min) return false;
  if (w.loan_band_max != null && ctx.loan > w.loan_band_max) return false;
  if (w.purpose != null && w.purpose !== ctx.purpose) return false;
  if (w.gender != null && w.gender !== ctx.gender) return false;
  return true;
}

export function resolveInterestRate(scheme: SchemeSpec, ctx: RateContext): RateResolution {
  const applicable = scheme.interest_rules
    .map((rule, index) => ({ rule, index, specificity: conditionCount(rule.applies_when) }))
    .filter((candidate) => ruleApplies(candidate.rule, ctx))
    .sort((a, b) => (b.specificity - a.specificity) || (a.index - b.index));

  const winner = applicable[0];
  if (!winner) {
    return { annual_rate_pct: null, provenance: NO_RULE_PROVENANCE, matched: false };
  }
  return {
    annual_rate_pct: winner.rule.annual_rate_pct,
    provenance: winner.rule.provenance,
    matched: true,
  };
}

export interface CeilingResolution {
  max_unit_cost: number | null;
  max_loan: number | null;
  /** Whether the figure came from a purpose-specific rule or the scheme's own scalar. */
  source: 'SCHEME' | 'PURPOSE_RULE';
  provenance: FieldProvenance;
}

/**
 * A purpose-specific ceiling rule overrides the scheme's scalar ceiling, but
 * only for the fields it actually states. A rule that sets max_unit_cost and
 * leaves max_loan null falls back to the scheme for max_loan.
 */
export function resolveCostCeiling(scheme: SchemeSpec, purpose: string | null): CeilingResolution {
  const rule = scheme.cost_ceiling_rules.find(
    (candidate) => candidate.applies_when.purpose != null && candidate.applies_when.purpose === purpose,
  );

  if (!rule) {
    return {
      max_unit_cost: scheme.max_unit_cost,
      max_loan: scheme.max_loan,
      source: 'SCHEME',
      provenance: scheme.provenance.max_unit_cost ?? NO_RULE_PROVENANCE,
    };
  }

  return {
    max_unit_cost: rule.max_unit_cost ?? scheme.max_unit_cost,
    max_loan: rule.max_loan ?? scheme.max_loan,
    source: rule.max_unit_cost != null || rule.max_loan != null ? 'PURPOSE_RULE' : 'SCHEME',
    provenance: rule.provenance,
  };
}
