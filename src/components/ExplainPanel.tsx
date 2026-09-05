'use client';

import { useState } from 'react';
import { translate } from '@/messages';
import type { RecommendationResult } from '@/core/types';

export function ExplainPanel({ result }: { result: RecommendationResult }) {
  const [prose, setProse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExplain() {
    setLoading(true);
    setError(null);
    try {
      // Use the applicant's preferred language if set, else UI locale via cookie
      const lang = (result.applicant.preferred_language as string) || 'en';
      const res = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result, language: lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Explain failed');
      setProse(data.prose);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  if (prose) {
    return (
      <div className="border-rule bg-paper-sunk mt-3 border p-3">
        <p className="text-ink text-sm leading-relaxed">{prose}</p>
        <p className="text-ink-3 mt-2 text-[0.6875rem] leading-relaxed">
          {translate('ui.result.explain_note')}
        </p>
      </div>
    );
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={handleExplain}
        disabled={loading}
        className="border-rule bg-paper-edge text-ink hover:bg-paper-sunk inline-flex items-center border px-3 py-1.5 text-xs disabled:opacity-50"
      >
        {loading ? translate('ui.result.explain_loading') : translate('ui.result.explain_action')}
      </button>
      {error ? <p className="text-fail mt-2 text-xs">{error}</p> : null}
      <p className="text-ink-3 mt-1 text-[0.6875rem]">{translate('ui.result.explain_hint')}</p>
    </div>
  );
}
