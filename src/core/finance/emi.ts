/**
 * src/core/finance/emi.ts
 *
 * EMI and full amortisation, with all three moratorium interest treatments.
 *
 *   EMI = P · r · (1+r)^n / ((1+r)^n − 1),  and for r = 0:  EMI = P / n
 *
 * The moratorium is the known trap (CLAUDE.md). The three conventions give
 * materially different answers and which one applies is a property of the
 * scheme, read from `moratorium_interest_treatment`, never inferred here:
 *
 *   CAPITALISED  interest accrues and is added to principal.
 *                Amortise P' = P·(1+r)^m over n. Nothing is paid during the
 *                moratorium, and the EMI is strictly the highest of the three.
 *
 *   SERVICED     the borrower pays interest monthly during the moratorium and
 *                no principal. Amortise the original P over n. Moratorium
 *                payments are P·r each.
 *
 *   WAIVED       no interest is charged or capitalised during the moratorium.
 *                Amortise P over n.
 *
 * Two invariants worth stating because implementations usually break them, and
 * which tests/finance.golden.test.ts asserts:
 *
 *   - SERVICED and WAIVED produce the SAME EMI. They differ only in total
 *     outflow, and the difference is exactly P·r·m. If your EMIs differ, the
 *     bug is in which principal you amortised.
 *   - CAPITALISED EMI > the other two whenever r > 0 and m > 0.
 *
 * Pure and synchronous. No I/O, no clock, no scheme lookups.
 */

import type {
  AmortisationResult,
  AmortisationTotals,
  MoratoriumTreatment,
  ScheduleRow,
} from '../types';
import { roundRupee } from './rounding';

export interface AmortiseInput {
  /** Sanctioned loan, in rupees. */
  principal: number;
  /** Monthly fractional rate. 8% p.a. is 0.08/12. Zero is valid. */
  monthlyRate: number;
  /** Repayment instalments. Must be at least 1. Excludes the moratorium. */
  repaymentMonths: number;
  /** Moratorium length in months. Zero is valid. */
  moratoriumMonths: number;
  treatment: MoratoriumTreatment;
  /** Carried through onto the result for display; not used in the arithmetic. */
  annualRatePct: number;
}

/**
 * The bare EMI formula. Exported because it is the one piece of arithmetic a
 * reviewer will want to read on its own, and because the golden tests assert it
 * directly without building a schedule.
 */
export function emiExact(principal: number, monthlyRate: number, months: number): number {
  if (months <= 0) throw new Error(`emiExact requires months >= 1, received ${months}`);
  if (principal < 0) throw new Error(`emiExact requires a non-negative principal, received ${principal}`);
  if (monthlyRate < 0) throw new Error(`emiExact requires a non-negative rate, received ${monthlyRate}`);
  if (principal === 0) return 0;
  if (monthlyRate === 0) return principal / months;

  const growth = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * growth) / (growth - 1);
}

/**
 * The principal that actually gets amortised. This single function is where the
 * three treatments diverge, which is why it is separate and exported: if a
 * treatment is ever wrong, it is wrong here and nowhere else.
 */
export function amortisationBase(
  principal: number,
  monthlyRate: number,
  moratoriumMonths: number,
  treatment: MoratoriumTreatment,
): number {
  switch (treatment) {
    case 'CAPITALISED':
      return principal * Math.pow(1 + monthlyRate, moratoriumMonths);
    case 'SERVICED':
    case 'WAIVED':
      return principal;
    default: {
      // Exhaustiveness: adding a fourth treatment must fail to compile.
      const unreachable: never = treatment;
      throw new Error(`Unhandled moratorium treatment: ${String(unreachable)}`);
    }
  }
}

/** Interest attributable to the moratorium period, unrounded, by treatment. */
export function moratoriumInterestExact(
  principal: number,
  monthlyRate: number,
  moratoriumMonths: number,
  treatment: MoratoriumTreatment,
): number {
  switch (treatment) {
    case 'CAPITALISED':
      return principal * (Math.pow(1 + monthlyRate, moratoriumMonths) - 1);
    case 'SERVICED':
      return principal * monthlyRate * moratoriumMonths;
    case 'WAIVED':
      return 0;
    default: {
      const unreachable: never = treatment;
      throw new Error(`Unhandled moratorium treatment: ${String(unreachable)}`);
    }
  }
}

export function amortise(input: AmortiseInput): AmortisationResult {
  const { principal, monthlyRate, repaymentMonths, moratoriumMonths, treatment, annualRatePct } = input;

  if (repaymentMonths < 1 || !Number.isInteger(repaymentMonths)) {
    throw new Error(`amortise requires an integer repaymentMonths >= 1, received ${repaymentMonths}`);
  }
  if (moratoriumMonths < 0 || !Number.isInteger(moratoriumMonths)) {
    throw new Error(`amortise requires an integer moratoriumMonths >= 0, received ${moratoriumMonths}`);
  }

  const base = amortisationBase(principal, monthlyRate, moratoriumMonths, treatment);
  const exactEmi = emiExact(base, monthlyRate, repaymentMonths);
  const emi = roundRupee(exactEmi);

  const rows: ScheduleRow[] = [];

  /* ---- moratorium phase ------------------------------------------------- */

  const servicedPayment = treatment === 'SERVICED' ? roundRupee(principal * monthlyRate) : 0;
  let capitalisedTotal = 0;
  let servicedTotal = 0;

  let balance = principal;
  for (let month = 1; month <= moratoriumMonths; month += 1) {
    const opening = balance;
    if (treatment === 'CAPITALISED') {
      const interest = roundRupee(opening * monthlyRate);
      capitalisedTotal += interest;
      balance = opening + interest;
      rows.push({
        month,
        phase: 'MORATORIUM',
        opening_balance: roundRupee(opening),
        payment: 0,
        interest,
        principal: 0,
        closing_balance: roundRupee(balance),
      });
    } else if (treatment === 'SERVICED') {
      servicedTotal += servicedPayment;
      rows.push({
        month,
        phase: 'MORATORIUM',
        opening_balance: roundRupee(opening),
        payment: servicedPayment,
        interest: servicedPayment,
        principal: 0,
        closing_balance: roundRupee(opening),
      });
    } else {
      rows.push({
        month,
        phase: 'MORATORIUM',
        opening_balance: roundRupee(opening),
        payment: 0,
        interest: 0,
        principal: 0,
        closing_balance: roundRupee(opening),
      });
    }
  }

  /* ---- repayment phase -------------------------------------------------- */

  // Start from the unrounded base so a capitalised balance does not inherit the
  // rounding drift of the moratorium rows.
  let outstanding = base;
  let interestDuringRepayment = 0;
  let principalRepaid = 0;

  for (let i = 1; i <= repaymentMonths; i += 1) {
    const month = moratoriumMonths + i;
    const opening = outstanding;
    const interest = roundRupee(opening * monthlyRate);

    let principalPortion: number;
    let payment: number;

    if (i === repaymentMonths) {
      // Final instalment absorbs the residual so the schedule closes at zero.
      principalPortion = roundRupee(opening);
      payment = principalPortion + interest;
    } else {
      payment = emi;
      principalPortion = payment - interest;
      if (principalPortion > opening) {
        // Loan clears early — cannot repay more principal than is outstanding.
        principalPortion = roundRupee(opening);
        payment = principalPortion + interest;
      }
    }

    const closing = roundRupee(opening) - principalPortion;
    interestDuringRepayment += interest;
    principalRepaid += principalPortion;

    rows.push({
      month,
      phase: 'REPAYMENT',
      opening_balance: roundRupee(opening),
      payment,
      interest,
      principal: principalPortion,
      closing_balance: closing,
    });

    outstanding = opening - principalPortion;
    if (outstanding < 0) outstanding = 0;
  }

  const totalOutflow = rows.reduce((sum, row) => sum + row.payment, 0);

  const totals: AmortisationTotals = {
    moratorium_interest_serviced: servicedTotal,
    moratorium_interest_capitalised: capitalisedTotal,
    principal_repaid: principalRepaid,
    interest_during_repayment: interestDuringRepayment,
    total_interest: totalOutflow - roundRupee(principal),
    total_outflow: totalOutflow,
  };

  const exactMoratoriumInterest = moratoriumInterestExact(
    principal,
    monthlyRate,
    moratoriumMonths,
    treatment,
  );
  const exactOutflow = exactEmi * repaymentMonths + (treatment === 'SERVICED' ? exactMoratoriumInterest : 0);

  return {
    principal,
    amortised_principal: base,
    monthly_rate: monthlyRate,
    annual_rate_pct: annualRatePct,
    moratorium_months: moratoriumMonths,
    repayment_months: repaymentMonths,
    treatment,
    emi,
    emi_exact: exactEmi,
    moratorium_monthly_payment: servicedPayment,
    rows,
    totals,
    exact: {
      emi: exactEmi,
      moratorium_interest: exactMoratoriumInterest,
      total_outflow: exactOutflow,
      total_interest: exactOutflow - principal,
    },
  };
}
