/**
 * src/core/partners/match.ts
 *
 * Hard filters, then soft ranking. CLAUDE.md hard rule 6, and the distinction
 * ROADMAP §7 insists on:
 *
 *   HARD  capability, scheme-side partner-type permission, ticket range,
 *         jurisdiction. A partner that fails any of these must never appear for
 *         this scheme at any distance, however healthy it is.
 *
 *   SOFT  distance and health. These only reorder an already-valid set.
 *
 * Two orderings are returned, not one blended score. "Nearest" and
 * "fastest-moving" are different objectives and pretending a single ranking
 * serves both hides the trade-off from the applicant.
 *
 * Excluded partners are kept, with reasons — the same philosophy as failing
 * eligibility verdicts. "Why isn't my own bank on this list" is a question a
 * beneficiary will actually ask.
 */

import type {
  ApplicantProfile,
  Partner,
  PartnerExclusion,
  PartnerExclusionReason,
  PartnerHealthRecord,
  PartnerMatch,
  PartnerMatchResult,
  SchemeSpec,
} from '../types';
import { distanceKmOrNull } from './distance';
import { scoreHealth, type HealthScoringConfig } from './health';

export interface MatchInput {
  scheme: SchemeSpec;
  applicant: ApplicantProfile;
  partners: Partner[];
  /** Keyed by partner code. A partner with no health row simply scores null. */
  health: Map<string, PartnerHealthRecord>;
  healthConfig: HealthScoringConfig;
  /** The sanctioned loan the file will carry, or null when it is not computable. */
  loan: number | null;
}

/**
 * Every hard filter for one partner. Returns all failures rather than
 * short-circuiting, because "too small AND out of state" is more useful to show
 * than whichever check happened to run first.
 */
export function hardFilterReasons(
  partner: Partner,
  scheme: SchemeSpec,
  applicant: ApplicantProfile,
  loan: number | null,
): PartnerExclusionReason[] {
  const reasons: PartnerExclusionReason[] = [];

  if (!partner.handles_scheme_types.includes(scheme.type)) {
    reasons.push({
      code: 'DOES_NOT_HANDLE_SCHEME_TYPE',
      messageKey: 'partner.filter.DOES_NOT_HANDLE_SCHEME_TYPE',
      actual: partner.handles_scheme_types.join(', '),
      required: scheme.type,
    });
  }

  if (!scheme.allowed_partner_types.includes(partner.type)) {
    reasons.push({
      code: 'PARTNER_TYPE_NOT_ALLOWED_BY_SCHEME',
      messageKey: 'partner.filter.PARTNER_TYPE_NOT_ALLOWED_BY_SCHEME',
      actual: partner.type,
      required: scheme.allowed_partner_types,
    });
  }

  // Ticket range is only a filter once there is a loan figure. With no loan we
  // cannot judge it, so we do not exclude on it — an unknown is not a failure.
  if (loan != null) {
    if (partner.min_ticket != null && loan < partner.min_ticket) {
      reasons.push({
        code: 'LOAN_BELOW_MIN_TICKET',
        messageKey: 'partner.filter.LOAN_BELOW_MIN_TICKET',
        actual: loan,
        required: partner.min_ticket,
      });
    }
    if (partner.max_ticket != null && loan > partner.max_ticket) {
      reasons.push({
        code: 'LOAN_ABOVE_MAX_TICKET',
        messageKey: 'partner.filter.LOAN_ABOVE_MAX_TICKET',
        actual: loan,
        required: partner.max_ticket,
      });
    }
  }

  // Same treatment: filter on jurisdiction only when we know where the applicant is.
  if (applicant.state != null && !partner.jurisdiction_states.includes(applicant.state)) {
    reasons.push({
      code: 'OUTSIDE_JURISDICTION',
      messageKey: 'partner.filter.OUTSIDE_JURISDICTION',
      actual: applicant.state,
      required: partner.jurisdiction_states,
    });
  }

  return reasons;
}

export function matchPartners(input: MatchInput): PartnerMatchResult {
  const { scheme, applicant, partners, health, healthConfig, loan } = input;

  const eligible: PartnerMatch[] = [];
  const excluded: PartnerExclusion[] = [];

  const applicantPoint =
    applicant.lat != null && applicant.lng != null
      ? { lat: applicant.lat, lng: applicant.lng }
      : null;

  for (const partner of partners) {
    const reasons = hardFilterReasons(partner, scheme, applicant, loan);
    if (reasons.length > 0) {
      excluded.push({ partner, reasons });
      continue;
    }

    const record = health.get(partner.code);
    eligible.push({
      partner,
      distance_km: distanceKmOrNull(applicantPoint, { lat: partner.lat, lng: partner.lng }),
      health: record ? scoreHealth(record, healthConfig) : null,
    });
  }

  // Sorts are stable in modern JS engines, so equal keys keep registry order and
  // the ranking is reproducible run to run — which matters for snapshot tests.
  const ranked_by_distance = [...eligible].sort((a, b) => {
    // Unknown distance sorts last rather than first: never imply nearness we
    // have not measured.
    if (a.distance_km == null && b.distance_km == null) return 0;
    if (a.distance_km == null) return 1;
    if (b.distance_km == null) return -1;
    return a.distance_km - b.distance_km;
  });

  const ranked_by_health = [...eligible].sort((a, b) => {
    const scoreA = a.health?.score ?? -1;
    const scoreB = b.health?.score ?? -1;
    return scoreB - scoreA;
  });

  // Reported separately from the exclusion list because it is a different
  // message: not "these partners were wrong for you" but "no partner in the
  // registry writes a file this large", which is a capacity gap worth naming.
  const loan_exceeds_all_tickets =
    loan != null &&
    partners.length > 0 &&
    partners.every((partner) => partner.max_ticket != null && loan > partner.max_ticket);

  return { eligible, excluded, ranked_by_distance, ranked_by_health, loan_exceeds_all_tickets };
}
