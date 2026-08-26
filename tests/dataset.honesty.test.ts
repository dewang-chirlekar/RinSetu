/**
 * tests/dataset.honesty.test.ts
 *
 * CLAUDE.md invariant 2 — every figure carries provenance — is the invariant a
 * demo is most likely to erode. It only takes one convenient default, one
 * hand-set `verified: true`, or one overlay value that forgets to announce
 * itself, and the project starts quoting numbers it cannot defend.
 *
 * So this file tests the loader adversarially. The question it asks is not "does
 * the loader work" but "can the loader be made to claim authority it does not
 * have". Every assertion here is a lock on the answer being no.
 */

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  PROVENANCE_SOURCES,
  isCitable,
  type FieldProvenance,
  type ProvenanceSource,
} from '../src/core/types';
import {
  loadBundle,
  loadHealthConfig,
  loadHealthMap,
  loadPartners,
  loadSchemeDataset,
  unverifiedFigures,
} from '../src/lib/dataset';
import { hasMessage } from '../src/messages';

const withOverlay = loadSchemeDataset({ applyOverlay: true });
const seedOnly = loadSchemeDataset({ applyOverlay: false });

/** Every FieldProvenance reachable from a dataset, however nested. */
function allProvenance(dataset: ReturnType<typeof loadSchemeDataset>): FieldProvenance[] {
  const out: FieldProvenance[] = [];
  const isProvenance = (value: unknown): value is FieldProvenance =>
    typeof value === 'object' &&
    value !== null &&
    'source' in value &&
    'verified' in value &&
    typeof (value as FieldProvenance).source === 'string';

  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    if (isProvenance(node)) {
      out.push(node);
      return;
    }
    for (const value of Object.values(node)) walk(value);
  };

  walk(dataset.schemes);
  walk(dataset.global.provenance);
  return out;
}

describe('the overlay can never claim authority', () => {
  it('marks figures_authoritative false when the overlay is applied', () => {
    expect(withOverlay.overlay_applied).toBe(true);
    expect(withOverlay.figures_authoritative).toBe(false);
  });

  it('says so in the notes, in a key the UI can render', () => {
    expect(withOverlay.notes.length).toBeGreaterThan(0);
    for (const note of withOverlay.notes) {
      expect(hasMessage(note)).toBe(true);
    }
    expect(withOverlay.notes).toContain('dataset.note.demo_overlay_applied');
  });

  it('names the overlay in the label the banner shows', () => {
    expect(hasMessage(withOverlay.label)).toBe(true);
    expect(withOverlay.label).not.toBe(seedOnly.label);
  });

  it('is still not authoritative without the overlay, because the seed is placeholders', () => {
    // This is the assertion that would fail loudest if someone marked the seed
    // verified to make a banner go away.
    expect(seedOnly.overlay_applied).toBe(false);
    expect(seedOnly.figures_authoritative).toBe(false);
  });

  it('would only go true if every single figure became citable', () => {
    const provenance = allProvenance(withOverlay);
    const nonCitable = provenance.filter((entry) => !entry.verified);
    expect(nonCitable.length).toBeGreaterThan(0);
    // Restate the loader's rule independently: authoritative implies nothing
    // uncitable and no overlay.
    const derived = nonCitable.length === 0 && !withOverlay.overlay_applied;
    expect(withOverlay.figures_authoritative).toBe(derived);
  });
});

describe('verified is derived, never copied from the JSON', () => {
  it('agrees with isCitable() for every field in both load modes', () => {
    for (const dataset of [withOverlay, seedOnly]) {
      for (const entry of allProvenance(dataset)) {
        expect(PROVENANCE_SOURCES).toContain(entry.source);
        expect(entry.verified).toBe(isCitable(entry.source));
      }
    }
  });

  it('ignores a verified:true that a JSON file tries to assert for itself', () => {
    // The seed file is allowed to contain whatever it likes; the loader is the
    // authority. Read the raw file and confirm that no raw claim survives that
    // isCitable() would not grant.
    const raw: unknown = JSON.parse(readFileSync('data/schemes.seed.json', 'utf8'));
    const rawClaims: Array<{ source: string; verified: unknown }> = [];
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) {
        node.forEach(walk);
        return;
      }
      if (typeof node !== 'object' || node === null) return;
      const record = node as Record<string, unknown>;
      if (typeof record.source === 'string' && 'verified' in record) {
        rawClaims.push({ source: record.source, verified: record.verified });
      }
      Object.values(record).forEach(walk);
    };
    walk(raw);
    for (const claim of rawClaims) {
      if (claim.verified === true) {
        expect(
          isCitable(claim.source as ProvenanceSource),
          `data/schemes.seed.json claims verified:true on a '${claim.source}' figure. The loader ignores it, but the file should not say it.`,
        ).toBe(true);
      }
    }
  });

  it('rejects a provenance source it does not know', () => {
    // Guards against a typo silently becoming an unverified-but-unlabelled
    // figure. The loader throws; here we only assert the taxonomy is closed.
    expect(PROVENANCE_SOURCES).not.toContain('trust_me' as unknown as ProvenanceSource);
    expect(isCitable('placeholder')).toBe(false);
    expect(isCitable('demo_overlay')).toBe(false);
    expect(isCitable('ps_text')).toBe(false);
    expect(isCitable('fabricated')).toBe(false);
    expect(isCitable('common_practice')).toBe(false);
    expect(isCitable('open_data')).toBe(false);
    expect(isCitable('official_guideline')).toBe(true);
    expect(isCitable('design_decision')).toBe(true);
  });
});

describe('the overlay fills gaps and never overwrites the seed', () => {
  it('leaves every non-null seed value exactly as the seed states it', () => {
    for (const seedScheme of seedOnly.schemes) {
      const overlaid = withOverlay.schemes.find((scheme) => scheme.code === seedScheme.code)!;
      const numericFields = [
        'max_unit_cost',
        'max_loan',
        'min_loan',
        'min_project_cost',
        'loan_pct_cap',
        'margin_pct',
        'subsidy_pct',
        'subsidy_cap',
        'moratorium_months_min',
        'moratorium_months_max',
      ] as const;
      for (const field of numericFields) {
        if (seedScheme[field] !== null) {
          expect(
            overlaid[field],
            `overlay changed ${seedScheme.code}.${field}, which the seed already stated`,
          ).toBe(seedScheme[field]);
        }
      }
      if (seedScheme.moratorium_interest_treatment !== null) {
        expect(overlaid.moratorium_interest_treatment).toBe(
          seedScheme.moratorium_interest_treatment,
        );
      }
      if (seedScheme.subsidy_timing !== null) {
        expect(overlaid.subsidy_timing).toBe(seedScheme.subsidy_timing);
      }
    }
  });

  it('only ever fills a slot the seed left null', () => {
    let filled = 0;
    for (const seedScheme of seedOnly.schemes) {
      const overlaid = withOverlay.schemes.find((scheme) => scheme.code === seedScheme.code)!;
      for (const field of ['max_unit_cost', 'margin_pct', 'subsidy_pct'] as const) {
        if (seedScheme[field] === null && overlaid[field] !== null) filled += 1;
      }
    }
    // If this hits zero the overlay has stopped doing its job and the personas
    // script is silently reporting nothing computable.
    expect(filled).toBeGreaterThan(0);
  });

  it('stamps every filled value as demo_overlay, not as the seed source', () => {
    for (const scheme of withOverlay.schemes) {
      const seedScheme = seedOnly.schemes.find((s) => s.code === scheme.code)!;
      for (const [field, entry] of Object.entries(scheme.provenance)) {
        if (entry.source !== 'demo_overlay') continue;
        expect(entry.verified).toBe(false);
        const seedValue = (seedScheme as unknown as Record<string, unknown>)[field];
        if (Array.isArray(seedValue)) {
          // Rule tables are substituted wholesale, and only when every rule in
          // the seed table has a null value — a half-real table is never mixed
          // with overlay rows, because a rate card you cannot attribute row by
          // row is worse than one you know is fake.
          const seedRules = seedValue as Array<{ annual_rate_pct?: number | null }>;
          expect(
            seedRules.every((rule) => rule.annual_rate_pct == null),
            `overlay replaced ${scheme.code}.${field}, which already had a stated rate`,
          ).toBe(true);
        } else if (seedValue !== undefined) {
          // A scalar the seed had a value for must never carry an overlay stamp.
          expect(
            seedValue,
            `overlay overwrote ${scheme.code}.${field}, which the seed had stated`,
          ).toBeNull();
        }
      }
    }
  });

  it('keeps the seed unusable-but-honest rather than half-filled', () => {
    // Without the overlay, the schemes must still load and still be evaluable
    // for eligibility — only the money is missing. Eligibility rules come from
    // the problem statement, figures do not.
    expect(seedOnly.schemes.length).toBeGreaterThan(0);
    for (const scheme of seedOnly.schemes) {
      expect(scheme.predicates.length).toBeGreaterThan(0);
    }
  });
});

describe('VERIFY.md has something to report', () => {
  const figures = unverifiedFigures({ applyOverlay: true });

  it('lists every non-citable figure', () => {
    expect(figures.length).toBeGreaterThan(0);
    for (const figure of figures) {
      expect(isCitable(figure.source)).toBe(false);
    }
  });

  it('gives each entry a location, a field and a value a human can act on', () => {
    for (const figure of figures) {
      expect(figure.where).toMatch(/^(global_eligibility|scheme:[A-Z]+)$/);
      expect(figure.field).toMatch(/\S/);
      expect(figure.value).toMatch(/\S/);
      expect(`${figure.where}.${figure.field}`).not.toMatch(/undefined|\[object/);
    }
  });

  it('covers both the global rules and every scheme, so nothing hides', () => {
    const locations = new Set(figures.map((figure) => figure.where));
    expect(locations).toContain('global_eligibility');
    for (const scheme of withOverlay.schemes) {
      expect(locations).toContain(`scheme:${scheme.code}`);
    }
  });

  it('carries the seed’s warning notes through rather than dropping them', () => {
    // The seed's note on the interest rate — that the problem statement
    // contradicts itself — is the single most important thing for a human to
    // read before quoting a rate. It must survive into VERIFY.md.
    const withNotes = figures.filter((figure) => figure.note != null && figure.note.length > 0);
    expect(withNotes.length).toBeGreaterThan(0);
  });

  it('reports more figures with the overlay than without, since the overlay adds its own', () => {
    const seedFigures = unverifiedFigures({ applyOverlay: false });
    expect(figures.length).toBeGreaterThanOrEqual(seedFigures.length);
  });
});

describe('simulated data announces itself — invariant 2', () => {
  it('gives every partner health row a data_origin', () => {
    const health = loadHealthMap();
    expect(health.size).toBeGreaterThan(0);
    for (const [code, record] of health) {
      expect(['MIS_UPLOAD', 'SIMULATED'], `${code} has no usable data_origin`).toContain(
        record.data_origin,
      );
      expect(record.as_of).toMatch(/^\d{4}-\d{2}-\d{2}/);
    }
  });

  it('labels the interim health data as SIMULATED, since none of it is a real MIS feed', () => {
    const health = loadHealthMap();
    const origins = new Set([...health.values()].map((record) => record.data_origin));
    expect(origins).toEqual(new Set(['SIMULATED']));
  });

  it('carries provenance on every partner row', () => {
    const partners = loadPartners();
    expect(partners.length).toBeGreaterThan(0);
    for (const partner of partners) {
      expect(PROVENANCE_SOURCES).toContain(partner.provenance.source);
      // The interim registry is fabricated and must say so.
      expect(partner.provenance.verified).toBe(isCitable(partner.provenance.source));
    }
  });

  it('gives the health weights a stated rationale, because they are our design decision', () => {
    const config = loadHealthConfig();
    for (const key of ['fund_availability', 'npa', 'overdue', 'speed'] as const) {
      const rationale = config.weight_rationale_keys[key];
      expect(rationale, `no rationale key for weight '${key}'`).toBeTruthy();
      expect(hasMessage(rationale)).toBe(true);
    }
  });
});

describe('the bundle the app actually consumes', () => {
  it('loads both modes without throwing', () => {
    expect(() => loadBundle({ applyOverlay: true })).not.toThrow();
    expect(() => loadBundle({ applyOverlay: false })).not.toThrow();
  });

  it('carries the dataset label through to whatever renders it', () => {
    const bundle = loadBundle({ applyOverlay: true });
    expect(bundle.dataset.label).toBe(withOverlay.label);
    expect(bundle.dataset.figures_authoritative).toBe(false);
  });
});
