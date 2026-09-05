/**
 * tests/eligibility.age-format.test.ts
 *
 * FRAGILE.md A3 — the age band's invisible format coupling.
 *
 * src/core/eligibility/predicates.ts:132 writes the band as `${min}-${max}`
 * and src/core/eligibility/remediation.ts:94 parses it with `split('-').map(Number)`.
 * Two files agreeing on a text format with nothing pinning it down — changing the
 * format on one side silently degrades the "what to do" message with no failing
 * test. This file pins the format.
 *
 * If this test fails, you changed how the band is written or parsed. Update
 * BOTH files and this test together — do not just update the test to make it
 * green (see FRAGILE.md Part B).
 */

import { describe, expect, it } from 'vitest';
import { ageWithinRange } from '../src/core/eligibility/predicates';
import { remediate } from '../src/core/eligibility/remediation';
import type { GlobalEligibility, ApplicantProfile } from '../src/core/types';

function makeGlobal(ageMin: number | null, ageMax: number | null): GlobalEligibility {
  return {
    annual_family_income_cap: 500000,
    category_requirement: 'SC',
    age_min: ageMin,
    age_max: ageMax,
    provenance: {},
    verified: false,
  };
}

function makeApplicant(age: number | null): ApplicantProfile {
  return {
    age,
    gender: 'UNDISCLOSED',
    category: 'SC',
    annual_family_income: 100000,
    state: 'MH',
    district: 'Mumbai',
    lat: null,
    lng: null,
    intent: 'LIVELIHOOD',
    purpose: 'tailoring',
    project_cost: 50000,
    documents_available: ['CASTE_CERT', 'INCOME_CERT'],
    preferred_language: 'en',
  };
}

const dummyScheme = {} as unknown as import('../src/core/types').SchemeSpec;

describe('AGE_WITHIN_RANGE format coupling — FRAGILE A3', () => {
  it('writes required as "min-max" with hyphen, no spaces, integers', () => {
    const global = makeGlobal(18, 60);
    const verdict = ageWithinRange({
      applicant: makeApplicant(25),
      scheme: dummyScheme,
      global,
    });
    expect(verdict.required).toBe('18-60');
    expect(verdict.required).toMatch(/^\d+-\d+$/);
  });

  it('uses the same format when applicant age is null (unknown verdict)', () => {
    const global = makeGlobal(18, 60);
    const verdict = ageWithinRange({
      applicant: makeApplicant(null),
      scheme: dummyScheme,
      global,
    });
    expect(verdict.evaluable).toBe(false);
    expect(verdict.required).toBe('18-60');
  });

  it('remediation parses too_young via the band string (delta = min - age)', () => {
    const global = makeGlobal(18, 60);
    const verdict = ageWithinRange({
      applicant: makeApplicant(16),
      scheme: dummyScheme,
      global,
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.required).toBe('18-60');
    const r = remediate(verdict)!;
    expect(r.kind).toBe('INCREASE_NUMERIC');
    expect(r.messageKey).toBe('remediation.AGE_WITHIN_RANGE.too_young');
    expect(r.target).toBe(18);
    expect(r.delta).toBe(2); // 18 - 16
  });

  it('remediation parses too_old via the band string (target = max)', () => {
    const global = makeGlobal(18, 60);
    const verdict = ageWithinRange({
      applicant: makeApplicant(70),
      scheme: dummyScheme,
      global,
    });
    expect(verdict.passed).toBe(false);
    expect(verdict.required).toBe('18-60');
    const r = remediate(verdict)!;
    // 70 is above max, so remediation is NOT_REMEDIABLE with max as target
    expect(r.kind).toBe('NOT_REMEDIABLE');
    expect(r.messageKey).toBe('remediation.AGE_WITHIN_RANGE.too_old');
    expect(r.target).toBe(60);
  });

  it('works with different bounds (21-65)', () => {
    const global = makeGlobal(21, 65);
    const verdict = ageWithinRange({
      applicant: makeApplicant(21),
      scheme: dummyScheme,
      global,
    });
    expect(verdict.required).toBe('21-65');
    expect(verdict.passed).toBe(true);
  });

  it('fails visibly if required contains spaces or other separators', () => {
    // This test documents the contract: if predicates.ts ever emits "18 - 60"
    // or "18 to 60", this will fail, and remediation.ts:94 will silently parse
    // NaN. The fix is to keep the hyphen format on both sides.
    const global = makeGlobal(18, 60);
    const verdict = ageWithinRange({
      applicant: makeApplicant(16),
      scheme: dummyScheme,
      global,
    });
    expect(String(verdict.required)).not.toMatch(/\s/);
    expect(String(verdict.required).split('-')).toHaveLength(2);
  });
});
