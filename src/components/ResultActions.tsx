'use client';

import { useState, useEffect } from 'react';
import { SaveApplicationButton } from './SaveApplicationButton';
import { LoanConfirmation } from './LoanConfirmation';
import type { ApplicantProfile, SchemeRecommendation } from '@/core/types';

/**
 * Client wrapper that owns the chosen scheme code so Save and
 * LoanConfirmation stay in sync. Without this, Save always stored
 * the engine's recommendation even when the user picked a different
 * ELIGIBLE scheme (P41 MICRO vs AMY). See docs/PROGRESS.md polish item.
 *
 * Keeps LoanConfirmation's internal `confirmed` state inside LoanConfirmation;
 * only the radio selection (chosenCode) is lifted here.
 */
export function ResultActions({
  recommendation,
  applicant,
  eligibleSchemes,
  recommendedCode,
  saveSearch,
}: {
  recommendation: SchemeRecommendation;
  applicant: ApplicantProfile;
  eligibleSchemes: SchemeRecommendation[];
  recommendedCode: string | null;
  saveSearch: string;
}) {
  const fallback = recommendation.scheme_code;
  const [chosenCode, setChosenCode] = useState<string>(recommendedCode ?? fallback);

  // If the server recomputes a different recommendation (e.g. intent filter or new query),
  // sync the local choice to the new recommendation — but only when the recommendation
  // actually changes, not on every render.
  useEffect(() => {
    const next = recommendedCode ?? fallback;
    setChosenCode((prev) => (prev !== next && !eligibleSchemes.some((s) => s.scheme_code === prev) ? next : prev));
  }, [recommendedCode, fallback, eligibleSchemes]);

  return (
    <>
      <SaveApplicationButton search={saveSearch} schemeCode={chosenCode} />
      <LoanConfirmation
        recommendation={recommendation}
        applicant={applicant}
        eligibleSchemes={eligibleSchemes}
        recommendedCode={recommendedCode}
        chosenCode={chosenCode}
        onChosenChange={setChosenCode}
      />
    </>
  );
}
