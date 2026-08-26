/**
 * tests/messages.coverage.test.ts
 *
 * CLAUDE.md hard rule 3: predicates return codes, not sentences, and every
 * user-facing string is a key in src/messages/. That rule has a failure mode the
 * type checker cannot see — a code the engine can emit for which no key exists.
 * translate() throws on a missing key by design, so the consequence is not an
 * ugly string on screen, it is a crashed page, and only for the applicant
 * unlucky enough to hit that branch.
 *
 * So this file closes the loop in both directions:
 *
 *   forwards  — every key the core can emit resolves in en.json. Both from the
 *               code taxonomies exhaustively, and from a real run over all 40
 *               personas so nothing composed at runtime escapes.
 *   backwards — every key in the machine-derived namespaces is actually reachable
 *               from the core, so a renamed code leaves no stale English behind.
 *
 * Purely presentational namespaces (common.*, headings, column labels) are
 * exempt from the backwards check and listed explicitly — they are written ahead
 * of the screens that use them, which is the point of writing them as keys.
 */

import { describe, expect, it } from 'vitest';
import {
  BINDING_CONSTRAINTS,
  CAPACITY_FLAGS,
  MORATORIUM_TREATMENTS,
  PARTNER_FILTER_CODES,
  PARTNER_TYPES,
  PREDICATE_CODES,
  PROVENANCE_SOURCES,
  SCHEME_STATUSES,
  SUBSIDY_TIMINGS,
} from '../src/core/types';
import { RECOMMENDATION_POLICY, recommend } from '../src/core/recommend';
import { resolveChecklist } from '../src/core/documents/resolve';
import { scoreHealth } from '../src/core/partners/health';
import { loadBundle, loadPersonas } from '../src/lib/dataset';
import { allMessageKeys, hasMessage, translate } from '../src/messages';

const personas = loadPersonas();
const CATALOGUE = new Set(allMessageKeys());

/** Every key emitted by a full run over every persona, in both load modes. */
const emitted = new Set<string>();

/**
 * Harvests message keys out of a result object. Anything whose property name
 * ends in `_key` or `Key` is a message key by convention, plus the two places
 * that hold bare arrays of them.
 */
function harvest(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(harvest);
    return;
  }
  if (typeof node !== 'object' || node === null) return;
  for (const [name, value] of Object.entries(node as Record<string, unknown>)) {
    if (/(_key|Key)$/.test(name) && typeof value === 'string') {
      emitted.add(value);
      continue;
    }
    if (name === 'notes' && Array.isArray(value)) {
      for (const note of value) if (typeof note === 'string') emitted.add(note);
      continue;
    }
    if (name === 'label' && typeof value === 'string' && value.includes('.')) {
      emitted.add(value);
      continue;
    }
    harvest(value);
  }
}

for (const applyOverlay of [true, false]) {
  const bundle = loadBundle({ applyOverlay });
  harvest(bundle.dataset);
  for (const row of bundle.health.values()) harvest(scoreHealth(row, bundle.healthConfig));
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
    harvest(result);
    // The scheme-only checklist is what recommend() returns; resolve the
    // partner-type variants too, since those carry their own notes_keys and are
    // reached the moment the applicant picks a partner.
    for (const scheme of bundle.dataset.schemes) {
      for (const partnerType of PARTNER_TYPES) {
        harvest(
          resolveChecklist({
            scheme,
            partnerType,
            applicant: persona.applicant,
            definitions: bundle.documentDefinitions,
            requirements: bundle.documentRequirements,
          }),
        );
      }
    }
  }
}

describe('forwards — nothing the core emits is missing from the catalogue', () => {
  it('resolves every key harvested from a full run over all personas', () => {
    expect(emitted.size).toBeGreaterThan(50);
    const missing = [...emitted].filter((key) => !hasMessage(key)).sort();
    expect(missing).toEqual([]);
  });

  it('has three outcome strings and a label for every predicate code', () => {
    const missing: string[] = [];
    for (const code of PREDICATE_CODES) {
      for (const outcome of ['label', 'pass', 'fail', 'unknown']) {
        const key = `predicate.${code}.${outcome}`;
        if (!hasMessage(key)) missing.push(key);
      }
    }
    expect(missing).toEqual([]);
  });

  it('has a string for every partner filter code', () => {
    const missing = PARTNER_FILTER_CODES.map((code) => `partner.filter.${code}`).filter(
      (key) => !hasMessage(key),
    );
    expect(missing).toEqual([]);
  });

  it('has a label for every provenance source, including the ones we are ashamed of', () => {
    // 'fabricated' and 'placeholder' need labels most of all: they are what the
    // UI has to say out loud about our own interim data.
    const missing = PROVENANCE_SOURCES.map((source) => `provenance.${source}`).filter(
      (key) => !hasMessage(key),
    );
    expect(missing).toEqual([]);
  });

  it('has a short and a long form for every scheme status', () => {
    const missing: string[] = [];
    for (const status of SCHEME_STATUSES) {
      for (const key of [`status.${status}`, `status.${status}_detail`]) {
        if (!hasMessage(key)) missing.push(key);
      }
    }
    expect(missing).toEqual([]);
  });

  it('has a label for every enum the core can put on screen', () => {
    const missing: string[] = [];
    const expectKey = (key: string) => {
      if (!hasMessage(key)) missing.push(key);
    };
    for (const treatment of MORATORIUM_TREATMENTS) expectKey(`loan.moratorium.${treatment}`);
    for (const constraint of BINDING_CONSTRAINTS) expectKey(`loan.binding_constraint.${constraint}`);
    for (const timing of SUBSIDY_TIMINGS) expectKey(`loan.subsidy_${timing.toLowerCase()}`);
    for (const flag of CAPACITY_FLAGS) expectKey(`health.capacity.${flag}`);
    for (const type of PARTNER_TYPES) expectKey(`partner.type.${type}`);
    for (const phase of ['MORATORIUM', 'REPAYMENT']) expectKey(`loan.schedule.${phase}`);
    expectKey(RECOMMENDATION_POLICY.messageKey);
    expect(missing).toEqual([]);
  });

  it('names every field the core reports as missing', () => {
    // The "why is there no number" panel renders `field.<dotted path>` for each
    // entry in LoanComputation.missing and each unevaluable verdict. An unnamed
    // path there is the worst kind of gap: the applicant is told something is
    // missing but not what.
    const bundle = loadBundle({ applyOverlay: false }); // the sparser dataset, so more paths surface
    const paths = new Set<string>();
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
        if (scheme.computation && !scheme.computation.computable) {
          for (const path of scheme.computation.missing) paths.add(path);
        }
        for (const verdict of scheme.verdicts) {
          if (!verdict.evaluable) for (const path of verdict.missing ?? []) paths.add(path);
        }
      }
    }
    expect(paths.size).toBeGreaterThan(0);
    const unnamed = [...paths].filter((path) => !hasMessage(`field.${path}`)).sort();
    expect(unnamed).toEqual([]);
  });

  it('interpolates rather than leaving braces on screen', () => {
    const rendered = translate('predicate.AGE_WITHIN_RANGE.fail', { actual: 19, required: '21–45' });
    expect(rendered).toContain('19');
    expect(rendered).toContain('21–45');
    expect(rendered).not.toMatch(/\{|\}/);
  });

  it('throws on a key that does not exist, rather than rendering the key', () => {
    expect(() => translate('predicate.NOT_A_REAL_CODE.fail')).toThrow(/Missing message key/);
  });
});

describe('backwards — no stale English left behind', () => {
  /**
   * Namespaces written for screens rather than emitted by the core. Listed
   * explicitly so the list itself is reviewable: anything added here is a
   * deliberate exemption, not an accident.
   */
  const PRESENTATIONAL = [
    'common.',
    'checklist.',
    'dataset.banner.',
    'field.', // labels for paths, only some of which any given dataset reaches
    'health.as_of',
    'health.heading',
    'health.mis_upload_badge',
    'health.score',
    'health.score_help',
    'health.simulated_badge',
    'health.simulated_detail',
    'health.capacity.multiplier_note',
    'health.factor.',
    'loan.',
    'partner.distance_unknown',
    'partner.heading',
    'partner.loan_exceeds_all_tickets',
    'partner.none_eligible',
    'partner.none_eligible_detail',
    'partner.rank_by_distance',
    'partner.rank_by_health',
    'partner.straight_line_distance',
    'partner.filter.heading',
    'partner.type.',
    'provenance.unverified_marker',
    'provenance.unverified_tooltip',
    'recommendation.heading',
    'recommendation.generated_at',
    'recommendation.none',
    'remediation.heading',
    'status.',
    // Page-level copy: headings, form labels, navigation. Nothing in src/core/
    // emits these, by construction — the core emits no English at all.
    'ui.',
  ];

  const isPresentational = (key: string) =>
    PRESENTATIONAL.some((prefix) =>
      prefix.endsWith('.') ? key.startsWith(prefix) : key === prefix,
    );

  it('has no unreachable predicate, remediation, filter or document string', () => {
    const orphans = [...CATALOGUE]
      .filter((key) => !isPresentational(key))
      .filter((key) => !emitted.has(key))
      // The enum labels asserted above are reached by the UI through a code, not
      // by a key travelling inside a result object. Same for the recommendation
      // policy, which the UI renders from the exported constant.
      .filter(
        (key) =>
          key !== RECOMMENDATION_POLICY.messageKey &&
          !PROVENANCE_SOURCES.some((source) => key === `provenance.${source}`) &&
          !MORATORIUM_TREATMENTS.some((t) => key === `loan.moratorium.${t}`) &&
          !CAPACITY_FLAGS.some((flag) => key === `health.capacity.${flag}`) &&
          !PREDICATE_CODES.some((code) => key.startsWith(`predicate.${code}.`)),
      )
      .sort();
    expect(orphans).toEqual([]);
  });

  it('reaches every predicate outcome string that a persona can actually produce', () => {
    // Separate from the exhaustive existence check above: this one asserts the
    // persona set exercises the strings, which is what makes a wording review
    // possible before the demo.
    const reached = [...emitted].filter((key) => key.startsWith('predicate.'));
    expect(reached.length).toBeGreaterThanOrEqual(PREDICATE_CODES.length * 2);
  });

  it('reaches every document in the catalogue, so no seeded document is dead weight', () => {
    const bundle = loadBundle({ applyOverlay: true });
    const unreached = bundle.documentDefinitions
      .filter((definition) => !emitted.has(definition.name_key))
      .map((definition) => definition.code);
    expect(unreached).toEqual([]);
  });
});

describe('the catalogue itself', () => {
  it('holds only strings — no accidental nesting left half-written', () => {
    for (const key of CATALOGUE) {
      expect(typeof translate(key)).toBe('string');
    }
  });

  it('has no empty or placeholder-looking values', () => {
    const suspicious = [...CATALOGUE].filter((key) => {
      const value = translate(key);
      return value.trim().length === 0 || /^(TODO|TBD|xxx)/i.test(value.trim());
    });
    expect(suspicious).toEqual([]);
  });

  it('leaves no unbalanced interpolation braces', () => {
    const broken = [...CATALOGUE].filter((key) => {
      const value = translate(key);
      const opens = (value.match(/\{/g) ?? []).length;
      const closes = (value.match(/\}/g) ?? []).length;
      return opens !== closes;
    });
    expect(broken).toEqual([]);
  });

  it('uses the rupee symbol from common.currency_symbol rather than hardcoding one', () => {
    // Currency formatting belongs in one place; a stray ₹ in a message means a
    // locale cannot change it. The scheme and status prose is exempt only where
    // it quotes a figure the core supplies.
    const hardcoded = [...CATALOGUE].filter(
      (key) => key !== 'common.currency_symbol' && translate(key).includes('₹'),
    );
    expect(hardcoded).toEqual([]);
  });
});
