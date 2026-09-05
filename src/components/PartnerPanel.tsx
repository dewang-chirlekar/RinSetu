/**
 * src/components/PartnerPanel.tsx
 *
 * Where to apply, and why some branches are missing from the list.
 *
 * Two structural facts from src/core/partners/match.ts drive this whole panel,
 * and both are easy to break by "tidying up":
 *
 *   1. Hard filters ran strictly before soft ranking (CLAUDE.md hard rule 6).
 *      `eligible` is already the valid set; `ranked_by_distance` and
 *      `ranked_by_health` are two orderings OF THAT SET, never a blend. Do not
 *      merge them into one "best match" score — the point is that the applicant
 *      sees the trade-off and picks, rather than a hidden weighting picking for
 *      them.
 *
 *   2. `excluded` is kept, with all reasons per partner rather than the first
 *      one. "Why is my own bank not on this list" is a real question and this is
 *      the answer to it.
 *
 * The health score is a transparent weighted composite, not a prediction, and it
 * is rendered with its factor breakdown for that reason. Where the underlying row
 * is simulated, DataOriginBadge says so next to the score — never only in a
 * footnote.
 */

import type {
  ApplicantProfile,
  HealthScore,
  PartnerExclusion,
  PartnerFilterCode,
  PartnerMatch,
  PartnerMatchResult,
} from '@/core/types';
import { translate } from '@/messages';
import { joinList, km, longDate, plain, rupees } from '@/lib/format';
import { CapacityLabel, DataOriginBadge, ToggleLabel } from './ui';
import { PartnerMap } from './PartnerMap';

const MONEY_FILTERS: ReadonlySet<PartnerFilterCode> = new Set([
  'LOAN_BELOW_MIN_TICKET',
  'LOAN_ABOVE_MAX_TICKET',
]);

/** Partner-type tokens get their human label; everything else renders as given. */
function humaniseToken(token: string): string {
  const key = `partner.type.${token}`;
  try {
    return translate(key);
  } catch {
    return token;
  }
}

function formatFilterValue(
  code: PartnerFilterCode,
  value: number | string | string[] | null,
): string {
  if (value === null) return translate('common.unknown');
  if (Array.isArray(value)) return joinList(value.map(humaniseToken));
  if (typeof value === 'number') return MONEY_FILTERS.has(code) ? rupees(value) : plain(value);
  return humaniseToken(value);
}

function HealthMeter({ health }: { health: HealthScore }) {
  const pct = Math.round(health.score * 100);
  return (
    <div className="mt-1.5">
      <div className="flex items-baseline gap-2">
        <span className="text-ink-3 text-[0.6875rem]">{translate('health.score')}</span>
        <span className="num text-ink text-xs font-medium">{health.score.toFixed(2)}</span>
        <DataOriginBadge origin={health.data_origin} />
      </div>
      <div
        className="bg-paper-sunk border-rule mt-1 h-1.5 w-full border"
        role="img"
        aria-label={`${translate('health.score')} ${health.score.toFixed(2)}`}
      >
        <div className="bg-accent h-full" style={{ width: `${pct}%` }} />
      </div>

      <details className="mt-1.5">
        <summary className="text-accent cursor-pointer text-[0.6875rem]">
          <ToggleLabel />
        </summary>
        <p className="text-ink-3 mt-1.5 text-[0.6875rem] leading-relaxed">
          {translate('health.score_help')}
        </p>
        <table className="mt-2 w-full text-right text-[0.6875rem]">
          <tbody className="divide-rule divide-y">
            {health.factors.map((factor) => (
              <tr key={factor.key}>
                <td className="text-ink-2 py-1 pr-2 text-left">
                  {translate(`health.factor.${factor.key}`)}
                  <span className="text-ink-3 block leading-snug">
                    {translate(factor.rationaleKey)}
                  </span>
                </td>
                <td className="num text-ink-3 py-1 pr-2 align-top">
                  ×{factor.weight.toFixed(2)}
                </td>
                <td className="num text-ink py-1 align-top">{factor.contribution.toFixed(3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-ink-3 mt-1.5 text-[0.6875rem] leading-relaxed">
          {translate('health.capacity.multiplier_note')}
        </p>
        <p className="text-ink-3 mt-1 text-[0.6875rem]">
          {translate('health.as_of', { date: longDate(health.as_of) })}
        </p>
      </details>
    </div>
  );
}

function PartnerEntry({
  match,
  rank,
  showDistance,
}: {
  match: PartnerMatch;
  rank: number;
  /** False when no partner has a distance at all — the panel says so once instead. */
  showDistance: boolean;
}) {
  const { partner, distance_km, health } = match;
  return (
    <li className="border-rule border-b py-2.5 last:border-b-0">
      <div className="flex gap-2">
        <span className="num text-ink-3 shrink-0 text-xs">{rank}.</span>
        <div className="min-w-0 flex-1">
          <div className="text-ink text-sm font-medium">{partner.name}</div>
          <div className="text-ink-3 mt-0.5 text-[0.6875rem]">
            {translate(`partner.type.${partner.type}`)} · {partner.district}, {partner.state}
          </div>
          {showDistance ? (
            <div className="text-ink-2 mt-0.5 text-xs">
              {distance_km !== null
                ? translate('partner.straight_line_distance', { km: km(distance_km) })
                : translate('partner.distance_unknown')}
            </div>
          ) : null}
          {health ? (
            <>
              <div className="mt-1">
                <CapacityLabel flag={health.capacity_flag} />
              </div>
              <HealthMeter health={health} />
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function RankedColumn({
  title,
  matches,
  showDistance,
}: {
  title: string;
  matches: PartnerMatch[];
  showDistance: boolean;
}) {
  if (matches.length === 0) return null;
  return (
    <div className="sheet px-3 py-2">
      <h3 className="text-ink-3 text-[0.6875rem] font-semibold tracking-wider uppercase">
        {title}
      </h3>
      <ul className="mt-1">
        {matches.slice(0, 3).map((match, index) => (
          <PartnerEntry
            key={match.partner.code}
            match={match}
            rank={index + 1}
            showDistance={showDistance}
          />
        ))}
      </ul>
    </div>
  );
}

function ExclusionList({ excluded }: { excluded: PartnerExclusion[] }) {
  if (excluded.length === 0) return null;
  return (
    <details className="border-rule mt-4 border-t pt-3">
      <summary className="text-accent cursor-pointer text-xs font-medium">
        {translate('partner.filter.heading')} ({excluded.length})
      </summary>
      <ul className="divide-rule mt-2 divide-y">
        {excluded.map((entry) => (
          <li key={entry.partner.code} className="py-2">
            <div className="text-ink text-xs font-medium">{entry.partner.name}</div>
            <div className="text-ink-3 text-[0.6875rem]">
              {translate(`partner.type.${entry.partner.type}`)} · {entry.partner.district},{' '}
              {entry.partner.state}
            </div>
            <ul className="mt-1 space-y-0.5">
              {entry.reasons.map((reason) => (
                <li key={reason.code} className="text-ink-2 flex gap-1.5 text-[0.6875rem]">
                  <span aria-hidden className="text-fail shrink-0">
                    ✗
                  </span>
                  <span>
                    {translate(`partner.filter.${reason.code}`, {
                      actual: formatFilterValue(reason.code, reason.actual),
                      required: formatFilterValue(reason.code, reason.required),
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function PartnerPanel({
  result,
  applicant,
}: {
  result: PartnerMatchResult;
  applicant?: ApplicantProfile | null;
}) {
  if (result.eligible.length === 0) {
    return (
      <div>
        <div className="border-fail bg-fail-soft border-l-[3px] px-3.5 py-3">
          <h3 className="text-ink text-sm">{translate('partner.none_eligible')}</h3>
          <p className="text-ink-2 mt-1 text-xs leading-relaxed">
            {translate('partner.none_eligible_detail')}
          </p>
          {result.loan_exceeds_all_tickets ? (
            <p className="text-fail mt-1.5 text-xs">
              {translate('partner.loan_exceeds_all_tickets')}
            </p>
          ) : null}
        </div>
        <ExclusionList excluded={result.excluded} />
      </div>
    );
  }

  // A column headed "Nearest" over rows that all say "distance unknown" implies an
  // ordering that does not exist. The guided form collects no coordinates on
  // purpose (see src/app/apply/page.tsx — inventing a district centroid would
  // breach hard rule 1), so this is the common case, not an edge one.
  const anyDistanceKnown = result.eligible.some((match) => match.distance_km !== null);

  return (
    <div>
      {/* Map — eligible partners only, straight-line. Progressive enhancement: list stays when JS/maps fail. */}
      {applicant ? <PartnerMap result={result} applicant={applicant} /> : null}

      {anyDistanceKnown ? (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <RankedColumn
            title={translate('partner.rank_by_distance')}
            matches={result.ranked_by_distance}
            showDistance
          />
          <RankedColumn
            title={translate('partner.rank_by_health')}
            matches={result.ranked_by_health}
            showDistance
          />
        </div>
      ) : (
        <>
          <p className="text-ink-3 mt-3 mb-2 text-xs leading-relaxed">
            {translate('ui.partner.ranking_needs_location')}
          </p>
          <RankedColumn
            title={translate('partner.rank_by_health')}
            matches={result.ranked_by_health}
            showDistance={false}
          />
        </>
      )}
      <ExclusionList excluded={result.excluded} />
    </div>
  );
}
