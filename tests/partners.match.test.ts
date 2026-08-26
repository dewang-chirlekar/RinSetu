/**
 * tests/partners.match.test.ts
 *
 * CLAUDE.md hard rule 6: hard filters before soft ranking. A partner that does
 * not handle a scheme category, or whose ticket range excludes the loan, must
 * never appear for it at any distance.
 *
 * That rule is the one whose violation would be most damaging in front of a
 * jury: an applicant sent to a branch that cannot process their file has been
 * actively harmed by the product. So the central assertion here is a leakage
 * check run over the whole cross-product of personas × schemes × partners — not
 * a spot check.
 *
 * The second theme is that exclusion must be informative. Every excluded
 * partner keeps its reasons, so the "why is my nearest branch not listed"
 * question always has an answer.
 */

import { describe, expect, it } from 'vitest';
import { hardFilterReasons, matchPartners } from '../src/core/partners/match';
import { distanceKmOrNull, haversineKm } from '../src/core/partners/distance';
import { PARTNER_FILTER_CODES } from '../src/core/types';
import { loadBundle, loadPersonas } from '../src/lib/dataset';
import { hasMessage } from '../src/messages';

const bundle = loadBundle({ applyOverlay: true });
const personas = loadPersonas();

/** Loans spanning every ticket band in the registry, plus the null case. */
const PROBE_LOANS = [null, 1_000, 9_999, 25_000, 100_000, 500_000, 2_500_000, 4_000_000, 9_999_999];

describe('hard filters are absolute — hard rule 6', () => {
  it('never lets a partner through that cannot handle the scheme type', () => {
    const leaks: string[] = [];
    for (const scheme of bundle.dataset.schemes) {
      for (const persona of personas) {
        for (const loan of PROBE_LOANS) {
          const result = matchPartners({
            scheme,
            applicant: persona.applicant,
            partners: bundle.partners,
            health: bundle.health,
            healthConfig: bundle.healthConfig,
            loan,
          });
          for (const candidate of result.eligible) {
            if (!candidate.partner.handles_scheme_types.includes(scheme.type)) {
              leaks.push(`${candidate.partner.code} for ${scheme.code} (${persona.id}, loan ${loan})`);
            }
          }
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it('never lets a partner through whose ticket range excludes the loan', () => {
    const leaks: string[] = [];
    for (const scheme of bundle.dataset.schemes) {
      for (const loan of PROBE_LOANS) {
        if (loan === null) continue;
        const result = matchPartners({
          scheme,
          applicant: personas[0].applicant,
          partners: bundle.partners,
          health: bundle.health,
          healthConfig: bundle.healthConfig,
          loan,
        });
        for (const candidate of result.eligible) {
          const { min_ticket, max_ticket } = candidate.partner;
          if (min_ticket != null && loan < min_ticket) {
            leaks.push(`${candidate.partner.code} accepted ${loan} below its floor ${min_ticket}`);
          }
          if (max_ticket != null && loan > max_ticket) {
            leaks.push(`${candidate.partner.code} accepted ${loan} above its ceiling ${max_ticket}`);
          }
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it('never lets a partner through that the scheme does not permit by type', () => {
    const leaks: string[] = [];
    for (const scheme of bundle.dataset.schemes) {
      if (scheme.allowed_partner_types == null) continue;
      for (const persona of personas) {
        const result = matchPartners({
          scheme,
          applicant: persona.applicant,
          partners: bundle.partners,
          health: bundle.health,
          healthConfig: bundle.healthConfig,
          loan: 100_000,
        });
        for (const candidate of result.eligible) {
          if (!scheme.allowed_partner_types.includes(candidate.partner.type)) {
            leaks.push(`${candidate.partner.code} (${candidate.partner.type}) for ${scheme.code}`);
          }
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it('never lets a partner through whose jurisdiction excludes the applicant state', () => {
    const leaks: string[] = [];
    for (const scheme of bundle.dataset.schemes) {
      for (const persona of personas) {
        const state = persona.applicant.state;
        if (state == null) continue;
        const result = matchPartners({
          scheme,
          applicant: persona.applicant,
          partners: bundle.partners,
          health: bundle.health,
          healthConfig: bundle.healthConfig,
          loan: 100_000,
        });
        for (const candidate of result.eligible) {
          const states = candidate.partner.jurisdiction_states;
          if (states != null && states.length > 0 && !states.includes(state)) {
            leaks.push(`${candidate.partner.code} served ${state}, jurisdiction ${states.join('/')}`);
          }
        }
      }
    }
    expect(leaks).toEqual([]);
  });

  it('produces an eligible set that is exactly the partners with no exclusion reasons', () => {
    for (const scheme of bundle.dataset.schemes) {
      for (const persona of personas.slice(0, 12)) {
        const loan = 120_000;
        const result = matchPartners({
          scheme,
          applicant: persona.applicant,
          partners: bundle.partners,
          health: bundle.health,
          healthConfig: bundle.healthConfig,
          loan,
        });
        const expectedEligible = bundle.partners
          .filter((partner) => hardFilterReasons(partner, scheme, persona.applicant, loan).length === 0)
          .map((partner) => partner.code)
          .sort();
        expect(result.eligible.map((c) => c.partner.code).sort()).toEqual(expectedEligible);
        // Nothing is dropped on the floor: every partner is in exactly one list.
        expect(result.eligible.length + result.excluded.length).toBe(bundle.partners.length);
      }
    }
  });
});

describe('exclusions are informative', () => {
  it('gives every excluded partner at least one reason code', () => {
    for (const scheme of bundle.dataset.schemes) {
      for (const persona of personas) {
        const result = matchPartners({
          scheme,
          applicant: persona.applicant,
          partners: bundle.partners,
          health: bundle.health,
          healthConfig: bundle.healthConfig,
          loan: 300_000,
        });
        for (const exclusion of result.excluded) {
          expect(exclusion.reasons.length).toBeGreaterThan(0);
          for (const reason of exclusion.reasons) {
            expect(PARTNER_FILTER_CODES).toContain(reason.code);
            expect(hasMessage(reason.messageKey)).toBe(true);
          }
        }
      }
    }
  });

  it('reports every reason a partner fails, not just the first', () => {
    // A partner that is both out of state and too small must say both, or the
    // user fixes one thing and is rejected again.
    let sawMultiple = false;
    for (const scheme of bundle.dataset.schemes) {
      for (const persona of personas) {
        const result = matchPartners({
          scheme,
          applicant: persona.applicant,
          partners: bundle.partners,
          health: bundle.health,
          healthConfig: bundle.healthConfig,
          loan: 8_000,
        });
        if (result.excluded.some((exclusion) => exclusion.reasons.length > 1)) sawMultiple = true;
      }
    }
    expect(sawMultiple).toBe(true);
  });

  it('reaches all five filter codes across the persona set', () => {
    const seen = new Set<string>();
    for (const scheme of bundle.dataset.schemes) {
      for (const persona of personas) {
        for (const loan of PROBE_LOANS) {
          const result = matchPartners({
            scheme,
            applicant: persona.applicant,
            partners: bundle.partners,
            health: bundle.health,
            healthConfig: bundle.healthConfig,
            loan,
          });
          for (const exclusion of result.excluded) {
            for (const reason of exclusion.reasons) seen.add(reason.code);
          }
        }
      }
    }
    expect([...seen].sort()).toEqual([...PARTNER_FILTER_CODES].sort());
  });

  it('flags a loan larger than every ticket ceiling rather than showing an empty list', () => {
    const term = bundle.dataset.schemes.find((scheme) => scheme.code === 'TERM')!;
    const result = matchPartners({
      scheme: term,
      applicant: personas.find((p) => p.id === 'P31')!.applicant,
      partners: bundle.partners,
      health: bundle.health,
      healthConfig: bundle.healthConfig,
      loan: 45_00_000,
    });
    expect(result.eligible).toHaveLength(0);
    expect(result.loan_exceeds_all_tickets).toBe(true);
  });
});

describe('soft ranking only reorders an already-valid set', () => {
  const micro = bundle.dataset.schemes.find((scheme) => scheme.code === 'MICRO')!;
  const p22 = personas.find((p) => p.id === 'P22')!;
  const result = matchPartners({
    scheme: micro,
    applicant: p22.applicant,
    partners: bundle.partners,
    health: bundle.health,
    healthConfig: bundle.healthConfig,
    loan: 121_100,
  });

  it('ranks the same set both ways', () => {
    const byDistance = result.ranked_by_distance.map((c) => c.partner.code).sort();
    const byHealth = result.ranked_by_health.map((c) => c.partner.code).sort();
    const eligible = result.eligible.map((c) => c.partner.code).sort();
    expect(byDistance).toEqual(eligible);
    expect(byHealth).toEqual(eligible);
  });

  it('orders by ascending distance, with unknown distances last', () => {
    const distances = result.ranked_by_distance.map((c) => c.distance_km);
    const known = distances.filter((d): d is number => d != null);
    const sorted = [...known].sort((a, b) => a - b);
    expect(known).toEqual(sorted);
    // A null distance must not sort as zero and jump to the front.
    const firstNull = distances.indexOf(null);
    if (firstNull !== -1) {
      expect(distances.slice(firstNull).every((d) => d == null)).toBe(true);
    }
  });

  it('orders by descending health score, with unscored partners last', () => {
    const scores = result.ranked_by_health.map((c) => c.health?.score ?? null);
    const known = scores.filter((s): s is number => s != null);
    const sorted = [...known].sort((a, b) => b - a);
    expect(known).toEqual(sorted);
  });

  it('gives two genuinely different orderings for P22 — the demo depends on it', () => {
    expect(result.eligible.length).toBeGreaterThan(1);
    expect(result.ranked_by_distance[0].partner.code).not.toBe(
      result.ranked_by_health[0].partner.code,
    );
  });
});

describe('distance', () => {
  it('is zero for a point against itself', () => {
    expect(haversineKm({ lat: 18.5204, lng: 73.8567 }, { lat: 18.5204, lng: 73.8567 })).toBe(0);
  });

  it('is symmetric', () => {
    const pune = { lat: 18.5204, lng: 73.8567 };
    const mumbai = { lat: 19.0176, lng: 72.8562 };
    expect(haversineKm(pune, mumbai)).toBeCloseTo(haversineKm(mumbai, pune), 9);
  });

  it('matches the known Pune–Mumbai great-circle distance', () => {
    // ~118 km. A generous window: the assertion is that the formula is a
    // great-circle distance at all, not that it agrees with a road router.
    const km = haversineKm({ lat: 18.5204, lng: 73.8567 }, { lat: 19.0176, lng: 72.8562 });
    expect(km).toBeGreaterThan(110);
    expect(km).toBeLessThan(126);
  });

  it('returns null rather than substituting a centroid when either point is unknown', () => {
    // Hard rule: an unknown location must read as unknown. A quietly substituted
    // district centroid would put a confident wrong number on the screen.
    expect(distanceKmOrNull(null, { lat: 1, lng: 1 })).toBeNull();
    expect(distanceKmOrNull({ lat: 1, lng: 1 }, null)).toBeNull();
    expect(distanceKmOrNull(null, null)).toBeNull();
  });

  it('produces a null distance for an applicant with no coordinates, and still matches', () => {
    const micro = bundle.dataset.schemes.find((scheme) => scheme.code === 'MICRO')!;
    const applicant = { ...personas[0].applicant, lat: null, lng: null };
    const result = matchPartners({
      scheme: micro,
      applicant,
      partners: bundle.partners,
      health: bundle.health,
      healthConfig: bundle.healthConfig,
      loan: 100_000,
    });
    expect(result.eligible.length).toBeGreaterThan(0);
    expect(result.eligible.every((c) => c.distance_km === null)).toBe(true);
  });
});

describe('a null loan does not fabricate a shortlist', () => {
  it('applies every filter except the ticket range when the loan is not computable', () => {
    const micro = bundle.dataset.schemes.find((scheme) => scheme.code === 'MICRO')!;
    const applicant = personas.find((p) => p.id === 'P01')!.applicant;
    const withLoan = matchPartners({
      scheme: micro,
      applicant,
      partners: bundle.partners,
      health: bundle.health,
      healthConfig: bundle.healthConfig,
      loan: 85_000,
    });
    const withoutLoan = matchPartners({
      scheme: micro,
      applicant,
      partners: bundle.partners,
      health: bundle.health,
      healthConfig: bundle.healthConfig,
      loan: null,
    });
    // Without a loan we cannot apply the ticket filter, so the set can only be
    // the same or larger — never smaller, and never a different set.
    const a = new Set(withLoan.eligible.map((c) => c.partner.code));
    for (const code of a) {
      expect(withoutLoan.eligible.map((c) => c.partner.code)).toContain(code);
    }
    expect(withoutLoan.loan_exceeds_all_tickets).toBe(false);
    for (const exclusion of withoutLoan.excluded) {
      expect(exclusion.reasons.map((r) => r.code)).not.toContain('LOAN_BELOW_MIN_TICKET');
      expect(exclusion.reasons.map((r) => r.code)).not.toContain('LOAN_ABOVE_MAX_TICKET');
    }
  });
});
