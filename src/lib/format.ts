/**
 * src/lib/format.ts
 *
 * Presentation-layer formatting. Deliberately outside src/core/ — the core deals
 * in numbers, this file decides how a number looks.
 *
 * Two rules that matter:
 *
 *   1. The rupee symbol comes from common.currency_symbol, never a literal '₹'.
 *      tests/messages.coverage.test.ts enforces the same rule on the catalogue,
 *      so a locale change has exactly one place to touch.
 *
 *   2. Indian digit grouping (1,23,456) via en-IN. Lakh/crore grouping is what
 *      the target user reads; western grouping would look foreign on screen.
 */

import { translate } from '@/messages';

const RUPEES = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const RUPEES_PAISA = new Intl.NumberFormat('en-IN', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const PLAIN = new Intl.NumberFormat('en-IN');

export function currencySymbol(): string {
  return translate('common.currency_symbol');
}

/** Whole rupees. The default for every figure on screen. */
export function rupees(value: number): string {
  return `${currencySymbol()} ${RUPEES.format(Math.round(value))}`;
}

/** Rupees and paise. Only for the schedule, where the residual matters. */
export function rupeesPaisa(value: number): string {
  return `${currencySymbol()} ${RUPEES_PAISA.format(value)}`;
}

export function plain(value: number): string {
  return PLAIN.format(value);
}

/**
 * A value already expressed in percent (8 → '8%').
 *
 * Trims a trailing '.0' so 7.0% reads as 7%, but 7.25% keeps its precision.
 */
export function percent(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(2).replace(/0$/, '')}%`;
}

/**
 * A share stored as a fraction (0.05 → '5%').
 *
 * The dataset holds two different units under similarly-spelled names, and this
 * is the one place that difference has to be handled:
 *
 *   - `annual_rate_pct` is already a percentage. 8 means 8% per year.
 *   - `margin_pct`, `subsidy_pct` and `loan_pct_cap` are fractions of a cost.
 *     0.05 means 5%. src/core/finance/loan.ts multiplies each of them straight
 *     into a rupee amount, which is what fixes the unit.
 *
 * Passing a fraction to percent() prints '0.05%' — a hundred times too small,
 * and small enough to look like a deliberate precision rather than a bug. Use
 * this function for anything the engine multiplies by a cost, and percent() for
 * anything it uses as a rate.
 */
export function fractionPercent(value: number): string {
  return percent(value * 100);
}

export function months(count: number): string {
  return translate('loan.months', { count });
}

/** ISO date or timestamp → '26 August 2026'. Returns the input if unparseable. */
export function longDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(parsed);
}

export function longDateTime(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

export function km(value: number): string {
  return value < 10 ? value.toFixed(1) : String(Math.round(value));
}

/**
 * Purpose and course codes are scheme parameters, and every one currently in the
 * seed is a placeholder (`PLACEHOLDER_petty_trade`). There is no message key per
 * purpose because the real list is not transcribed yet, so this humanises the
 * code for display only. It strips the PLACEHOLDER_ prefix rather than hiding it:
 * the dataset banner says the figures are illustrative, and the purpose list is
 * one of the things that is.
 */
export function humanisePurpose(code: string): string {
  const stripped = code.replace(/^PLACEHOLDER_/, '');
  return stripped.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

/** Joins with commas and a translated 'and' before the last item. */
export function joinList(items: string[]): string {
  if (items.length === 0) return '';
  if (items.length === 1) return items[0];
  const and = translate('common.and');
  return `${items.slice(0, -1).join(', ')} ${and} ${items[items.length - 1]}`;
}
