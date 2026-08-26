/**
 * src/core/finance/loan.ts
 *
 * Eligible project cost → subsidy → margin money → gross loan → sanctioned loan
 * → rate → EMI and schedule.
 *
 * The order below is fixed by ROADMAP §8.1 and must not be rearranged; each step
 * consumes the previous one's output:
 *
 *   1. eligible_cost    = min(project_cost, max_unit_cost)
 *   2. subsidy          = min(subsidy_pct × eligible_cost, subsidy_cap)
 *   3. own_contribution = margin_pct × eligible_cost
 *   4. gross_loan       = eligible_cost − own_contribution − (subsidy if FRONT)
 *   5. loan             = min(gross_loan, max_loan, loan_pct_cap × eligible_cost)
 *   6. rate             = resolve InterestRule for {loan band, purpose, gender}
 *   7. emi + schedule   = amortise(loan, rate, tenure, moratorium, treatment)
 *
 * No magic numbers. Every parameter arrives on `scheme`. A null parameter is
 * UNKNOWN, and the function returns `{ computable: false, missing: [...] }`
 * rather than substituting a default — CLAUDE.md hard rule 1. That list of
 * missing paths is what drives VERIFY.md and the "why is there no number here"
 * panel in the UI.
 */

import type {
  ApplicantProfile,
  BindingConstraint,
  LoanComputation,
  MoratoriumTreatment,
  SchemeSpec,
} from '../types';
import { amortise } from './emi';
import { monthlyRateFromAnnualPct, roundRupee } from './rounding';
import { resolveCostCeiling, resolveInterestRate } from './rules';
import { resolveTerms } from './terms';

export function computeLoan(scheme: SchemeSpec, applicant: ApplicantProfile): LoanComputation {
  const missing: string[] = [];

  /* ---- gather every parameter first, so one pass reports every gap ------- */

  if (applicant.project_cost == null) missing.push('applicant.project_cost');

  const ceiling = resolveCostCeiling(scheme, applicant.purpose);
  if (ceiling.max_unit_cost == null) missing.push('scheme.max_unit_cost');
  if (ceiling.max_loan == null) missing.push('scheme.max_loan');
  if (scheme.loan_pct_cap == null) missing.push('scheme.loan_pct_cap');
  if (scheme.margin_pct == null) missing.push('scheme.margin_pct');
  if (scheme.subsidy_pct == null) missing.push('scheme.subsidy_pct');
  if (scheme.moratorium_interest_treatment == null) missing.push('scheme.moratorium_interest_treatment');

  // subsidy_cap and subsidy_timing only matter if a subsidy actually exists.
  // Demanding them when subsidy_pct is 0 would block a scheme on a figure that
  // cannot affect the answer.
  if (scheme.subsidy_pct != null && scheme.subsidy_pct > 0) {
    if (scheme.subsidy_cap == null) missing.push('scheme.subsidy_cap');
    if (scheme.subsidy_timing == null) missing.push('scheme.subsidy_timing');
  }

  const terms = resolveTerms(scheme, applicant);
  if (!terms.computable) missing.push(...terms.missing);

  if (missing.length > 0) {
    return { computable: false, missing: dedupe(missing) };
  }

  // Every access below is guarded by the checks above.
  const projectCost = applicant.project_cost as number;
  const maxUnitCost = ceiling.max_unit_cost as number;
  const maxLoan = ceiling.max_loan as number;
  const loanPctCap = scheme.loan_pct_cap as number;
  const marginPct = scheme.margin_pct as number;
  const subsidyPct = scheme.subsidy_pct as number;
  const subsidyCap = scheme.subsidy_cap ?? 0;
  const subsidyTiming = scheme.subsidy_timing ?? 'BACK';
  const treatment = scheme.moratorium_interest_treatment as MoratoriumTreatment;
  const resolvedTerms = terms as Extract<typeof terms, { computable: true }>;

  /* ---- steps 1 to 5 ----------------------------------------------------- */

  // Rounding note: each of these is a money figure a user will see and add up on
  // screen, so each is rounded to the whole rupee and the next step consumes the
  // ROUNDED value. That is a deliberate exception to "compute unrounded, round at
  // the end" (see rounding.ts) — a subsidy column that does not visibly subtract
  // reads as a bug even when the arithmetic is right. Only `loan` flows into the
  // amortisation, and a sanctioned loan is a whole rupee anyway.

  const eligibleCost = roundRupee(Math.min(projectCost, maxUnitCost));

  const subsidy = subsidyPct > 0 ? roundRupee(Math.min(subsidyPct * eligibleCost, subsidyCap)) : 0;

  const ownContribution = roundRupee(marginPct * eligibleCost);

  const frontEndedSubsidy = subsidyTiming === 'FRONT' ? subsidy : 0;
  const grossLoan = Math.max(0, eligibleCost - ownContribution - frontEndedSubsidy);

  const pctCapAmount = roundRupee(loanPctCap * eligibleCost);
  const candidates: Array<{ constraint: BindingConstraint; amount: number }> = [
    { constraint: 'GROSS', amount: grossLoan },
    { constraint: 'MAX_LOAN', amount: maxLoan },
    { constraint: 'LOAN_PCT_CAP', amount: pctCapAmount },
  ];
  // Ties resolve to the earlier candidate, so a loan limited by both its gross
  // and a cap reports GROSS — the more informative of the two.
  const binding = candidates.reduce((best, candidate) =>
    candidate.amount < best.amount ? candidate : best,
  );
  const loan = roundRupee(binding.amount);

  /* ---- step 6: the rate ------------------------------------------------- */

  const rate = resolveInterestRate(scheme, {
    loan,
    purpose: applicant.purpose,
    gender: applicant.gender,
  });

  if (rate.annual_rate_pct == null) {
    return {
      computable: false,
      missing: [
        rate.matched
          ? 'scheme.interest_rules[matched].annual_rate_pct'
          : 'scheme.interest_rules[no rule matched this loan band]',
      ],
    };
  }

  /* ---- step 7: EMI and schedule ----------------------------------------- */

  const schedule = amortise({
    principal: loan,
    monthlyRate: monthlyRateFromAnnualPct(rate.annual_rate_pct),
    repaymentMonths: resolvedTerms.repaymentMonths,
    moratoriumMonths: resolvedTerms.moratoriumMonths,
    treatment,
    annualRatePct: rate.annual_rate_pct,
  });

  return {
    computable: true,
    project_cost: roundRupee(projectCost),
    eligible_cost: eligibleCost,
    max_unit_cost_applied: maxUnitCost,
    cost_ceiling_source: ceiling.source,
    subsidy,
    subsidy_timing: subsidyTiming,
    margin_pct: marginPct,
    own_contribution: ownContribution,
    gross_loan: grossLoan,
    loan,
    binding_constraint: binding.constraint,
    loan_below_min: scheme.min_loan != null && loan < scheme.min_loan,
    min_loan: scheme.min_loan,
    annual_rate_pct: rate.annual_rate_pct,
    rate_provenance: rate.provenance,
    moratorium_months: resolvedTerms.moratoriumMonths,
    repayment_months: resolvedTerms.repaymentMonths,
    tenure_months_total: resolvedTerms.tenureMonthsTotal,
    schedule,
  };
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}
