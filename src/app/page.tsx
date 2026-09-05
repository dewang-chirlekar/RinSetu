/**
 * src/app/page.tsx
 *
 * The front page. A landing page, not a README: the claim, the two things you can
 * do, and the honesty stamp. Everything longer than a line lives in the collapsed
 * detail block at the foot.
 *
 * Two layout rules keep it from turning back into documentation:
 *
 *   1. The first screenful holds ONE idea. The hero section has a min-height in
 *      svh so the claim, the buttons and the stamp are what you land on; the bands
 *      below are ghosted until you scroll to them (see "Motion" in globals.css).
 *      The spacing from the stamp down through the buttons is FIXED. An earlier
 *      version used `mt-auto` on both ends to spread the hero over the screen, and
 *      on a tall window that opened a two-hundred-pixel hole between the stamp and
 *      the headline, which just looked broken. Only the scroll cue floats now, so
 *      all the leftover height collects in one place, above a line that is there
 *      to say "there is more below".
 *   2. Each idea below gets ONE horizontal band, not one full-width ruled row per
 *      item. Four steps read as a strip; four stacked rows read as a table of
 *      contents. If you add a section here, ask whether it can be a band — and if
 *      it needs a paragraph, it belongs in the detail block instead.
 *
 * Three things are load-bearing and should survive any rewording:
 *
 *   1. The provenance stamp stays first on the page, sharp and unanimated. It is
 *      <DatasetBanner compact>, the one-line form, allowed here only because this
 *      page shows no rupee amount or rate anywhere. The dataset label, the full
 *      warning and the per-note reasons are not dropped — they move to
 *      <DatasetDetail> at the foot. A screen that prints a computed figure must
 *      use the full banner (see /result).
 *   2. The scheme list is read from the dataset, not typed here, so this page
 *      cannot drift out of step with what the engine will actually evaluate.
 *   3. <ScrollReveal> is decoration and is built so that it cannot fail closed.
 *      Every element it touches renders sharp and readable if it never runs.
 */

import { getLocale } from 'next-intl/server';
import { loadBundle } from '@/lib/dataset';
import { translate, type Locale } from '@/messages';
import { DatasetBanner, DatasetDetail } from '@/components/DatasetBanner';
import { ScrollReveal } from '@/components/ScrollReveal';
import { PrimaryLink, SecondaryLink } from '@/components/ui';

const STEPS = ['1', '2', '3', '4'] as const;

/**
 * A quiet band label. Deliberately not <Section>: that component's serif heading
 * and full-width rule carry the weight of a document section, and three of them
 * stacked on a landing page is the clutter this page is trying not to be.
 *
 * Carries data-reveal so the label ghosts in with its band. The rule above it
 * belongs to the wrapper and stays sharp on purpose.
 */
function BandLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2
      data-reveal=""
      className="text-ink-3 text-[0.6875rem] font-semibold tracking-wider uppercase"
    >
      {children}
    </h2>
  );
}

export default async function HomePage() {
  const locale = (await getLocale()) as Locale;
  (globalThis as unknown as { __RINSETU_LOCALE__?: string }).__RINSETU_LOCALE__ = locale;
  const t = (key: string, values?: Record<string, string | number | null | undefined>) =>
    translate(key, values, locale);
  const { dataset } = loadBundle();

  return (
    <div>
      <ScrollReveal />

      {/*
        The first screenful. Sized in svh, not pixels, so the mobile browser's
        own chrome is accounted for, and deliberately a little short of the fold:
        the top edge of the next band should peek in, ghosted, because that is
        what tells you there is more below. 76svh is the one value that keeps that
        peek at both 360x640 and a wide desktop window; measured, not guessed.
      */}
      <section className="flex min-h-[76svh] flex-col">
        <DatasetBanner dataset={dataset} compact />

        <div className="intro pt-12 sm:pt-16">
          <h1 className="text-ink font-serif text-[1.75rem] leading-[1.1] font-semibold sm:text-[2.75rem]">
            {t('ui.tagline')}
          </h1>
          <p className="text-ink-2 mt-4 max-w-xl text-sm leading-relaxed sm:text-base">
            {t('ui.home.lede')}
          </p>
          <div className="no-print flex flex-wrap gap-3 pt-7">
            <PrimaryLink href="/apply">{t('ui.home.start')}</PrimaryLink>
            <SecondaryLink href="/personas">{t('ui.home.browse_personas')}</SecondaryLink>
          </div>
        </div>

        <p className="scroll-cue no-print text-ink-3 mt-auto flex items-center gap-1.5 pt-12 text-[0.6875rem] font-semibold tracking-wider uppercase">
          {t('ui.home.scroll_hint')}
          <svg
            aria-hidden="true"
            viewBox="0 0 12 12"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 2v8M2.5 6.5 6 10l3.5-3.5" />
          </svg>
        </p>
      </section>

      {/* Titles only, four across. The step bodies are in the detail block below. */}
      <div className="border-rule mt-10 border-t pt-4">
        <BandLabel>{t('ui.home.how_heading')}</BandLabel>
        <ol className="reveal-group mt-4 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          {STEPS.map((step) => (
            <li key={step} data-reveal="" className="flex gap-2.5">
              <span className="num border-rule-strong text-ink-3 flex h-5 w-5 shrink-0 items-center justify-center border text-[0.625rem] font-semibold">
                {step}
              </span>
              <span className="text-ink-2 text-xs leading-snug">
                {t(`ui.home.step_${step}_title`)}
              </span>
            </li>
          ))}
        </ol>
      </div>

      <div className="border-rule mt-10 border-t pt-4">
        <BandLabel>{t('ui.home.schemes_heading')}</BandLabel>
        <ul className="reveal-group mt-4 grid gap-3 sm:grid-cols-3">
          {dataset.schemes.map((scheme) => (
            <li
              key={scheme.code}
              data-reveal=""
              className="sheet hover:border-rule-strong px-3 py-2.5 transition-colors"
            >
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
                {t(scheme.description_key)}
              </p>
            </li>
          ))}
        </ul>
      </div>

      {/*
        data-reveal sits on the <summary>, never on the <details>. An open details
        block is taller than the viewport, and blurring a container while its body
        is being read is the one thing this effect must never do.
      */}
      <details className="border-rule mt-10 border-t pt-4">
        <summary data-reveal="" className="text-accent cursor-pointer text-xs font-medium">
          {t('ui.home.detail_heading')}
        </summary>

        <dl className="mt-4">
          {STEPS.map((step) => (
            <div key={step} className="border-rule border-b py-2.5 first:border-t">
              <dt className="text-ink text-sm font-medium">
                {t(`ui.home.step_${step}_title`)}
              </dt>
              <dd className="text-ink-2 mt-0.5 text-xs leading-relaxed">
                {t(`ui.home.step_${step}_body`)}
              </dd>
            </div>
          ))}
        </dl>

        <h3 className="text-ink-3 mt-6 text-[0.6875rem] font-semibold tracking-wider uppercase">
          {t('ui.home.honesty_heading')}
        </h3>
        <ul className="mt-2 space-y-2">
          {(['will_1', 'will_2', 'will_3'] as const).map((key) => (
            <li key={key} className="text-ink-2 flex gap-2 text-xs leading-relaxed">
              <span aria-hidden className="text-pass shrink-0">
                ✓
              </span>
              <span>{t(`ui.home.${key}`)}</span>
            </li>
          ))}
          {(['wont_1', 'wont_2'] as const).map((key) => (
            <li key={key} className="text-ink-2 flex gap-2 text-xs leading-relaxed">
              <span aria-hidden className="text-fail shrink-0">
                ✗
              </span>
              <span>{t(`ui.home.${key}`)}</span>
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