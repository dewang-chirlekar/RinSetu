/**
 * src/app/apply/page.tsx
 *
 * Server wrapper for the progressive intake form. Loads the dataset (the only
 * place the JSON is read) and hands it to the client component that handles
 * disclosure. The form still submits with GET to /result so the result is a
 * plain URL and works with JS disabled — see src/components/ApplyForm.tsx for
 * the no-JS fallback.
 */

import { loadBundle } from '@/lib/dataset';
import { translate } from '@/messages';
import { ApplyForm } from '@/components/ApplyForm';

type RawParams = Record<string, string | string[] | undefined>;

export default async function ApplyPage({ searchParams }: { searchParams: Promise<RawParams> }) {
  const params = await searchParams;
  const { dataset, partners, documentDefinitions, documentRequirements } = loadBundle();

  return (
    <div>
      <h1 className="text-ink font-serif text-2xl leading-tight font-semibold">
        {translate('ui.apply.heading')}
      </h1>
      <p className="text-ink-2 mt-2 text-sm leading-relaxed">{translate('ui.apply.lede')}</p>
      <p className="border-accent bg-accent-soft text-ink-2 mt-3 border-l-[3px] px-3.5 py-2.5 text-xs leading-relaxed">
        {translate('ui.apply.blank_hint')}
      </p>

      <ApplyForm
        dataset={dataset}
        partners={partners}
        documentDefinitions={documentDefinitions}
        documentRequirements={documentRequirements}
        initialParams={params}
      />
    </div>
  );
}
