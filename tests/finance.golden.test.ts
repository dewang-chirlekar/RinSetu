/**
 * tests/finance.golden.test.ts
 *
 * Hand-checkable arithmetic for the loan pipeline and all three moratorium
 * treatments.
 *
 * ── What is and is not a verified figure in this file ────────────────────────
 *
 * CLAUDE.md hard rule 1 forbids inventing a scheme parameter. Nothing in this
 * file is a scheme parameter. The inputs below (₹1,00,000 · 8% · 60 months ·
 * 6-month moratorium) are the TEST's own chosen inputs, exactly as ROADMAP
 * Appendix A states them, and the expected outputs are arithmetic consequences
 * of the published EMI formula which I recomputed independently before writing
 * them down:
 *
 *   r        = 8/12/100                      = 0.00666666…
 *   (1+r)^60                                 = 1.48984566…
 *   EMI_base = P·r·(1+r)^60 / ((1+r)^60 − 1) = 2027.6395…
 *   (1+r)^6                                  = 1.04067262…
 *
 * So these assertions test the formula, not a guideline. Any test that would
 * need a REAL scheme figure — an actual rate band, an actual ceiling — is left
 * as TODO(verify) at the bottom of this file with the formula spelled out, and
 * must not be filled in from memory or plausibility.
 *
 * Tolerances: `exact` values are asserted to 1e-6 relative, because they come
 * straight from the formula. Rounded values are asserted exactly, because the
 * rounding policy is deterministic.
 */

import { describe, expect, it } from 'vitest';
import {
  amortisationBase,
  amortise,
  emiExact,
  moratoriumInterestExact,
} from '../src/core/finance/emi';
import { monthlyRateFromAnnualPct, roundPaisa, roundRupee } from '../src/core/finance/rounding';
import type { MoratoriumTreatment } from '../src/core/types';

/* Appendix A's scenario. */
const P = 100_000;
const ANNUAL_PCT = 8;
const R = monthlyRateFromAnnualPct(ANNUAL_PCT); // 0.006666…
const N = 60;
const M = 6;

/** Recomputed independently, not copied from the implementation. */
const EMI_BASE_EXACT = 2027.6395;
const CAPITALISATION_FACTOR = 1.04067262;

function run(treatment: MoratoriumTreatment, overrides: Partial<Parameters<typeof amortise>[0]> = {}) {
  return amortise({
    principal: P,
    monthlyRate: R,
    repaymentMonths: N,
    moratoriumMonths: M,
    treatment,
    annualRatePct: ANNUAL_PCT,
    ...overrides,
  });
}

describe('the EMI formula itself', () => {
  it('matches the hand-computed base EMI to the paisa', () => {
    expect(roundPaisa(emiExact(P, R, N))).toBe(2027.64);
    expect(emiExact(P, R, N)).toBeCloseTo(EMI_BASE_EXACT, 3);
  });

  it('returns P/n at a zero rate, with no division by zero', () => {
    // ROADMAP Appendix A invariant 3, stated with its own numbers.
    expect(emiExact(60_000, 0, 60)).toBe(1000);
    expect(Number.isFinite(emiExact(60_000, 0, 60))).toBe(true);
  });

  it('returns zero for a zero principal rather than NaN', () => {
    expect(emiExact(0, R, N)).toBe(0);
  });

  it('rejects inputs that cannot produce a schedule', () => {
    expect(() => emiExact(P, R, 0)).toThrow();
    expect(() => emiExact(-1, R, N)).toThrow();
    expect(() => emiExact(P, -0.01, N)).toThrow();
  });
});

describe('the amortisation base — the one place the three treatments differ', () => {
  it('grows the principal by (1+r)^m under CAPITALISED', () => {
    expect(amortisationBase(P, R, M, 'CAPITALISED')).toBeCloseTo(P * CAPITALISATION_FACTOR, 2);
  });

  it('leaves the principal untouched under SERVICED and WAIVED', () => {
    expect(amortisationBase(P, R, M, 'SERVICED')).toBe(P);
    expect(amortisationBase(P, R, M, 'WAIVED')).toBe(P);
  });

  it('collapses to the plain principal when there is no moratorium', () => {
    for (const treatment of ['CAPITALISED', 'SERVICED', 'WAIVED'] as const) {
      expect(amortisationBase(P, R, 0, treatment)).toBe(P);
    }
  });
});

describe('moratorium interest', () => {
  it('is P·((1+r)^m − 1) under CAPITALISED', () => {
    expect(moratoriumInterestExact(P, R, M, 'CAPITALISED')).toBeCloseTo(
      P * (CAPITALISATION_FACTOR - 1),
      2,
    );
  });

  it('is exactly P·r·m under SERVICED', () => {
    // 100000 × 0.0066666… × 6 = 4000, exactly.
    expect(moratoriumInterestExact(P, R, M, 'SERVICED')).toBeCloseTo(4000, 6);
  });

  it('is zero under WAIVED', () => {
    expect(moratoriumInterestExact(P, R, M, 'WAIVED')).toBe(0);
  });
});

describe('ROADMAP Appendix A — the three treatments end to end', () => {
  it('CAPITALISED: EMI ₹2,110.11 and total outflow ₹1,26,606.53', () => {
    const result = run('CAPITALISED');
    expect(roundPaisa(result.exact.emi)).toBe(2110.11);
    expect(result.emi).toBe(2110);
    expect(roundPaisa(result.exact.total_outflow)).toBe(126_606.53);
    expect(result.moratorium_monthly_payment).toBe(0);
  });

  it('SERVICED: EMI ₹2,027.64, outflow ₹1,25,658.37, ₹666.67 paid monthly during the moratorium', () => {
    const result = run('SERVICED');
    expect(roundPaisa(result.exact.emi)).toBe(2027.64);
    expect(roundPaisa(result.exact.total_outflow)).toBe(125_658.37);
    // P·r = 100000 × 0.0066666… = 666.666…, rounded for display.
    expect(result.moratorium_monthly_payment).toBe(roundRupee((P * R)));
    expect(roundPaisa(P * R)).toBe(666.67);
  });

  it('WAIVED: EMI ₹2,027.64 and total outflow ₹1,21,658.37', () => {
    const result = run('WAIVED');
    expect(roundPaisa(result.exact.emi)).toBe(2027.64);
    expect(roundPaisa(result.exact.total_outflow)).toBe(121_658.37);
    expect(result.moratorium_monthly_payment).toBe(0);
  });
});

describe('the three Appendix A invariants — the ones implementations get wrong', () => {
  it('1. CAPITALISED EMI is strictly higher than the other two', () => {
    const capitalised = run('CAPITALISED');
    const serviced = run('SERVICED');
    const waived = run('WAIVED');
    expect(capitalised.exact.emi).toBeGreaterThan(serviced.exact.emi);
    expect(capitalised.exact.emi).toBeGreaterThan(waived.exact.emi);
  });

  it('2. SERVICED and WAIVED share an EMI and differ in outflow by exactly P·r·m', () => {
    const serviced = run('SERVICED');
    const waived = run('WAIVED');
    // Same EMI to the last bit, not merely to the rupee — this is the assertion
    // that catches amortising the wrong base.
    expect(serviced.exact.emi).toBe(waived.exact.emi);
    expect(serviced.emi).toBe(waived.emi);
    expect(serviced.exact.total_outflow - waived.exact.total_outflow).toBeCloseTo(P * R * M, 6);
  });

  it('3. a zero rate gives EMI = P/n across all three treatments', () => {
    for (const treatment of ['CAPITALISED', 'SERVICED', 'WAIVED'] as const) {
      const result = amortise({
        principal: 60_000,
        monthlyRate: 0,
        repaymentMonths: 60,
        moratoriumMonths: M,
        treatment,
        annualRatePct: 0,
      });
      expect(result.exact.emi).toBe(1000);
      expect(result.emi).toBe(1000);
      expect(result.totals.total_interest).toBe(0);
      expect(result.totals.total_outflow).toBe(60_000);
    }
  });
});

describe('the schedule always adds up — hard rule 7', () => {
  for (const treatment of ['CAPITALISED', 'SERVICED', 'WAIVED'] as const) {
    describe(treatment, () => {
      const result = run(treatment);

      it('has one row per month, moratorium included', () => {
        expect(result.rows).toHaveLength(M + N);
        expect(result.rows.filter((row) => row.phase === 'MORATORIUM')).toHaveLength(M);
        expect(result.rows.filter((row) => row.phase === 'REPAYMENT')).toHaveLength(N);
        expect(result.rows.map((row) => row.month)).toEqual(
          Array.from({ length: M + N }, (unused, index) => index + 1),
        );
      });

      it('closes at exactly zero', () => {
        expect(result.rows[result.rows.length - 1].closing_balance).toBe(0);
      });

      it('never lets the balance go negative mid-schedule', () => {
        for (const row of result.rows) {
          expect(row.closing_balance).toBeGreaterThanOrEqual(0);
        }
      });

      it('repays exactly the amortised principal', () => {
        expect(result.totals.principal_repaid).toBe(roundRupee(result.amortised_principal));
      });

      it('has rounded totals that equal the sum of the rounded rows', () => {
        const paid = result.rows.reduce((sum, row) => sum + row.payment, 0);
        expect(result.totals.total_outflow).toBe(paid);
        // total_interest is defined as everything paid above the sanctioned
        // principal. Deliberately NOT the sum of the interest column: under
        // CAPITALISED the moratorium interest is added to the balance rather
        // than paid, so summing that column would double-count it.
        expect(result.totals.total_interest).toBe(paid - roundRupee(P));
      });

      it('accounts for the moratorium in exactly one of the two moratorium totals', () => {
        const { moratorium_interest_serviced, moratorium_interest_capitalised } = result.totals;
        if (treatment === 'SERVICED') {
          expect(moratorium_interest_serviced).toBe(roundRupee(P * R) * M);
          expect(moratorium_interest_capitalised).toBe(0);
        } else if (treatment === 'CAPITALISED') {
          expect(moratorium_interest_serviced).toBe(0);
          expect(moratorium_interest_capitalised).toBeGreaterThan(0);
        } else {
          expect(moratorium_interest_serviced).toBe(0);
          expect(moratorium_interest_capitalised).toBe(0);
        }
      });

      it('has rounded totals within a rupee per instalment of the exact ones', () => {
        // The final instalment absorbs the residual, so drift is bounded by the
        // per-row rounding, not by the schedule length.
        expect(Math.abs(result.totals.total_outflow - result.exact.total_outflow)).toBeLessThan(
          M + N,
        );
      });
    });
  }
});

describe('edge shapes that must not throw', () => {
  it('handles a zero-month moratorium', () => {
    const result = run('CAPITALISED', { moratoriumMonths: 0 });
    expect(result.rows).toHaveLength(N);
    expect(result.amortised_principal).toBe(P);
    expect(result.exact.moratorium_interest).toBe(0);
  });

  it('handles a single repayment instalment', () => {
    const result = run('WAIVED', { repaymentMonths: 1, moratoriumMonths: 0 });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].closing_balance).toBe(0);
    expect(result.totals.principal_repaid).toBe(P);
  });

  it('rejects a fractional or zero repayment term', () => {
    expect(() => run('WAIVED', { repaymentMonths: 0 })).toThrow();
    expect(() => run('WAIVED', { repaymentMonths: 12.5 })).toThrow();
  });
});

describe('the rounding policy', () => {
  it('is half-up, not banker’s', () => {
    expect(roundRupee(0.5)).toBe(1);
    expect(roundRupee(1.5)).toBe(2);
    expect(roundRupee(2.5)).toBe(3); // banker's rounding would give 2
    expect(roundRupee(2.4999)).toBe(2);
  });

  it('normalises negative zero', () => {
    expect(roundRupee(-0.2)).toBe(0);
    expect(Object.is(roundRupee(-0.2), -0)).toBe(false);
  });

  it('throws on non-finite input rather than propagating NaN into a schedule', () => {
    expect(() => roundRupee(Number.NaN)).toThrow();
    expect(() => roundRupee(Number.POSITIVE_INFINITY)).toThrow();
  });

  it('does not round rates', () => {
    // 8.333…% must survive as a repeating fraction, or the last instalment moves.
    expect(monthlyRateFromAnnualPct(8 + 1 / 3)).toBe((8 + 1 / 3) / 12 / 100);
  });
});

/* ------------------------------------------------------------------------- */
/* Awaiting real guideline figures                                            */
/* ------------------------------------------------------------------------- */

describe.todo(
  /*
   * TODO(verify) — golden cases for computeLoan() against REAL scheme parameters.
   *
   * These cannot be written yet. Every figure they need is null in
   * data/schemes.seed.json, and filling them in from a plausible guess is the
   * single worst outcome available to this project (CLAUDE.md hard rule 1).
   * tests/personas.snapshot.test.ts already locks in the pipeline's behaviour
   * against the demo overlay, so the arithmetic is regression-protected in the
   * meantime; what is missing is a case whose numbers we could put on a slide.
   *
   * When the guidelines are in hand, one case per scheme asserting the full
   * chain from ROADMAP §8.1, hand-computed on paper first:
   *
   *   eligible_cost    = min(project_cost, max_unit_cost)
   *   subsidy          = min(subsidy_pct × eligible_cost, subsidy_cap)
   *   own_contribution = margin_pct × eligible_cost
   *   gross_loan       = eligible_cost − own_contribution − (subsidy if FRONT)
   *   loan             = min(gross_loan, max_loan, loan_pct_cap × eligible_cost)
   *   rate             = the band the loan falls in
   *   emi              = amortise(loan, rate/1200, tenure, moratorium, treatment)
   *
   * and one case per scheme where each of the three binding constraints wins,
   * asserting `binding_constraint`.
   */
  'computeLoan against published scheme figures',
);
