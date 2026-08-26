/**
 * src/core/finance/rounding.ts
 *
 * ONE rounding policy, used everywhere. CLAUDE.md hard rule 7.
 *
 * The policy, stated so it can be defended:
 *
 *   1. All intermediate arithmetic runs on unrounded JS numbers. We never round
 *      a value and then feed it into the next step — that is how a schedule
 *      drifts by tens of rupees over sixty months.
 *
 *   2. Every money value that is stored or displayed passes through
 *      `roundRupee`: half-up to the whole rupee. Half-up, not banker's
 *      rounding, because it is what a hand-check on paper produces and this
 *      project's golden tests are hand-computed.
 *
 *   3. Rates, percentages and ratios are never rounded. Rounding 8.333…% to
 *      8.33% before amortising changes the last instalment.
 *
 *   4. In an amortisation schedule the EMI is rounded once, each row's interest
 *      is rounded, principal is the remainder, and the FINAL instalment absorbs
 *      whatever residual is left so the closing balance is exactly zero. This
 *      is standard lending practice and it is why the schedule always sums.
 *
 * Money is held as a JS number of rupees. At our scale (largest loan ~5e6, two
 * decimal places) doubles are exact enough that the residual absorbed by the
 * final instalment is always sub-rupee. If a future scheme pushes past ~9e12
 * rupees, revisit this and move to integer paise.
 */

/** Half-up to the whole rupee. -0 is normalised to 0. */
export function roundRupee(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error(`roundRupee received a non-finite value: ${amount}`);
  }
  // Math.round is half-up for positives and half-up-toward-+Infinity for
  // negatives, which would make -0.5 round to -0 rather than -1. Money in this
  // engine is never negative, but be explicit rather than surprising.
  const rounded = amount < 0 ? -Math.round(-amount) : Math.round(amount);
  return rounded === 0 ? 0 : rounded;
}

/** Half-up to two decimals. Used only where paisa are genuinely meaningful (test assertions). */
export function roundPaisa(amount: number): number {
  if (!Number.isFinite(amount)) {
    throw new Error(`roundPaisa received a non-finite value: ${amount}`);
  }
  const scaled = amount * 100;
  const rounded = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled);
  return rounded / 100;
}

/** Clamp into [lo, hi]. Used by the health normalisers and the term resolver. */
export function clamp(value: number, lo: number, hi: number): number {
  if (lo > hi) throw new Error(`clamp called with lo > hi: ${lo} > ${hi}`);
  return Math.min(hi, Math.max(lo, value));
}

/**
 * A percentage as a fraction. `pct(8.5)` is 0.085.
 * Deliberately not rounded — see policy note 3.
 */
export function pctToFraction(percent: number): number {
  return percent / 100;
}

/** Annual percentage to monthly fractional rate. Not rounded. */
export function monthlyRateFromAnnualPct(annualPct: number): number {
  return annualPct / 12 / 100;
}
