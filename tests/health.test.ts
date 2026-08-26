/**
 * tests/health.test.ts
 *
 * The partner health score is the project's most dangerous number, and not
 * because the arithmetic is hard. It is dangerous because it is an opinion —
 * our weighting of four indicators — rendered as a single figure between 0 and
 * 1, next to real institutions, in a UI that also displays official scheme
 * rules. A viewer has no way to tell the two apart unless we insist on it.
 *
 * Hence two groups of tests:
 *
 *   - weights: the composite behaves like a weighted mean, is bounded, is
 *     monotone in each factor, and every factor's contribution is reported so
 *     the UI can show the breakdown rather than a bare number;
 *   - labelling: the score never travels without its data_origin, and the
 *     current data is SIMULATED throughout.
 */

import { describe, expect, it } from 'vitest';
import {
  assertWeightsSumToOne,
  scoreHealth,
  type HealthScoringConfig,
} from '../src/core/partners/health';
import { loadHealthConfig, loadHealthMap, loadPartners } from '../src/lib/dataset';
import type { PartnerHealthRecord } from '../src/core/types';
import { hasMessage } from '../src/messages';

const config = loadHealthConfig();
const health = loadHealthMap();

/** A deliberately mid-range record, so every factor has room to move both ways. */
function record(overrides: Partial<PartnerHealthRecord> = {}): PartnerHealthRecord {
  return {
    partner_code: 'TEST_PARTNER',
    funds_sanctioned: 1_000_000,
    funds_utilised: 500_000,
    npa_pct: config.normalisation.npa_pct_worst / 2,
    overdue_amount: 1_000_000 * (config.normalisation.overdue_ratio_worst / 2),
    avg_processing_days:
      (config.normalisation.processing_days_best + config.normalisation.processing_days_worst) / 2,
    capacity_flag: 'OPEN',
    data_origin: 'SIMULATED',
    as_of: '2026-01-01',
    ...overrides,
  };
}

describe('the weights', () => {
  it('sum to one in the shipped config', () => {
    expect(() => assertWeightsSumToOne(config.weights)).not.toThrow();
  });

  it('throws rather than silently distorting every ranking', () => {
    // A config that does not sum to 1 produces scores outside 0..1 and
    // comparisons that look arbitrary. Failing at load is the only safe answer.
    expect(() =>
      assertWeightsSumToOne({ fund_availability: 0.5, npa: 0.5, overdue: 0.5, speed: 0.5 }),
    ).toThrow(/sum to 1/);
    expect(() =>
      assertWeightsSumToOne({ fund_availability: 0, npa: 0, overdue: 0, speed: 0 }),
    ).toThrow();
  });

  it('tolerates the float error of adding decimal literals', () => {
    // 0.35 + 0.25 + 0.2 + 0.2 is not exactly 1 in binary floating point.
    expect(() =>
      assertWeightsSumToOne({ fund_availability: 0.35, npa: 0.25, overdue: 0.2, speed: 0.2 }),
    ).not.toThrow();
  });

  it('states a rationale for each weight, because each one is a design decision', () => {
    for (const key of ['fund_availability', 'npa', 'overdue', 'speed'] as const) {
      expect(hasMessage(config.weight_rationale_keys[key])).toBe(true);
    }
  });
});

describe('the composite score', () => {
  it('stays within 0..1 for the shipped data', () => {
    for (const [code, row] of health) {
      const score = scoreHealth(row, config);
      expect(score.score, `${code} scored outside 0..1`).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(1);
    }
  });

  it('reaches 1 for a perfect partner and 0 for the worst possible one', () => {
    const perfect = scoreHealth(
      record({
        funds_utilised: 0,
        npa_pct: 0,
        overdue_amount: 0,
        avg_processing_days: config.normalisation.processing_days_best,
      }),
      config,
    );
    expect(perfect.score).toBeCloseTo(1, 9);

    const worst = scoreHealth(
      record({
        funds_utilised: 1_000_000,
        npa_pct: config.normalisation.npa_pct_worst,
        overdue_amount: 1_000_000 * config.normalisation.overdue_ratio_worst,
        avg_processing_days: config.normalisation.processing_days_worst,
      }),
      config,
    );
    expect(worst.score).toBeCloseTo(0, 9);
  });

  it('clamps rather than exploding when a partner is worse than the worst case', () => {
    const beyond = scoreHealth(
      record({
        funds_utilised: 5_000_000, // over-utilised beyond its sanction
        npa_pct: config.normalisation.npa_pct_worst * 10,
        overdue_amount: 100_000_000,
        avg_processing_days: config.normalisation.processing_days_worst * 10,
      }),
      config,
    );
    expect(beyond.score).toBeGreaterThanOrEqual(0);
    expect(beyond.score).toBeLessThanOrEqual(1);
  });

  it('is monotone in each factor, holding the others fixed', () => {
    const base = scoreHealth(record(), config);

    // More funds left to lend is better.
    expect(scoreHealth(record({ funds_utilised: 100_000 }), config).score).toBeGreaterThan(
      base.score,
    );
    // Higher NPA is worse.
    expect(
      scoreHealth(record({ npa_pct: config.normalisation.npa_pct_worst * 0.9 }), config).score,
    ).toBeLessThan(base.score);
    // More overdue is worse.
    expect(scoreHealth(record({ overdue_amount: 900_000 }), config).score).toBeLessThan(base.score);
    // Slower is worse.
    expect(
      scoreHealth(
        record({ avg_processing_days: config.normalisation.processing_days_worst }),
        config,
      ).score,
    ).toBeLessThan(base.score);
  });

  it('reports every factor with its weight and contribution, so the UI can show the breakdown', () => {
    const score = scoreHealth(record(), config);
    expect(score.factors).toHaveLength(4);
    const keys = score.factors.map((factor) => factor.key).sort();
    expect(keys).toEqual(['fund_availability', 'npa', 'overdue', 'speed']);
    for (const factor of score.factors) {
      expect(factor.normalised).toBeGreaterThanOrEqual(0);
      expect(factor.normalised).toBeLessThanOrEqual(1);
      expect(factor.contribution).toBeCloseTo(factor.normalised * factor.weight, 9);
      expect(hasMessage(factor.rationaleKey)).toBe(true);
    }
  });

  it('has contributions that sum to the score — no hidden term', () => {
    for (const row of health.values()) {
      const score = scoreHealth(row, config);
      const summed = score.factors.reduce((total, factor) => total + factor.contribution, 0);
      // The capacity multiplier is applied after the weighted sum, so compare
      // against the pre-multiplier composite the score reports.
      expect(summed).toBeCloseTo(score.raw_score, 9);
    }
  });

  it('divides safely when a partner has no sanctioned funds at all', () => {
    // A brand-new partner with zeroes must not produce NaN and silently sort to
    // the top or bottom of every list.
    const score = scoreHealth(
      record({ funds_sanctioned: 0, funds_utilised: 0, overdue_amount: 0 }),
      config,
    );
    expect(Number.isFinite(score.score)).toBe(true);
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(1);
  });
});

describe('the capacity flag', () => {
  it('penalises a constrained partner and zeroes a closed one', () => {
    const open = scoreHealth(record({ capacity_flag: 'OPEN' }), config);
    const constrained = scoreHealth(record({ capacity_flag: 'CONSTRAINED' }), config);
    const closed = scoreHealth(record({ capacity_flag: 'CLOSED' }), config);
    expect(constrained.score).toBeLessThan(open.score);
    expect(closed.score).toBe(0);
    // CLOSED zeroes the score rather than hard-filtering the partner out, so the
    // UI can still show it with an explanation. Confirm the raw composite
    // survives underneath, which is what makes that explanation possible.
    expect(closed.raw_score).toBeGreaterThan(0);
    expect(closed.raw_score).toBe(open.raw_score);
  });

  it('has a multiplier and a renderable label for every flag it accepts', () => {
    for (const [flag, multiplier] of Object.entries(config.capacity_multipliers)) {
      expect(multiplier).toBeGreaterThanOrEqual(0);
      expect(multiplier).toBeLessThanOrEqual(1);
      expect(hasMessage(`health.capacity.${flag}`)).toBe(true);
    }
  });

  it('never lets the multiplier push a score out of range', () => {
    for (const flag of Object.keys(config.capacity_multipliers)) {
      const score = scoreHealth(
        record({ capacity_flag: flag as PartnerHealthRecord['capacity_flag'] }),
        config,
      );
      expect(score.score).toBeGreaterThanOrEqual(0);
      expect(score.score).toBeLessThanOrEqual(1);
    }
  });
});

describe('labelling — invariant 2', () => {
  it('carries data_origin onto every score, so no screen can render a bare number', () => {
    for (const row of health.values()) {
      expect(scoreHealth(row, config).data_origin).toBe(row.data_origin);
    }
  });

  it('carries the as_of date onto every score', () => {
    for (const row of health.values()) {
      expect(scoreHealth(row, config).as_of).toBe(row.as_of);
    }
  });

  it('reports every current partner as SIMULATED, because none of it is a real MIS feed', () => {
    const origins = new Set([...health.values()].map((row) => scoreHealth(row, config).data_origin));
    expect(origins).toEqual(new Set(['SIMULATED']));
  });

  it('has a health row for every partner in the registry, or none at all', () => {
    // A partial health table is fine by design — a partner with no row scores
    // null rather than zero. This test records which case we are actually in,
    // so a half-populated table cannot appear by accident.
    const partners = loadPartners();
    const withRow = partners.filter((partner) => health.has(partner.code));
    expect(withRow).toHaveLength(partners.length);
  });

  it('keeps the score and its origin in one object, so they cannot be separated in transit', () => {
    const score = scoreHealth(record(), config);
    expect(Object.keys(score)).toContain('data_origin');
    expect(Object.keys(score)).toContain('score');
  });
});

describe('the config the app loads', () => {
  it('has a normalisation window that is the right way round', () => {
    expect(config.normalisation.processing_days_best).toBeLessThan(
      config.normalisation.processing_days_worst,
    );
    expect(config.normalisation.npa_pct_worst).toBeGreaterThan(0);
    expect(config.normalisation.overdue_ratio_worst).toBeGreaterThan(0);
  });

  it('is a plain object with no surprises, so it can be swapped for a real one', () => {
    const shape: HealthScoringConfig = config;
    expect(Object.keys(shape).sort()).toEqual([
      'capacity_multipliers',
      'normalisation',
      'weight_rationale_keys',
      'weights',
    ]);
  });
});
