/**
 * src/components/ChecklistPanel.tsx
 *
 * The documents to carry to the branch.
 *
 * `resolveChecklist` was called with `partnerType: null` by recommend(), so this
 * is the scheme baseline. When the applicant picks a partner the list is
 * re-resolved against that partner's type and can grow — which is why each item
 * states whether the scheme, the partner class, or both require it.
 *
 * `status` comes from the applicant's own `documents_available`, so the HAVE/TO
 * OBTAIN split is a statement about what they told us, not a verification. It is
 * phrased that way on purpose.
 */

import type { DocumentChecklist } from '@/core/types';
import { translate, translateOptional } from '@/messages';
import { Provenance } from './ui';

export function ChecklistPanel({ checklist }: { checklist: DocumentChecklist }) {
  return (
    <div>
      <p className={`text-xs ${checklist.ready ? 'text-pass' : 'text-hold'}`}>
        {checklist.ready
          ? translate('checklist.ready')
          : translate('checklist.not_ready', { count: checklist.mandatory_missing })}
      </p>

      <ul className="border-rule divide-rule mt-2 divide-y border-y">
        {checklist.items.map((item) => {
          const notes = translateOptional(item.notes_key);
          return (
            <li key={item.doc_code} className="flex gap-2.5 py-2.5">
              <span
                aria-hidden
                className={`mt-0.5 inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center border text-[0.75rem] leading-none font-bold ${
                  item.status === 'HAVE' ? 'text-pass border-pass' : 'text-ink-3 border-rule-strong'
                }`}
              >
                {item.status === 'HAVE' ? '✓' : ''}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-ink text-sm font-medium">
                    {translate(item.name_key)}
                  </span>
                  <span className="text-ink-3 text-[0.6875rem]">
                    {item.mandatory
                      ? translate('checklist.mandatory')
                      : translate('checklist.optional')}
                  </span>
                  <span className="text-ink-3 text-[0.6875rem]">
                    · {translate(`checklist.required_by.${item.required_by}`)}
                  </span>
                </div>

                {item.status === 'MISSING' ? (
                  <p className="text-ink-2 mt-0.5 text-xs leading-relaxed">
                    <span className="text-ink-3">{translate('checklist.where_to_obtain')}: </span>
                    {translate(item.where_to_obtain_key)}
                  </p>
                ) : null}

                {notes ? (
                  <p className="text-ink-3 mt-0.5 text-[0.6875rem] leading-relaxed">{notes}</p>
                ) : null}
              </div>

              <span className="shrink-0 pt-0.5">
                <Provenance provenance={item.provenance} />
              </span>
            </li>
          );
        })}
      </ul>

      <p className="text-ink-3 mt-2 text-[0.6875rem]">
        {translate('checklist.mandatory')}: {checklist.mandatory_total - checklist.mandatory_missing}{' '}
        / {checklist.mandatory_total}
      </p>
    </div>
  );
}
