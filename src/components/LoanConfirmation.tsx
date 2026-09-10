'use client';

import { useState } from 'react';
import { translate } from '@/messages';
import { applicantToParams } from '@/lib/applicant-params';
import type { ApplicantProfile, SchemeRecommendation } from '@/core/types';
import { DocumentUpload } from './DocumentUpload';

export function LoanConfirmation({
  recommendation,
  applicant,
  eligibleSchemes,
  recommendedCode,
}: {
  recommendation: SchemeRecommendation;
  applicant: ApplicantProfile;
  eligibleSchemes?: SchemeRecommendation[];
  recommendedCode?: string | null;
}) {
  const choices = eligibleSchemes && eligibleSchemes.length > 0 ? eligibleSchemes : [recommendation];
  const [chosenCode, setChosenCode] = useState<string>(recommendation.scheme_code);
  const chosen = choices.find((c) => c.scheme_code === chosenCode) ?? recommendation;
  const [confirmed, setConfirmed] = useState(false);
  const [extracted, setExtracted] = useState<Record<string, unknown> | null>(null);

  if (!confirmed) {
    const isMulti = choices.length > 1;
    return (
      <div className="border-accent bg-accent-soft mt-3 border-l-[3px] px-3.5 py-3">
        <p className="text-ink text-sm font-medium">{translate('ui.confirm.heading')}</p>
        <p className="text-ink-2 mt-1 text-xs leading-relaxed">
          {isMulti ? `${translate('ui.confirm.hint')} ${translate('recommendation.policy.largest_share_then_lowest_rate')}` : translate('ui.confirm.hint')}
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {choices.map((opt) => {
            const comp = opt.computation && opt.computation.computable ? opt.computation : null;
            const isRec = opt.scheme_code === recommendedCode;
            const selected = opt.scheme_code === chosenCode;
            return (
              <label
                key={opt.scheme_code}
                className={`flex cursor-pointer items-center justify-between gap-3 border px-3 py-2.5 text-sm ${selected ? 'border-accent bg-white' : 'border-rule bg-paper-edge'} ${isRec ? 'ring-accent/20 ring-1' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="chosenScheme"
                    value={opt.scheme_code}
                    checked={selected}
                    onChange={() => setChosenCode(opt.scheme_code)}
                    className="accent-accent"
                  />
                  <span className="font-medium">{opt.scheme_code}</span>
                  {isRec ? <span className="stamp text-accent ml-1">{translate('recommendation.heading')}</span> : null}
                  {comp ? <span className="text-ink-3 text-xs">{comp.loan.toLocaleString('en-IN')} @ {comp.annual_rate_pct}% → {comp.schedule.emi.toLocaleString('en-IN')}/mo</span> : null}
                </span>
                <span className={`text-xs ${opt.status === 'ELIGIBLE' ? 'text-pass' : 'text-fail'}`}>{opt.status}</span>
              </label>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setConfirmed(true)}
          className="bg-accent text-paper mt-3 inline-flex items-center px-4 py-2 text-sm font-medium"
        >
          {translate('ui.confirm.action', { code: chosenCode })}
        </button>
      </div>
    );
  }

  const checklist = chosen.checklist;
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
        <p className="text-ink text-sm font-medium">{translate('ui.confirm.confirmed', { code: chosen.scheme_code })}</p>
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
