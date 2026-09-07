/**
 * src/components/DatasetBanner.tsx
 *
 * The first thing on the results page, and the thing that must never be quietly
 * removed.
 *
 * `figures_authoritative` is computed in src/lib/dataset.ts and is false for two
 * independent reasons today: no scheme guideline has been transcribed, and the
 * demo overlay is supplying values so the calculator can run at all. It cannot be
 * forced true from a data file. While it is false, this banner is the difference
 * between a demo and a misrepresentation.
 *
 * Two forms, and the difference between them is where the figures are:
 *
 *   - Full (default) — stamp, label, the full warning and every note. Used on any
 *     screen that puts a rupee amount or a rate in front of the reader.
 *   - `compact` — the stamp and one sentence, on one line. Only for the front page,
 *     which shows no figures at all. The stamp itself is still the first thing on
 *     the page; the dataset label, the full warning and the notes move to
 *     <DatasetDetail> lower down, so nothing is dropped. Do not use compact on a
 *     screen that displays a computed number.
 */

import type { DatasetLabel } from '@/core/types';
import { translate } from '@/messages';

function DemoBanner() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true' && process.env.DEMO_MODE !== 'true') return null;
  // Also check global flag set by middleware/layout when DEMO_MODE true
  return (
    <aside className="border-accent bg-accent-soft mb-3 border-l-[3px] px-3.5 py-2">
      <span className="stamp stamp-tilt text-accent">DEMO MODE</span>
      <span className="text-ink-2 ml-2 text-xs">Fixture data — no network, no API key. Full demo runs offline.</span>
    </aside>
  );
}

export function DatasetBanner({
  dataset,
  compact = false,
}: {
  dataset: DatasetLabel;
  compact?: boolean;
}) {
  // Demo banner is rendered above the provenance banner so the judge sees it first
  const demo = <DemoBanner />;
  if (dataset.figures_authoritative) {
    return (
      <>
        {demo}
        <p className="text-ink-3 border-rule border-b pb-3 text-xs">
          {translate(dataset.label)}
        </p>
      </>
    );
  }

  if (compact) {
    return (
      <>
        {demo}
        <aside className="border-fail bg-fail-soft flex flex-wrap items-center gap-x-3 gap-y-1 border-l-[3px] px-3.5 py-2">
          <span className="stamp stamp-tilt text-fail">
            {translate('dataset.banner.not_authoritative')}
          </span>
          <span className="text-ink-2 text-xs">
            {translate('dataset.banner.not_authoritative_short')}
          </span>
        </aside>
      </>
    );
  }

  return (
    <>
      {demo}
      <aside className="border-fail bg-fail-soft border-l-[3px] px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="stamp stamp-tilt text-fail">
            {translate('dataset.banner.not_authoritative')}
          </span>
          <span className="text-ink-3 text-[0.6875rem]">{translate(dataset.label)}</span>
        </div>
        <p className="text-ink-2 mt-2 text-xs leading-relaxed">
          {translate('dataset.banner.not_authoritative_detail')}
        </p>
        {dataset.notes.length > 0 ? (
          <ul className="text-ink-3 mt-2 space-y-1 text-xs">
            {dataset.notes.map((note) => (
              <li key={note} className="flex gap-1.5">
                <span aria-hidden>—</span>
                <span>{translate(note)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </aside>
    </>
  );
}

/**
 * The part <DatasetBanner compact> leaves out: which dataset is loaded, the full
 * warning, and the per-note reasons the figures are not authoritative. Rendered
 * lower on the front page so the same facts are still on the page, just not in the
 * first screenful.
 */
export function DatasetDetail({ dataset }: { dataset: DatasetLabel }) {
  if (dataset.figures_authoritative) return null;

  return (
    <div>
      <p className="text-ink-3 text-[0.6875rem]">{translate(dataset.label)}</p>
      <p className="text-ink-2 mt-1 text-xs leading-relaxed">
        {translate('dataset.banner.not_authoritative_detail')}
      </p>
      {dataset.notes.length > 0 ? (
        <ul className="text-ink-3 mt-2 space-y-1 text-xs">
          {dataset.notes.map((note) => (
            <li key={note} className="flex gap-1.5">
              <span aria-hidden>—</span>
              <span>{translate(note)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
