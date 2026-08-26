/**
 * src/app/page.tsx
 *
 * The front page. A landing page, not a README: the claim, the two things you can
 * do, and the honesty stamp. Everything longer than a line lives in the collapsed
 * detail block at the foot.
 *
 * The layout rule that keeps it from turning back into documentation: each idea
 * gets ONE horizontal band, not one full-width ruled row per item. Four steps read
 * as a strip; four stacked rows read as a table of contents. Same for the schemes.
 * If you add a section here, ask whether it can be a band — and if it needs a
 * paragraph, it belongs in the detail block instead.
 *
 * Two things are load-bearing and should survive any rewording:
 *
 *   1. The provenance stamp stays first on the page. It is <DatasetBanner compact>,
 *      the one-line form, allowed here only because this page shows no rupee amount
 *      or rate anywhere. The dataset label, the full warning and the per-note
 *      reasons are not dropped — they move to <DatasetDetail> at the foot. A screen
 *      that prints a computed figure must use the full banner (see /result).
 *   2. The scheme list is read from the dataset, not typed here, so this page cannot
 *      drift out of step with what the engine will actually evaluate.
 */

import { loadBundle } from '@/lib/dataset';
import { translate } from '@/messages';
import { DatasetBanner, DatasetDetail } from '@/components/DatasetBanner';
import { PrimaryLink, SecondaryLink } from '@/components/ui';

const STEPS = ['1', '2', '3', '4'] as const;

/**
 * A quiet band label. Deliberately not <Section>: that component's serif heading
 * and full-width rule carry the weight of a document section, and three of them
 * stacked on a landing page is the clutter this page is trying not to be.
 */
function BandLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-ink-3 text-[0.6875rem] font-semibold tracking-wider uppercase">
      {children}
    </h2>
  );
}

export default function HomePage() {
  const { dataset } = loadBundle();

  return (
    <div>
      <DatasetBanner dataset={dataset} compact />

      <h1 className="text-ink mt-8 font-serif text-2xl leading-tight font-semibold sm:text-4xl">
        {translate('ui.tagline')}
      </h1>
      <p className="text-ink-2 mt-3 max-w-xl text-sm leading-relaxed sm:text-base">
        {translate('ui.home.lede')}
      </p>

      <div className="no-print mt-6 flex flex-wrap gap-3">
        <PrimaryLink href="/apply">{translate('ui.home.start')}</PrimaryLink>
        <SecondaryLink href="/personas">{translate('ui.home.browse_personas')}</SecondaryLink>
      </div>

      {/* Titles only, four across. The step bodies are in the detail block below. */}
      <div className="border-rule mt-12 border-t pt-4">
        <BandLabel>{translate('ui.home.how_heading')}</BandLabel>
        <ol className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step} className="flex gap-2">
              <span className="num text-rule-strong shrink-0 text-lg leading-none font-semibold">
                {step}
              </span>
              <span className="text-ink-2 text-xs leading-snug">
                {translate(`ui.home.step_${step}_title`)}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="border-rule mt-8 border-t pt-4">
        <BandLabel>{translate('ui.home.schemes_heading')}</BandLabel>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {dataset.schemes.map((scheme) => (
            <li key={scheme.code} className="sheet px-3 py-2.5">
              <div className="text-ink text-sm font-medium">
                {scheme.name_i18n.en ?? scheme.code}
              </div>
              {/*
                No provenance stamp here on purpose. A stamp must come from a
                FieldProvenance that src/lib/dataset.ts derived; synthesising one
                in a page would be exactly the override that ui.tsx warns against.
                Per-figure provenance appears on /result, where the figures are.
              */}
              <div className="text-ink-3 mt-0.5 text-[0.6875rem]">{scheme.type}</div>
              <p className="text-ink-2 mt-1.5 text-xs leading-relaxed">
                {translate(scheme.description_key)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      <details className="border-rule mt-8 border-t pt-4">
        <summary className="text-accent cursor-pointer text-xs font-medium">
          {translate('ui.home.detail_heading')}
        </summary>

        <dl className="mt-4">
          {STEPS.map((step) => (
            <div key={step} className="border-rule border-b py-2.5 first:border-t">
              <dt className="text-ink text-sm font-medium">
                {translate(`ui.home.step_${step}_title`)}
              </dt>
              <dd className="text-ink-2 mt-0.5 text-xs leading-relaxed">
                {translate(`ui.home.step_${step}_body`)}
              </dd>
            </div>
          ))}
        </dl>

        <h3 className="text-ink-3 mt-6 text-[0.6875rem] font-semibold tracking-wider uppercase">
          {translate('ui.home.honesty_heading')}
        </h3>
        <ul className="mt-2 space-y-2">
          {(['will_1', 'will_2', 'will_3'] as const).map((key) => (
            <li key={key} className="text-ink-2 flex gap-2 text-xs leading-relaxed">
              <span aria-hidden className="text-pass shrink-0">
                ✓
              </span>
              <span>{translate(`ui.home.${key}`)}</span>
            </li>
          ))}
          {(['wont_1', 'wont_2'] as const).map((key) => (
            <li key={key} className="text-ink-2 flex gap-2 text-xs leading-relaxed">
              <span aria-hidden className="text-fail shrink-0">
                ✗
              </span>
              <span>{translate(`ui.home.${key}`)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          <DatasetDetail dataset={dataset} />
        </div>
      </details>
    </div>
  );
}
