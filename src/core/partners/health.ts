/**
 * src/core/partners/health.ts
 *
 * A transparent weighted composite, not a model. ROADMAP §7: there is no
 * training data for partner performance, so a learned score we cannot explain
 * would be strictly worse on stage than four weights we can defend.
 *
 *   health = w_fund·fund_availability + w_npa·(1 − npa_norm)
 *          + w_overdue·(1 − overdue_norm) + w_speed·speed_norm
 *
 * then multiplied by a capacity flag multiplier.
 *
 * The weights and normalisation bounds are DATA (data/health-scoring.json), not
 * constants here, and they are returned inside every score so the UI can show
 * each factor's contribution on hover. That is the whole point: a judge should
 * be able to see why one partner outranked another.
 *
 * `data_origin` travels with the score. It cannot be dropped on the way to the
 * UI, which is what makes it structurally hard to render a simulated figure
 * without its label.
 */

import type {
  CapacityFlag,
  HealthFactor,
  HealthScore,
  PartnerHealthRecord,
} from '../types';
import { clamp } from '../finance/rounding';

export interface HealthWeights {
  fund_availability: number;
  npa: number;
  overdue: number;
  speed: number;
}

export interface HealthNormalisation {
  npa_pct_worst: number;
  overdue_ratio_worst: number;
  processing_days_best: number;
  processing_days_worst: number;
}

export interface HealthScoringConfig {
  weights: HealthWeights;
  normalisation: HealthNormalisation;
  capacity_multipliers: Record<CapacityFlag, number>;
  weight_rationale_keys: Record<keyof HealthWeights, string>;
}

/**
 * Guard the one invariant that would silently distort every ranking: weights
 * that do not sum to 1 produce scores outside 0..1 and comparisons that look
 * arbitrary. Called by the loader, and asserted in tests.
 */
export function assertWeightsSumToOne(weights: HealthWeights): void {
  const sum = weights.fund_availability + weights.npa + weights.overdue + weights.speed;
  // Tolerance for float addition of decimal literals, e.g. 0.35 + 0.25 + 0.2 + 0.2.
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`Health weights must sum to 1, got ${sum}. Fix data/health-scoring.json.`);
  }
}

function safeRatio(numerator: number, denominator: number): number {
  if (!Number.isFinite(denominator) || denominator <= 0) return 0;
  return numerator / denominator;
}

export function scoreHealth(
  record: PartnerHealthRecord,
  config: HealthScoringConfig,
): HealthScore {
  const { weights, normalisation } = config;

  // Higher is better: the share of sanctioned funds still available to lend.
  const fundAvailability = clamp(
    1 - safeRatio(record.funds_utilised, record.funds_sanctioned),
    0,
    1,
  );

  // Lower is better, so these are normalised as "how bad" and inverted below.
  const npaNorm = clamp(safeRatio(record.npa_pct, normalisation.npa_pct_worst), 0, 1);
  const overdueNorm = clamp(
    safeRatio(record.overdue_amount, record.funds_sanctioned) / normalisation.overdue_ratio_worst,
    0,
    1,
  );

  const daySpan = normalisation.processing_days_worst - normalisation.processing_days_best;
  const speedNorm = clamp(
    1 - safeRatio(record.avg_processing_days - normalisation.processing_days_best, daySpan),
    0,
    1,
  );

  const factors: HealthFactor[] = [
    {
      key: 'fund_availability',
      raw: record.funds_sanctioned > 0 ? record.funds_sanctioned - record.funds_utilised : 0,
      normalised: fundAvailability,
      weight: weights.fund_availability,
      contribution: weights.fund_availability * fundAvailability,
      rationaleKey: config.weight_rationale_keys.fund_availability,
    },
    {
      key: 'npa',
      raw: record.npa_pct,
      normalised: 1 - npaNorm,
      weight: weights.npa,
      contribution: weights.npa * (1 - npaNorm),
      rationaleKey: config.weight_rationale_keys.npa,
    },
    {
      key: 'overdue',
      raw: record.overdue_amount,
      normalised: 1 - overdueNorm,
      weight: weights.overdue,
      contribution: weights.overdue * (1 - overdueNorm),
      rationaleKey: config.weight_rationale_keys.overdue,
    },
    {
      key: 'speed',
      raw: record.avg_processing_days,
      normalised: speedNorm,
      weight: weights.speed,
      contribution: weights.speed * speedNorm,
      rationaleKey: config.weight_rationale_keys.speed,
    },
  ];

  const rawScore = factors.reduce((sum, factor) => sum + factor.contribution, 0);
  const multiplier = config.capacity_multipliers[record.capacity_flag] ?? 1;

  return {
    score: clamp(rawScore * multiplier, 0, 1),
    raw_score: clamp(rawScore, 0, 1),
    capacity_flag: record.capacity_flag,
    capacity_multiplier: multiplier,
    factors,
    data_origin: record.data_origin,
    as_of: record.as_of,
  };
}
