/**
 * tests/loan.test.ts
 *
 * computeLoan() is the step where a person's situation becomes a number, and it
 * had no direct test until tests/personas.snapshot.test.ts showed why one was
 * needed: no persona in the current dataset can reach the `computable: false`
 * branch, because a scheme with missing figures never gets past eligibility. So
 * the whole "why is there no number here" path — the thing that keeps us from
 * inventing a parameter — was shipping unexercised.
 *
 * ON THE FIGURES IN THIS FILE, and CLAUDE.md hard rule 1: nothing below is a
 * scheme parameter. Every scheme in this file is synthetic, built by the test,
 * with deliberately round values (₹2,00,000 ceiling · 10% margin · 25% subsidy
 * capped at ₹40,000 · 12% a year) chosen so that each expected figure can be
 * checked by hand in one line. They are the test's own inputs, exactly as the
 * inputs in tests/finance.golden.test.ts are, and they must never be copied into
 * data/schemes.seed.json or quoted as any real scheme's terms.
 *
 * The pipeline under test, fixed by ROADMAP §8.1 and asserted step by step:
 *
 *   eligible_cost → subsidy → own_contribution → gross_loan → loan → rate → EMI
 */

import { describe, expect, it } from 'vitest';
import { computeLoan } from '../src/core/finance/loan';
import { amortise } from '../src/core/finance/emi';
import { monthlyRateFromAnnualPct } from '../src/core/finance/rounding';
import type {
  ApplicantProfile,
  CostCeilingRule,
  FieldProvenance,
  InterestRule,
  SchemeSpec,
} from '../src/core/types';
import { hasMessage } from '../src/messages';

/**
 * Every synthetic figure is stamped 'fabricated', which is the truth about it,
 * and which isCitable() reports as unverified. A test fixture that stamped
 * itself 'official_guideline' would be the exact lie this project cannot afford,
 * even in a test file nobody demos.
 */
const FAKE: FieldProvenance = {
  source: 'fabricated',
  verified: false,
  note: 'Synthetic value belonging to tests/loan.test.ts. Not any real scheme.',
};

const FLAT_12_PCT: InterestRule[] = [
  { applies_when: {}, annual_rate_pct: 12, provenance: FAKE },
];

function scheme(overrides: Partial<SchemeSpec> = {}): SchemeSpec {
  return {
    code: 'SYNTH',
    type: 'MICRO',
    name_i18n: { en: 'Synthetic test scheme' },
    description_key: 'scheme.micro',

    max_unit_cost: 200_000,
    max_loan: 500_000,
    min_loan: null,
    min_project_cost: null,
    loan_pct_cap: 1,
    margin_pct: 0,
    subsidy_pct: 0,
    subsidy_cap: null,
    subsidy_timing: null,

    moratorium_months_min: 0,
    moratorium_months_max: 12,
    moratorium_months_default: null,
    moratorium_interest_treatment: 'WAIVED',

    tenure_months_max: 60,
    tenure_includes_moratorium: false,

    eligible_purposes: ['SHOP'],
    allowed_partner_types: ['SCA', 'PSB', 'RRB', 'NBFC_MFI'],
    predicates: [],
    required_documents: [],

    interest_rules: FLAT_12_PCT,
    cost_ceiling_rules: [],

    provenance: { max_unit_cost: FAKE },
    source_url: null,
    source_date: null,
    verified: false,
    ...overrides,
  };
}

function applicant(overrides: Partial<ApplicantProfile> = {}): ApplicantProfile {
  return {
    age: 30,
    gender: 'UNDISCLOSED',
    category: 'SC',
    annual_family_income: 100_000,
    state: 'Maharashtra',
    district: 'Pune',
    lat: null,
    lng: null,
    intent: 'UNKNOWN',
    purpose: 'SHOP',
    project_cost: 100_000,
    documents_available: [],
    preferred_language: 'en',
    requested_moratorium_months: 0,
    ...overrides,
  };
}

/** Narrows to the computable branch, failing with the gap list if it is not. */
function computed(...args: Parameters<typeof computeLoan>) {
  const result = computeLoan(...args);
  if (!result.computable) {
    throw new Error(`expected computable figures, got gaps: ${result.missing.join(', ')}`);
  }
  return result;
}

/** The worked example used by several tests below. Every figure checkable by hand. */
const CEILING_CASE = {
  scheme: {
    max_unit_cost: 200_000,
    max_loan: 500_000,
    loan_pct_cap: 0.8,
    margin_pct: 0.1,
    subsidy_pct: 0.25,
    subsidy_cap: 40_000,
  },
  applicantProjectCost: 250_000,
};

describe('the pipeline, step by step', () => {
  it('caps the project at the unit cost, subsidises, takes the margin, then caps the loan', () => {
    //   project        250,000  → over the ceiling
    //   eligible_cost  200,000  = min(250,000, 200,000)
    //   subsidy         40,000  = min(0.25 × 200,000 = 50,000, cap 40,000)
    //   own             20,000  = 0.10 × 200,000
    //   gross          140,000  = 200,000 − 20,000 − 40,000   (FRONT subsidy)
    //   pct cap        160,000  = 0.80 × 200,000
    //   loan           140,000  = min(140,000, 500,000, 160,000) → GROSS binds
    const figures = computed(
      scheme({ ...CEILING_CASE.scheme, subsidy_timing: 'FRONT' }),
      applicant({ project_cost: CEILING_CASE.applicantProjectCost }),
    );
    expect(figures.eligible_cost).toBe(200_000);
    expect(figures.max_unit_cost_applied).toBe(200_000);
    expect(figures.cost_ceiling_source).toBe('SCHEME');
    expect(figures.subsidy).toBe(40_000);
    expect(figures.own_contribution).toBe(20_000);
    expect(figures.gross_loan).toBe(140_000);
    expect(figures.loan).toBe(140_000);
    expect(figures.binding_constraint).toBe('GROSS');
  });

  it('never raises the project to the ceiling', () => {
    // A ceiling limits, it does not top up. Getting this backwards would quote a
    // bigger loan than the applicant asked to borrow.
    const figures = computed(scheme(), applicant({ project_cost: 40_000 }));
    expect(figures.eligible_cost).toBe(40_000);
    expect(figures.loan).toBe(40_000);
  });

  it('subtracts a FRONT subsidy from the loan and a BACK subsidy from nothing', () => {
    // Same scheme, one field different. The subsidy is identical; the loan is not.
    const front = computed(
      scheme({ ...CEILING_CASE.scheme, subsidy_timing: 'FRONT' }),
      applicant({ project_cost: 250_000 }),
    );
    const back = computed(
      scheme({ ...CEILING_CASE.scheme, subsidy_timing: 'BACK' }),
      applicant({ project_cost: 250_000 }),
    );
    expect(front.subsidy).toBe(back.subsidy);
    expect(front.gross_loan).toBe(140_000);
    // 200,000 − 20,000 = 180,000, then clipped by the 80% cap to 160,000.
    expect(back.gross_loan).toBe(180_000);
    expect(back.loan).toBe(160_000);
    expect(back.binding_constraint).toBe('LOAN_PCT_CAP');
    expect(front.loan).toBeLessThan(back.loan);
  });

  it('reports MAX_LOAN when the scheme ceiling on the loan is what binds', () => {
    const figures = computed(
      scheme({ ...CEILING_CASE.scheme, max_loan: 100_000, subsidy_timing: 'FRONT' }),
      applicant({ project_cost: 250_000 }),
    );
    expect(figures.loan).toBe(100_000);
    expect(figures.binding_constraint).toBe('MAX_LOAN');
  });

  it('reports GROSS when several constraints bind at once, as the more informative answer', () => {
    // gross = pct cap = max_loan = 200,000. Ties resolve to the earlier
    // candidate deliberately: "this is all your project needs" explains more
    // than "you hit a cap".
    const figures = computed(
      scheme({ max_unit_cost: 200_000, max_loan: 200_000, loan_pct_cap: 1, margin_pct: 0 }),
      applicant({ project_cost: 200_000 }),
    );
    expect(figures.loan).toBe(200_000);
    expect(figures.binding_constraint).toBe('GROSS');
  });

  it('floors the loan at zero rather than going negative on a 100% margin', () => {
    // A scheme demanding the whole cost as margin is degenerate, but it must
    // produce ₹0 and an empty-looking schedule, not a negative loan or a crash.
    const figures = computed(scheme({ margin_pct: 1 }), applicant());
    expect(figures.own_contribution).toBe(100_000);
    expect(figures.gross_loan).toBe(0);
    expect(figures.loan).toBe(0);
    expect(figures.schedule.emi).toBe(0);
  });

  it('flags a loan below the scheme minimum instead of quietly dropping it', () => {
    const belowMin = computed(scheme({ min_loan: 200_000 }), applicant({ project_cost: 100_000 }));
    expect(belowMin.loan).toBe(100_000);
    expect(belowMin.loan_below_min).toBe(true);
    expect(belowMin.min_loan).toBe(200_000);

    const aboveMin = computed(scheme({ min_loan: 50_000 }), applicant({ project_cost: 100_000 }));
    expect(aboveMin.loan_below_min).toBe(false);
  });
});

describe('the cost ceiling can be purpose-specific', () => {
  const rules: CostCeilingRule[] = [
    {
      applies_when: { purpose: 'STUDY_ABROAD' },
      max_unit_cost: 400_000,
      max_loan: null,
      provenance: FAKE,
    },
  ];

  it('uses the purpose rule and says so', () => {
    const figures = computed(
      scheme({ cost_ceiling_rules: rules, eligible_purposes: ['STUDY_ABROAD', 'SHOP'] }),
      applicant({ purpose: 'STUDY_ABROAD', project_cost: 300_000 }),
    );
    expect(figures.max_unit_cost_applied).toBe(400_000);
    expect(figures.eligible_cost).toBe(300_000);
    expect(figures.cost_ceiling_source).toBe('PURPOSE_RULE');
  });

  it('falls back to the scheme scalar for a purpose with no rule', () => {
    const figures = computed(
      scheme({ cost_ceiling_rules: rules }),
      applicant({ purpose: 'SHOP', project_cost: 300_000 }),
    );
    expect(figures.max_unit_cost_applied).toBe(200_000);
    expect(figures.eligible_cost).toBe(200_000);
    expect(figures.cost_ceiling_source).toBe('SCHEME');
  });

  it('takes only the fields the rule states, leaving max_loan to the scheme', () => {
    // The rule above sets max_unit_cost and leaves max_loan null. A rule that
    // silently zeroed the unstated field would cap every abroad loan at nothing.
    const figures = computed(
      scheme({ cost_ceiling_rules: rules, eligible_purposes: ['STUDY_ABROAD'], loan_pct_cap: 1 }),
      applicant({ purpose: 'STUDY_ABROAD', project_cost: 400_000 }),
    );
    expect(figures.loan).toBe(400_000); // under the scheme's 500,000 max_loan
  });
});

describe('the rate comes from the table, never from a default', () => {
  it('picks the band the sanctioned loan falls into', () => {
    const banded: InterestRule[] = [
      { applies_when: { loan_band_max: 100_000 }, annual_rate_pct: 10, provenance: FAKE },
      { applies_when: { loan_band_min: 100_001 }, annual_rate_pct: 14, provenance: FAKE },
    ];
    const low = computed(scheme({ interest_rules: banded }), applicant({ project_cost: 100_000 }));
    const high = computed(scheme({ interest_rules: banded }), applicant({ project_cost: 150_000 }));
    expect(low.annual_rate_pct).toBe(10);
    expect(high.annual_rate_pct).toBe(14);
  });

  it('prefers the more specific rule when two apply', () => {
    const rules: InterestRule[] = [
      { applies_when: {}, annual_rate_pct: 12, provenance: FAKE },
      { applies_when: { purpose: 'SHOP' }, annual_rate_pct: 6, provenance: FAKE },
    ];
    expect(computed(scheme({ interest_rules: rules }), applicant()).annual_rate_pct).toBe(6);
  });

  it('refuses to price when no rule matches the loan band', () => {
    // The distinction that matters: no rule matched is a data gap, not a 0% loan.
    const result = computeLoan(
      scheme({
        interest_rules: [
          { applies_when: { loan_band_min: 500_000 }, annual_rate_pct: 12, provenance: FAKE },
        ],
      }),
      applicant({ project_cost: 100_000 }),
    );
    expect(result.computable).toBe(false);
    expect(result.computable === false && result.missing).toEqual([
      'scheme.interest_rules[no rule matched this loan band]',
    ]);
  });

  it('refuses to price when the matched rule has no rate yet', () => {
    const result = computeLoan(
      scheme({
        interest_rules: [{ applies_when: {}, annual_rate_pct: null, provenance: FAKE }],
      }),
      applicant(),
    );
    expect(result.computable).toBe(false);
    expect(result.computable === false && result.missing).toEqual([
      'scheme.interest_rules[matched].annual_rate_pct',
    ]);
  });

  it('carries the rate’s provenance onto the result, so the UI can badge it', () => {
    const figures = computed(scheme(), applicant());
    expect(figures.rate_provenance.source).toBe('fabricated');
    expect(figures.rate_provenance.verified).toBe(false);
  });
});

describe('terms — the ROADMAP §8.1 open question, made visible', () => {
  it('subtracts the moratorium from the tenure when the tenure includes it', () => {
    const figures = computed(
      scheme({
        tenure_months_max: 60,
        tenure_includes_moratorium: true,
        moratorium_months_min: 0,
        moratorium_months_max: 12,
      }),
      applicant({ requested_moratorium_months: 6 }),
    );
    expect(figures.moratorium_months).toBe(6);
    expect(figures.repayment_months).toBe(54);
    expect(figures.tenure_months_total).toBe(60);
    expect(figures.schedule.rows).toHaveLength(60);
  });

  it('adds the moratorium to the tenure when the tenure excludes it', () => {
    // Same scheme, same request, one boolean different: six more instalments and
    // a longer total. This is why the field cannot be guessed.
    const figures = computed(
      scheme({ tenure_months_max: 60, tenure_includes_moratorium: false }),
      applicant({ requested_moratorium_months: 6 }),
    );
    expect(figures.repayment_months).toBe(60);
    expect(figures.tenure_months_total).toBe(66);
    expect(figures.schedule.rows).toHaveLength(66);
  });

  it('refuses to guess when the scheme does not say which reading applies', () => {
    const result = computeLoan(scheme({ tenure_includes_moratorium: null }), applicant());
    expect(result.computable).toBe(false);
    expect(result.computable === false && result.missing).toContain(
      'scheme.tenure_includes_moratorium',
    );
  });

  it('reports a contradiction that leaves no instalments as a diagnostic, not a crash', () => {
    const result = computeLoan(
      scheme({
        tenure_months_max: 6,
        tenure_includes_moratorium: true,
        moratorium_months_min: 6,
        moratorium_months_max: 6,
      }),
      applicant({ requested_moratorium_months: 6 }),
    );
    expect(result.computable).toBe(false);
    expect(result.computable === false && result.missing).toEqual([
      'derived.repayment_months_below_one',
    ]);
  });

  it('clamps the requested moratorium into the scheme’s range', () => {
    const bounded = { moratorium_months_min: 3, moratorium_months_max: 12 };
    expect(
      computed(scheme(bounded), applicant({ requested_moratorium_months: 24 })).moratorium_months,
    ).toBe(12);
    expect(
      computed(scheme(bounded), applicant({ requested_moratorium_months: 0 })).moratorium_months,
    ).toBe(3);
  });

  it('falls back to the scheme pre-fill, then to the minimum, when nothing is requested', () => {
    const withDefault = computed(
      scheme({ moratorium_months_min: 3, moratorium_months_max: 12, moratorium_months_default: 6 }),
      applicant({ requested_moratorium_months: null }),
    );
    expect(withDefault.moratorium_months).toBe(6);

    const withoutDefault = computed(
      scheme({ moratorium_months_min: 3, moratorium_months_max: 12 }),
      applicant({ requested_moratorium_months: null }),
    );
    expect(withoutDefault.moratorium_months).toBe(3);
  });

  it('honours a requested tenure shorter than the scheme maximum', () => {
    const figures = computed(scheme(), applicant({ requested_tenure_months: 24 }));
    expect(figures.repayment_months).toBe(24);
  });
});

describe('the moratorium treatment is a scheme field, and it changes the money', () => {
  const base = { tenure_months_max: 60, moratorium_months_min: 0, moratorium_months_max: 12 };
  const who = applicant({ project_cost: 100_000, requested_moratorium_months: 6 });

  it('produces a higher EMI when interest is capitalised than when it is waived', () => {
    const capitalised = computed(
      scheme({ ...base, moratorium_interest_treatment: 'CAPITALISED' }),
      who,
    );
    const waived = computed(scheme({ ...base, moratorium_interest_treatment: 'WAIVED' }), who);
    const serviced = computed(scheme({ ...base, moratorium_interest_treatment: 'SERVICED' }), who);

    expect(capitalised.schedule.emi).toBeGreaterThan(waived.schedule.emi);
    // SERVICED and WAIVED amortise the same principal, so they share an EMI and
    // differ only in the interest paid during the moratorium.
    expect(serviced.schedule.emi).toBe(waived.schedule.emi);
    expect(serviced.schedule.totals.total_outflow).toBeGreaterThan(
      waived.schedule.totals.total_outflow,
    );
  });

  it('delegates entirely to amortise() rather than doing its own arithmetic', () => {
    // The strongest available statement that there is one amortisation
    // implementation: the schedule computeLoan returns must be bit-identical to
    // calling amortise directly with the inputs computeLoan reports.
    const figures = computed(
      scheme({ ...base, moratorium_interest_treatment: 'CAPITALISED' }),
      who,
    );
    const direct = amortise({
      principal: figures.loan,
      monthlyRate: monthlyRateFromAnnualPct(figures.annual_rate_pct),
      repaymentMonths: figures.repayment_months,
      moratoriumMonths: figures.moratorium_months,
      treatment: 'CAPITALISED',
      annualRatePct: figures.annual_rate_pct,
    });
    expect(figures.schedule).toEqual(direct);
  });
});

describe('refusing to compute — the branch no persona reaches', () => {
  it('reports every gap in one pass, not the first one it hits', () => {
    // An applicant told to fix one field at a time, five times, gives up. The
    // list is also what VERIFY.md is built from.
    const result = computeLoan(
      scheme({
        max_unit_cost: null,
        max_loan: null,
        loan_pct_cap: null,
        margin_pct: null,
        subsidy_pct: null,
        moratorium_interest_treatment: null,
        moratorium_months_min: null,
        moratorium_months_max: null,
        tenure_months_max: null,
        tenure_includes_moratorium: null,
      }),
      applicant({ project_cost: null }),
    );
    expect(result.computable).toBe(false);
    expect(result.computable === false && [...result.missing].sort()).toEqual([
      'applicant.project_cost',
      'scheme.loan_pct_cap',
      'scheme.margin_pct',
      'scheme.max_loan',
      'scheme.max_unit_cost',
      'scheme.moratorium_interest_treatment',
      'scheme.moratorium_months_max',
      'scheme.moratorium_months_min',
      'scheme.subsidy_pct',
      'scheme.tenure_includes_moratorium',
      'scheme.tenure_months_max',
    ]);
  });

  it('does not repeat a path', () => {
    const result = computeLoan(
      scheme({ max_unit_cost: null, max_loan: null }),
      applicant({ project_cost: null }),
    );
    expect(result.computable).toBe(false);
    if (result.computable) return;
    expect(new Set(result.missing).size).toBe(result.missing.length);
  });

  it('names every gap in a way the UI can render — hard rule 3', () => {
    const gapCases = [
      computeLoan(scheme({ max_unit_cost: null }), applicant()),
      computeLoan(scheme({ margin_pct: null }), applicant()),
      computeLoan(scheme({ subsidy_pct: 0.25, subsidy_cap: null }), applicant()),
      computeLoan(scheme({ tenure_includes_moratorium: null }), applicant()),
      computeLoan(scheme(), applicant({ project_cost: null })),
      computeLoan(
        scheme({
          tenure_months_max: 6,
          tenure_includes_moratorium: true,
          moratorium_months_min: 6,
          moratorium_months_max: 6,
        }),
        applicant({ requested_moratorium_months: 6 }),
      ),
    ];
    const unnamed: string[] = [];
    for (const result of gapCases) {
      expect(result.computable).toBe(false);
      if (result.computable) continue;
      for (const path of result.missing) {
        if (!hasMessage(`field.${path}`)) unnamed.push(path);
      }
    }
    expect(unnamed).toEqual([]);
  });

  it('demands the subsidy cap and timing only when a subsidy actually exists', () => {
    // Blocking a scheme on a figure that cannot affect the answer is a
    // self-inflicted gap. With subsidy_pct 0, cap and timing are irrelevant.
    const noSubsidy = computed(
      scheme({ subsidy_pct: 0, subsidy_cap: null, subsidy_timing: null }),
      applicant(),
    );
    expect(noSubsidy.subsidy).toBe(0);

    const withSubsidy = computeLoan(
      scheme({ subsidy_pct: 0.25, subsidy_cap: null, subsidy_timing: null }),
      applicant(),
    );
    expect(withSubsidy.computable).toBe(false);
    expect(withSubsidy.computable === false && [...withSubsidy.missing].sort()).toEqual([
      'scheme.subsidy_cap',
      'scheme.subsidy_timing',
    ]);
  });

  it('carries no figures at all on the refusing branch', () => {
    // The discriminated union is what stops a half-computed number reaching a
    // screen. Confirm the shape has nothing else on it to read by accident.
    const result = computeLoan(scheme({ margin_pct: null }), applicant());
    expect(result.computable).toBe(false);
    expect(Object.keys(result).sort()).toEqual(['computable', 'missing']);
  });
});

describe('rounding and reconciliation', () => {
  it('reports whole rupees that add up on screen', () => {
    // Every money field is rounded, and the next step consumes the rounded
    // value, so the columns a user reads reconcile exactly. See the note in
    // loan.ts on why this departs from "round only at the end".
    const figures = computed(
      scheme({ margin_pct: 0.075, subsidy_pct: 0.1, subsidy_cap: 50_000, subsidy_timing: 'FRONT' }),
      applicant({ project_cost: 100_000.5 }),
    );
    for (const value of [
      figures.project_cost,
      figures.eligible_cost,
      figures.subsidy,
      figures.own_contribution,
      figures.gross_loan,
      figures.loan,
      figures.schedule.emi,
    ]) {
      expect(Number.isInteger(value)).toBe(true);
    }
    expect(figures.eligible_cost).toBe(100_001); // half-up, per rounding.ts
    expect(figures.eligible_cost - figures.own_contribution - figures.subsidy).toBe(
      figures.gross_loan,
    );
  });

  it('does not round the rate', () => {
    const figures = computed(
      scheme({ interest_rules: [{ applies_when: {}, annual_rate_pct: 8.35, provenance: FAKE }] }),
      applicant(),
    );
    expect(figures.annual_rate_pct).toBe(8.35);
  });
});

describe('purity', () => {
  it('returns a deeply equal result for the same input twice', () => {
    const s = scheme(CEILING_CASE.scheme);
    const a = applicant({ project_cost: 250_000 });
    expect(computeLoan(s, a)).toEqual(computeLoan(s, a));
  });

  it('mutates neither the scheme nor the applicant', () => {
    const s = scheme(CEILING_CASE.scheme);
    const a = applicant({ project_cost: 250_000 });
    const schemeBefore = JSON.stringify(s);
    const applicantBefore = JSON.stringify(a);
    computeLoan(s, a);
    expect(JSON.stringify(s)).toBe(schemeBefore);
    expect(JSON.stringify(a)).toBe(applicantBefore);
  });
});
