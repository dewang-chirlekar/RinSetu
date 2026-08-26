/**
 * tests/recommend.ranking.test.ts
 *
 * The headline recommendation is chosen by RECOMMENDATION_POLICY: largest share
 * of the project cost, then lowest rate, then scheme code. That is OUR
 * heuristic, not a scheme rule, which is exactly why it needs testing — a jury
 * can reasonably ask why we put one scheme above another, and the answer has to
 * be the same every time.
 *
 * These tests call pickRecommended() directly. They have to: MICRO, TERM and EDU
 * in data/schemes.seed.json have disjoint eligible purposes AND mutually
 * exclusive project-cost predicates, so no applicant can be eligible for two of
 * them at once. That is recorded in data/personas.fixtures.json under
 * known_gaps_in_this_file, and it means the multi-scheme ranking path is
 * unreachable from the persona set. It is still reachable in production the
 * moment a real scheme master has overlapping eligibility, so it is tested here
 * rather than left to the day it matters.
 */

import { describe, expect, it } from 'vitest';
import { RECOMMENDATION_POLICY, pickRecommended, recommend } from '../src/core/recommend';
import type { LoanComputation, SchemeRecommendation, SchemeStatus } from '../src/core/types';
import { loadBundle, loadPersonas } from '../src/lib/dataset';
import { hasMessage } from '../src/messages';

const bundle = loadBundle({ applyOverlay: true });
const personas = loadPersonas();

/**
 * The smallest SchemeRecommendation pickRecommended actually reads. Everything
 * else is deliberately omitted rather than filled with plausible values, so this
 * helper cannot drift into asserting things it does not test.
 */
function candidate(
  code: string,
  options: {
    status?: SchemeStatus;
    projectCost?: number;
    loan?: number;
    rate?: number;
    computable?: boolean;
  } = {},
): SchemeRecommendation {
  const {
    status = 'ELIGIBLE',
    projectCost = 100_000,
    loan = 50_000,
    rate = 10,
    computable = true,
  } = options;

  const computation: LoanComputation | null = computable
    ? ({
        computable: true,
        project_cost: projectCost,
        loan,
        annual_rate_pct: rate,
      } as unknown as LoanComputation)
    : ({ computable: false, missing: ['scheme.max_unit_cost'] } as LoanComputation);

  return {
    scheme_code: code,
    status,
    computation: status === 'ELIGIBLE' ? computation : null,
  } as unknown as SchemeRecommendation;
}

describe('the policy is stated, not implicit', () => {
  it('names itself in a message key the UI can render beside the recommendation', () => {
    expect(hasMessage(RECOMMENDATION_POLICY.messageKey)).toBe(true);
  });

  it('lists its criteria in priority order', () => {
    expect(RECOMMENDATION_POLICY.criteria).toEqual([
      'SHARE_OF_PROJECT_COST_DESC',
      'ANNUAL_RATE_ASC',
      'SCHEME_CODE_ASC',
    ]);
  });
});

describe('criterion 1 — largest share of the project cost', () => {
  it('prefers the scheme covering more of the project, even when its loan is smaller', () => {
    // This is the whole point of ranking on share rather than on amount: B lends
    // less money but covers the entire project, so the applicant has nothing
    // left to find.
    const picked = pickRecommended([
      candidate('A', { projectCost: 1_000_000, loan: 500_000, rate: 8 }),
      candidate('B', { projectCost: 100_000, loan: 100_000, rate: 8 }),
    ]);
    expect(picked).toBe('B');
  });

  it('prefers the larger loan when the project cost is the same', () => {
    const picked = pickRecommended([
      candidate('A', { projectCost: 100_000, loan: 60_000 }),
      candidate('B', { projectCost: 100_000, loan: 90_000 }),
    ]);
    expect(picked).toBe('B');
  });

  it('does not divide by zero on a zero project cost', () => {
    const picked = pickRecommended([
      candidate('A', { projectCost: 0, loan: 0 }),
      candidate('B', { projectCost: 100_000, loan: 10_000 }),
    ]);
    expect(picked).toBe('B');
  });
});

describe('criterion 2 — lower rate breaks a share tie', () => {
  it('picks the cheaper scheme when both cover the same share', () => {
    const picked = pickRecommended([
      candidate('EXPENSIVE', { projectCost: 100_000, loan: 80_000, rate: 12 }),
      candidate('CHEAP', { projectCost: 100_000, loan: 80_000, rate: 8 }),
    ]);
    expect(picked).toBe('CHEAP');
  });

  it('does not let a lower rate outrank a larger share', () => {
    // Share is criterion 1 and must dominate, however tempting the rate looks.
    const picked = pickRecommended([
      candidate('CHEAP_SMALL', { projectCost: 100_000, loan: 40_000, rate: 4 }),
      candidate('DEAR_BIG', { projectCost: 100_000, loan: 90_000, rate: 14 }),
    ]);
    expect(picked).toBe('DEAR_BIG');
  });
});

describe('criterion 3 — scheme code makes the result deterministic', () => {
  it('breaks a full tie alphabetically', () => {
    const picked = pickRecommended([
      candidate('ZEBRA', { projectCost: 100_000, loan: 80_000, rate: 8 }),
      candidate('ALPHA', { projectCost: 100_000, loan: 80_000, rate: 8 }),
    ]);
    expect(picked).toBe('ALPHA');
  });

  it('gives the same answer regardless of input order', () => {
    // A recommendation that depends on the order schemes happen to sit in the
    // seed file is not a recommendation, it is an accident.
    const a = candidate('ALPHA', { projectCost: 100_000, loan: 80_000, rate: 8 });
    const z = candidate('ZEBRA', { projectCost: 100_000, loan: 80_000, rate: 8 });
    expect(pickRecommended([a, z])).toBe(pickRecommended([z, a]));
  });

  it('is stable across many shuffles of a three-way tie', () => {
    const three = [
      candidate('B', { projectCost: 100_000, loan: 80_000, rate: 8 }),
      candidate('A', { projectCost: 100_000, loan: 80_000, rate: 8 }),
      candidate('C', { projectCost: 100_000, loan: 80_000, rate: 8 }),
    ];
    const orderings = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0],
    ];
    for (const ordering of orderings) {
      expect(pickRecommended(ordering.map((index) => three[index]))).toBe('A');
    }
  });
});

describe('what is and is not a candidate', () => {
  it('ignores schemes that are not ELIGIBLE, however good their figures look', () => {
    const picked = pickRecommended([
      candidate('REJECTED', { status: 'NOT_ELIGIBLE', projectCost: 100_000, loan: 100_000 }),
      candidate('UNKNOWN', { status: 'INDETERMINATE', projectCost: 100_000, loan: 100_000 }),
      candidate('OK', { projectCost: 100_000, loan: 10_000 }),
    ]);
    expect(picked).toBe('OK');
  });

  it('returns null when nothing is eligible', () => {
    expect(
      pickRecommended([
        candidate('A', { status: 'NOT_ELIGIBLE' }),
        candidate('B', { status: 'INDETERMINATE' }),
      ]),
    ).toBeNull();
    expect(pickRecommended([])).toBeNull();
  });

  it('falls back to an eligible scheme whose figures are not computable', () => {
    // "You qualify for this, but we cannot price it until the guideline lands"
    // is a better answer than "nothing found".
    const picked = pickRecommended([
      candidate('NO_FIGURES', { computable: false }),
      candidate('ALSO_NO_FIGURES', { computable: false }),
    ]);
    expect(picked).toBe('NO_FIGURES');
  });

  it('prefers a priced eligible scheme over an unpriced one', () => {
    const picked = pickRecommended([
      candidate('UNPRICED', { computable: false }),
      candidate('PRICED', { projectCost: 100_000, loan: 10_000 }),
    ]);
    expect(picked).toBe('PRICED');
  });
});

describe('against the real dataset', () => {
  it('recommends exactly one scheme, and only ever an eligible one', () => {
    for (const persona of personas) {
      const result = recommend({
        applicant: persona.applicant,
        dataset: bundle.dataset,
        partners: bundle.partners,
        health: bundle.health,
        healthConfig: bundle.healthConfig,
        documentDefinitions: bundle.documentDefinitions,
        documentRequirements: bundle.documentRequirements,
        generatedAt: '2026-01-01T00:00:00.000Z',
      });
      if (result.recommended_scheme_code === null) {
        expect(result.schemes.every((scheme) => scheme.status !== 'ELIGIBLE')).toBe(true);
        continue;
      }
      const recommended = result.schemes.find(
        (scheme) => scheme.scheme_code === result.recommended_scheme_code,
      );
      expect(recommended, `${persona.id} recommended a scheme not in the result`).toBeDefined();
      expect(recommended!.status).toBe('ELIGIBLE');
    }
  });

  it('confirms no persona reaches the multi-scheme path, as the fixture file claims', () => {
    // If this ever fails, it is good news: the dataset has gained overlapping
    // eligibility and the persona set should grow a multi-eligible case. Update
    // known_gaps_in_this_file at the same time.
    const multi = personas.filter((persona) => {
      const result = recommend({
        applicant: persona.applicant,
        dataset: bundle.dataset,
        partners: bundle.partners,
        health: bundle.health,
        healthConfig: bundle.healthConfig,
        documentDefinitions: bundle.documentDefinitions,
        documentRequirements: bundle.documentRequirements,
        generatedAt: '2026-01-01T00:00:00.000Z',
      });
      return result.schemes.filter((scheme) => scheme.status === 'ELIGIBLE').length > 1;
    });
    expect(multi.map((persona) => persona.id)).toEqual([]);
  });

  it('never quotes figures for a scheme the applicant cannot have', () => {
    // A number on screen reads as an offer, so computation must be null for any
    // scheme that is not ELIGIBLE.
    for (const persona of personas) {
      const result = recommend({
        applicant: persona.applicant,
        dataset: bundle.dataset,
        partners: bundle.partners,
        health: bundle.health,
        healthConfig: bundle.healthConfig,
        documentDefinitions: bundle.documentDefinitions,
        documentRequirements: bundle.documentRequirements,
        generatedAt: '2026-01-01T00:00:00.000Z',
      });
      for (const scheme of result.schemes) {
        if (scheme.status === 'ELIGIBLE') continue;
        expect(
          scheme.computation,
          `${persona.id}/${scheme.scheme_code} is ${scheme.status} but carries figures`,
        ).toBeNull();
        expect(scheme.partners).toBeNull();
        expect(scheme.checklist).toBeNull();
      }
    }
  });

  it('takes its timestamp from the caller and never reads the clock', () => {
    const stamp = '2020-02-29T12:34:56.000Z';
    const result = recommend({
      applicant: personas[0].applicant,
      dataset: bundle.dataset,
      partners: bundle.partners,
      health: bundle.health,
      healthConfig: bundle.healthConfig,
      documentDefinitions: bundle.documentDefinitions,
      documentRequirements: bundle.documentRequirements,
      generatedAt: stamp,
    });
    expect(result.generated_at).toBe(stamp);
  });

  it('is a pure function — the same input twice gives a deeply equal result', () => {
    const call = () =>
      recommend({
        applicant: personas.find((p) => p.id === 'P22')!.applicant,
        dataset: bundle.dataset,
        partners: bundle.partners,
        health: bundle.health,
        healthConfig: bundle.healthConfig,
        documentDefinitions: bundle.documentDefinitions,
        documentRequirements: bundle.documentRequirements,
        generatedAt: '2026-01-01T00:00:00.000Z',
      });
    expect(call()).toEqual(call());
  });
});
