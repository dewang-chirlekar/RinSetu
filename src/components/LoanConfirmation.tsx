'use client';

import { useState } from 'react';
import { translate } from '@/messages';
import { applicantToParams } from '@/lib/applicant-params';
import type { ApplicantProfile, SchemeRecommendation } from '@/core/types';
import { DocumentUpload } from './DocumentUpload';

export function LoanConfirmation({
  recommendation,
  applicant,
}: {
  recommendation: SchemeRecommendation;
  applicant: ApplicantProfile;
}) {
  const [confirmed, setConfirmed] = useState(false);
  const [extracted, setExtracted] = useState<Record<string, unknown> | null>(null);

  if (!confirmed) {
    return (
      <div className="border-accent bg-accent-soft mt-3 border-l-[3px] px-3.5 py-3">
        <p className="text-ink text-sm font-medium">{translate('ui.confirm.heading')}</p>
        <p className="text-ink-2 mt-1 text-xs leading-relaxed">{translate('ui.confirm.hint')}</p>
        <button
          type="button"
          onClick={() => setConfirmed(true)}
          className="bg-accent text-paper mt-3 inline-flex items-center px-4 py-2 text-sm font-medium"
        >
          {translate('ui.confirm.action', { code: recommendation.scheme_code })}
        </button>
      </div>
    );
  }

  const checklist = recommendation.checklist;
  if (!checklist || checklist.items.length === 0) {
    return (
      <div className="border-rule bg-paper-sunk mt-3 border p-3">
        <p className="text-ink-2 text-xs">{translate('ui.confirm.no_docs')}</p>
      </div>
    );
  }

  function handleExtracted(patch: Record<string, unknown>) {
    setExtracted(patch);
  }

  // Build a link to re-apply with extracted fields merged
  let reapplyHref: string | null = null;
  if (extracted) {
    const merged = { ...applicant, ...extracted } as ApplicantProfile;
    // Ensure documents_available is merged correctly
    const docs = new Set<string>([
      ...(applicant.documents_available as string[]),
      ...((extracted.documents_available as string[]) ?? []),
    ]);
    (merged as Record<string, unknown>).documents_available = [...docs];
    const params = applicantToParams(merged as never);
    reapplyHref = `/result?${params.toString()}`;
  }

  return (
    <div>
      <div className="border-pass bg-pass-soft mt-3 border-l-[3px] px-3.5 py-3">
        <p className="text-ink text-sm font-medium">{translate('ui.confirm.confirmed', { code: recommendation.scheme_code })}</p>
        <p className="text-ink-2 mt-1 text-xs leading-relaxed">{translate('ui.confirm.confirmed_hint')}</p>
      </div>

      <DocumentUpload items={checklist.items} onExtracted={handleExtracted} />

      {extracted ? (
        <div className="border-rule bg-paper-edge mt-3 border p-3">
          <p className="text-ink text-xs font-medium">{translate('ui.confirm.extracted_heading')}</p>
          <pre className="bg-paper-sunk text-ink-3 mt-2 overflow-auto p-2 text-[0.6875rem]">{JSON.stringify(extracted, null, 2)}</pre>
          {reapplyHref ? (
            <a href={reapplyHref} className="bg-accent text-paper mt-3 inline-flex items-center px-4 py-2 text-sm font-medium">
              {translate('ui.confirm.reapply')}
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
