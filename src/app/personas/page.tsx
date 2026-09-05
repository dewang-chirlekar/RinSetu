/**
 * src/app/personas/page.tsx
 *
 * The 40 committed fixtures, each with the outcome the engine actually produces
 * for it right now.
 *
 * The outcomes on this page are not stored anywhere — every persona is run through
 * `recommend()` at render time. That is the point: the page cannot show a stale or
 * flattering result, and if a change to the engine flips a verdict, this list flips
 * with it. It is the fastest way for a reviewer to see the negative and
 * undecidable cases, which are the ones worth looking at.
 */

import { getLocale } from 'next-intl/server';
import { recommend } from '@/core/recommend';
import type { SchemeRecommendation } from '@/core/types';
import { applicantToParams } from '@/lib/applicant-params';
import { loadBundle, loadPersonas, type Persona } from '@/lib/dataset';
import { rupees } from '@/lib/format';
import { translate, type Locale } from '@/messages';
import { DatasetBanner } from '@/components/DatasetBanner';
import { StatusPill } from '@/components/ui';

function SchemeChip({ entry }: { entry: SchemeRecommendation }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-ink-3 font-mono text-[0.625rem]">{entry.scheme_code}</span>
      <StatusPill status={entry.status} />
    </span>
  );
}

function PersonaRow({
  persona,
  schemes,
  recommendedCode,
}: {
  persona: Persona;
  schemes: SchemeRecommendation[];
  recommendedCode: string | null;
}) {
  const recommended = schemes.find((entry) => entry.scheme_code === recommendedCode);
  const figures =
    recommended?.computation && recommended.computation.computable ? recommended.computation : null;

  return (
    <li className="border-rule border-b py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <span className="text-ink-3 font-mono text-xs">{persona.id}</span>
        <span className="text-ink flex-1 text-sm font-medium">{persona.label}</span>
        {figures ? (
          <span className="num text-ink text-sm font-semibold">{rupees(figures.loan)}</span>
        ) : null}
      </div>

      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {schemes.map((entry) => (
          <SchemeChip key={entry.scheme_code} entry={entry} />
        ))}
      </div>

      {persona.tests.length > 0 ? (
        <p className="text-ink-3 mt-1.5 text-[0.6875rem] leading-relaxed">
          <span className="font-medium">{translate('ui.personas.pins')}: </span>
          {persona.tests.join(' · ')}
        </p>
      ) : null}

      <div className="no-print mt-1.5 flex gap-4 text-xs">
        <a href={`/result?persona=${persona.id}`} className="text-accent hover:underline">
          {translate('ui.personas.open')}
        </a>
        <a
          href={`/apply?${applicantToParams(persona.applicant).toString()}`}
          className="text-accent hover:underline"
        >
          {translate('ui.personas.open_form')}
        </a>
      </div>
    </li>
  );
}

export default async function PersonasPage() {
  const locale = (await getLocale()) as Locale;
  (globalThis as unknown as { __RINSETU_LOCALE__?: string }).__RINSETU_LOCALE__ = locale;
  const bundle = loadBundle();
  const personas = loadPersonas();

  // One fixed timestamp for the whole page: the personas differ by applicant, not
  // by when they were run, and a per-row clock read would add noise for nothing.
  const generatedAt = new Date().toISOString();

  const rows = personas.map((persona) => ({
    persona,
    result: recommend({ applicant: persona.applicant, ...bundle, generatedAt }),
  }));

  return (
    <div>
      <DatasetBanner dataset={bundle.dataset} />

      <h1 className="text-ink mt-6 font-serif text-2xl leading-tight font-semibold">
        {translate('ui.personas.heading')}
      </h1>
      <p className="text-ink-2 mt-2 text-sm leading-relaxed">{translate('ui.personas.lede')}</p>
      <p className="text-ink-3 mt-1 text-xs">
        {translate('ui.personas.count', { count: personas.length })}
      </p>

      <ul className="border-rule mt-5 border-t">
        {rows.map(({ persona, result }) => (
          <PersonaRow
            key={persona.id}
            persona={persona}
            schemes={result.schemes}
            recommendedCode={result.recommended_scheme_code}
          />
        ))}
      </ul>
    </div>
  );
}
