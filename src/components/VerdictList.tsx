/**
 * src/components/VerdictList.tsx
 *
 * Every eligibility check, passing and failing, with the minimum change that
 * would flip each failure.
 *
 * CLAUDE.md hard rule 4 — keep failures. This is the differentiator, not an error
 * path, so it gets the same visual weight as the figures do. Three things here are
 * deliberate and should survive an edit:
 *
 *   1. Passing checks are shown, not hidden. "You meet 6 of 7 conditions" is the
 *      information an applicant actually needs; a bare rejection is a dead end.
 *
 *   2. UNKNOWN is a separate state from FAIL, with its own colour. Collapsing the
 *      two would tell someone they are ineligible when the truth is that we do
 *      not know — the exact failure this project exists to avoid.
 *
 *   3. Remediations split by whose gap it is. AWAIT_GUIDELINE means we have not
 *      transcribed a figure yet; putting that in the applicant's to-do list would
 *      hand them homework they cannot possibly do.
 */

import type { Remediation, Verdict } from '@/core/types';
import { translate } from '@/messages';
import { isOurGap, predicateLabel, remediationSentence, verdictSentence, verdictTone } from '@/lib/view';
import { VerdictMark } from './ui';

export function VerdictList({
  verdicts,
  remediations,
}: {
  verdicts: Verdict[];
  remediations: Remediation[];
}) {
  const applicantSteps = remediations.filter((entry) => !isOurGap(entry));
  const ourGaps = remediations.filter(isOurGap);

  return (
    <div>
      <ul className="border-rule divide-rule divide-y border-y">
        {verdicts.map((verdict) => {
          const tone = verdictTone(verdict);
          return (
            <li key={verdict.code} className="flex gap-2.5 py-2.5">
              <span className="pt-0.5">
                <VerdictMark tone={tone} />
              </span>
              <div className="min-w-0">
                <div className="text-ink text-sm font-medium">{predicateLabel(verdict.code)}</div>
                <p className="text-ink-2 mt-0.5 text-xs leading-relaxed">
                  {verdictSentence(verdict)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>

      {applicantSteps.length > 0 ? (
        <div className="border-accent bg-accent-soft mt-4 border-l-[3px] px-3.5 py-3">
          <h3 className="text-ink text-sm">{translate('remediation.heading')}</h3>
          <ul className="mt-2 space-y-2">
            {applicantSteps.map((entry) => (
              <li key={entry.code} className="text-ink-2 flex gap-2 text-xs leading-relaxed">
                <span aria-hidden className="text-accent shrink-0">
                  →
                </span>
                <span>
                  <span className="text-ink font-medium">{predicateLabel(entry.code)}: </span>
                  {remediationSentence(entry)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {ourGaps.length > 0 ? (
        <div className="border-rule-strong bg-paper-sunk mt-3 border-l-[3px] px-3.5 py-3">
          <ul className="space-y-2">
            {ourGaps.map((entry) => (
              <li key={entry.code} className="text-ink-2 flex gap-2 text-xs leading-relaxed">
                <span aria-hidden className="text-ink-3 shrink-0">
                  ⌛
                </span>
                <span>{remediationSentence(entry)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
