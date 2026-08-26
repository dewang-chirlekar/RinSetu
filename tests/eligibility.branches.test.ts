/**
 * tests/eligibility.branches.test.ts
 *
 * CLAUDE.md hard rule 4 — "keep failures" — is only meaningful if every failure
 * we claim to produce is actually reachable. This file proves that:
 *
 *   1. every PredicateCode fires, and fires in all three of its states
 *      (pass / fail / unevaluable) wherever the data can produce them;
 *   2. every failing verdict carries a remediation, so no screen can show a
 *      dead end;
 *   3. the status precedence is what it claims to be — a broken rule outranks
 *      an unevaluable one;
 *   4. verdicts are returned for ALL schemes, not just the winning one.
 *
 * The 40 personas in data/personas.fixtures.json are the source of coverage.
 * Where a state is unreachable from any persona, the test says so out loud
 * rather than skipping it silently, and the reason is recorded in the fixture
 * file's `known_gaps_in_this_file`.
 */

import { describe, expect, it } from 'vitest';
import { evaluateAllSchemes, evaluateScheme } from '../src/core/eligibility/engine';
import { remediate, remediateAll } from '../src/core/eligibility/remediation';
import { recommend } from '../src/core/recommend';
import { PREDICATE_CODES, type PredicateCode, type Verdict } from '../src/core/types';
import { loadBundle, loadPersonas } from '../src/lib/dataset';
import { hasMessage } from '../src/messages';

const bundle = loadBundle({ applyOverlay: true });
const personas = loadPersonas();

/** Every verdict produced by every persona against every scheme. */
const allVerdicts: Array<{ personaId: string; schemeCode: string; verdict: Verdict }> = [];
for (const persona of personas) {
  const evaluations = evaluateAllSchemes(
    bundle.dataset.schemes,
    persona.applicant,
    bundle.dataset.global,
  );
  for (const evaluation of evaluations) {
    for (const verdict of evaluation.verdicts) {
      allVerdicts.push({ personaId: persona.id, schemeCode: evaluation.scheme_code, verdict });
    }
  }
}

function verdictsFor(code: PredicateCode) {
  return allVerdicts.filter((entry) => entry.verdict.code === code);
}

describe('the persona set exercises every predicate', () => {
  it('produces at least one verdict for all 40 personas', () => {
    expect(personas).toHaveLength(40);
    expect(new Set(allVerdicts.map((entry) => entry.personaId)).size).toBe(40);
  });

  it.each(PREDICATE_CODES)('%s is evaluated by at least one persona', (code) => {
    expect(verdictsFor(code).length).toBeGreaterThan(0);
  });

  it.each(PREDICATE_CODES)('%s passes for at least one persona', (code) => {
    expect(verdictsFor(code).some((entry) => entry.verdict.passed)).toBe(true);
  });

  it.each(PREDICATE_CODES)('%s fails for at least one persona', (code) => {
    const failures = verdictsFor(code).filter(
      (entry) => entry.verdict.evaluable && !entry.verdict.passed,
    );
    expect(
      failures.length,
      `No persona makes ${code} fail. Add one, or the failure path and its remediation ship untested.`,
    ).toBeGreaterThan(0);
  });

  it('reaches the unevaluable state on every predicate that can have one', () => {
    // Eight of the ten predicates reach it. The two that do not are
    // CASTE_CERT_AVAILABLE and INCOME_PROOF_AVAILABLE, and that is correct
    // rather than a coverage gap: a document is either in the applicant's list
    // or it is not, so there is no honest third state to reach. Every predicate
    // that reads a nullable field does reach it.
    const unevaluable = new Set(
      allVerdicts.filter((entry) => !entry.verdict.evaluable).map((entry) => entry.verdict.code),
    );
    expect([...unevaluable].sort()).toMatchInlineSnapshot(`
      [
        "ADMISSION_CONFIRMED",
        "AGE_WITHIN_RANGE",
        "CATEGORY_SC",
        "COURSE_ELIGIBLE",
        "INCOME_WITHIN_CAP",
        "PROJECT_COST_ABOVE_MICRO_FLOOR",
        "PROJECT_COST_WITHIN_UNIT_COST",
        "PURPOSE_ELIGIBLE",
      ]
    `);
    const documentPredicates: PredicateCode[] = ['CASTE_CERT_AVAILABLE', 'INCOME_PROOF_AVAILABLE'];
    for (const code of documentPredicates) {
      expect(verdictsFor(code).every((entry) => entry.verdict.evaluable)).toBe(true);
    }
  });
});

describe('verdict shape — hard rule 3, codes not sentences', () => {
  it('never carries a human-readable sentence, only a message key', () => {
    for (const { verdict } of allVerdicts) {
      expect(verdict.messageKey).toMatch(/^predicate\.[A-Z_]+\.(pass|fail|unknown)$/);
      // A space in the key means someone wrote prose where a key belongs.
      expect(verdict.messageKey).not.toMatch(/\s/);
    }
  });

  it('emits only message keys that exist in the catalogue', () => {
    const missing = new Set<string>();
    for (const { verdict } of allVerdicts) {
      if (!hasMessage(verdict.messageKey)) missing.add(verdict.messageKey);
    }
    expect([...missing]).toEqual([]);
  });

  it('names the missing data path whenever it cannot decide', () => {
    for (const { verdict, personaId, schemeCode } of allVerdicts) {
      if (verdict.evaluable) continue;
      expect(
        verdict.missing?.length ?? 0,
        `${personaId}/${schemeCode}: ${verdict.code} is unevaluable but names no missing field, so the UI cannot ask for anything.`,
      ).toBeGreaterThan(0);
      for (const path of verdict.missing ?? []) {
        expect(path).toMatch(/^(applicant|scheme|global)\./);
      }
    }
  });

  it('never reports a passed verdict as unevaluable', () => {
    for (const { verdict } of allVerdicts) {
      if (!verdict.evaluable) expect(verdict.passed).toBe(false);
    }
  });
});

describe('every failure has a way forward — hard rule 4', () => {
  it('produces a remediation for each failing verdict, or is a documented exception', () => {
    // CATEGORY_SC is not remediable: a person cannot change their category, and
    // pretending otherwise would be offensive. It still returns a remediation,
    // whose kind says NOT_REMEDIABLE, so the UI has something honest to render.
    const unremediated: string[] = [];
    for (const { verdict, personaId, schemeCode } of allVerdicts) {
      if (verdict.evaluable && !verdict.passed && remediate(verdict) === null) {
        unremediated.push(`${personaId}/${schemeCode}/${verdict.code}`);
      }
    }
    expect(unremediated).toEqual([]);
  });

  it('gives every remediation a message key that exists', () => {
    const missing = new Set<string>();
    for (const { verdict } of allVerdicts) {
      const remediation = remediate(verdict);
      if (remediation && !hasMessage(remediation.messageKey)) missing.add(remediation.messageKey);
    }
    expect([...missing]).toEqual([]);
  });

  it('remediates unevaluable verdicts by asking for the data, not by guessing', () => {
    const unevaluable = allVerdicts.find(({ verdict }) => !verdict.evaluable);
    expect(unevaluable).toBeDefined();
    const remediation = remediate(unevaluable!.verdict);
    expect(remediation).not.toBeNull();
    expect(remediation!.kind).toBe('PROVIDE_DATA');
  });

  it('returns one remediation per failing verdict and none for passes', () => {
    for (const persona of personas) {
      for (const evaluation of evaluateAllSchemes(
        bundle.dataset.schemes,
        persona.applicant,
        bundle.dataset.global,
      )) {
        const needing = evaluation.verdicts.filter((v) => !v.passed);
        expect(remediateAll(evaluation.verdicts)).toHaveLength(needing.length);
      }
    }
  });
});

describe('status precedence — a broken rule outranks an unevaluable one', () => {
  const micro = bundle.dataset.schemes.find((scheme) => scheme.code === 'MICRO')!;

  it('is ELIGIBLE only when every rule passed', () => {
    const evaluation = evaluateScheme(
      micro,
      personas.find((p) => p.id === 'P01')!.applicant,
      bundle.dataset.global,
    );
    expect(evaluation.status).toBe('ELIGIBLE');
    expect(evaluation.verdicts.every((v) => v.passed && v.evaluable)).toBe(true);
    expect(evaluation.blocking_gaps).toEqual([]);
  });

  it('is INDETERMINATE when something is unknown and nothing is broken', () => {
    // P18 holds the income certificate but has not stated the amount.
    const evaluation = evaluateScheme(
      micro,
      personas.find((p) => p.id === 'P18')!.applicant,
      bundle.dataset.global,
    );
    expect(evaluation.status).toBe('INDETERMINATE');
    expect(evaluation.verdicts.some((v) => !v.evaluable)).toBe(true);
    expect(evaluation.verdicts.some((v) => v.evaluable && !v.passed)).toBe(false);
    expect(evaluation.blocking_gaps).toContain('applicant.annual_family_income');
  });

  it('is NOT_ELIGIBLE when a rule is broken, even if others are unknown', () => {
    // Same applicant as above, minus the income certificate: now one rule is
    // definitively broken, so the honest answer is a rejection with a reason
    // rather than "we are not sure".
    const applicant = {
      ...personas.find((p) => p.id === 'P18')!.applicant,
      documents_available: ['CASTE_CERT', 'AADHAAR'],
    };
    const evaluation = evaluateScheme(micro, applicant, bundle.dataset.global);
    expect(evaluation.status).toBe('NOT_ELIGIBLE');
    expect(evaluation.verdicts.some((v) => !v.evaluable)).toBe(true);
    expect(evaluation.verdicts.some((v) => v.evaluable && !v.passed)).toBe(true);
  });
});

describe('all schemes are always reported — hard rule 4', () => {
  it('returns a verdict block for every scheme in the dataset, for every persona', () => {
    const codes = bundle.dataset.schemes.map((scheme) => scheme.code);
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
      expect(result.schemes.map((s) => s.scheme_code)).toEqual(codes);
      for (const scheme of result.schemes) {
        expect(scheme.verdicts.length).toBeGreaterThan(0);
      }
    }
  });

  it('never leaves a rejected applicant with no explanation at all', () => {
    const rejected = personas.filter((persona) => {
      const evaluations = evaluateAllSchemes(
        bundle.dataset.schemes,
        persona.applicant,
        bundle.dataset.global,
      );
      return evaluations.every((e) => e.status === 'NOT_ELIGIBLE');
    });
    // The negative case is a headline feature, so there must be some.
    expect(rejected.length).toBeGreaterThan(0);
    for (const persona of rejected) {
      for (const evaluation of evaluateAllSchemes(
        bundle.dataset.schemes,
        persona.applicant,
        bundle.dataset.global,
      )) {
        const failing = evaluation.verdicts.filter((v) => v.evaluable && !v.passed);
        expect(
          failing.length,
          `${persona.id} is NOT_ELIGIBLE for ${evaluation.scheme_code} with no failing rule to point at.`,
        ).toBeGreaterThan(0);
        expect(remediateAll(evaluation.verdicts).length).toBeGreaterThan(0);
      }
    }
  });
});
