'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate } from '@/messages';
import { applicantToParams } from '@/lib/applicant-params';

export function FreeTextIntake() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryIn, setRetryIn] = useState<number | null>(null);
  const [statusCode, setStatusCode] = useState<number | null>(null);

  const [info, setInfo] = useState<string | null>(null);

  // Countdown for Retry-After
  useEffect(() => {
    if (retryIn === null || retryIn <= 0) return;
    const id = setTimeout(() => setRetryIn((n) => (n !== null ? n - 1 : null)), 1000);
    return () => clearTimeout(id);
  }, [retryIn]);

  async function handleExtract() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    setRetryIn(null);
    setStatusCode(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let payload: any = {};
      try {
        payload = await res.json();
      } catch {
        try {
          const t = await res.text();
          payload = { error: t.slice(0, 800) || `Extract failed (${res.status})` };
        } catch {
          payload = {};
        }
      }
      if (!res.ok) {
        const errMsg = typeof payload.error === 'string' && payload.error.trim().length > 0 ? payload.error : `Extract failed (${res.status})`;
        setStatusCode(res.status);
        const retryAfter = res.headers.get('Retry-After');
        if (res.status === 429 || res.status === 503) {
          const secs = retryAfter ? parseInt(retryAfter, 10) : res.status === 503 ? 10 : 5;
          if (!Number.isNaN(secs)) setRetryIn(secs);
        }
        throw new Error(errMsg);
      }
      // Fill the guided form and stay on /apply — user reviews, fills missing fields, then clicks "See the result"
      const params = applicantToParams(payload as never);
      // Check what's still missing and nudge the user (LLM asks for more info)
      const missing: string[] = [];
      if (payload.name == null) missing.push(translate('ui.apply.name'));
      if (payload.age == null) missing.push(translate('ui.apply.age'));
      if (payload.category === 'UNKNOWN') missing.push(translate('ui.apply.category'));
      if (payload.annual_family_income == null) missing.push(translate('ui.apply.income'));
      if (payload.intent === 'UNKNOWN') missing.push(translate('ui.apply.intent'));
      if (payload.purpose == null) missing.push(translate('ui.apply.purpose'));
      if (payload.project_cost == null) missing.push(translate('ui.apply.project_cost'));
      if (missing.length > 0) {
        setInfo(
          `${translate('ui.apply.free_text_missing_prefix')} ${missing.join(', ')}. ${translate('ui.apply.free_text_missing_hint')}`,
        );
      } else {
        setInfo(translate('ui.apply.free_text_filled'));
      }
      // Use replace to stay on /apply and avoid adding a new history entry for each extract
      router.replace(`/apply?${params.toString()}`);
      // Also dispatch an event so the form can update without a full navigation (progressive enhancement)
      window.dispatchEvent(new CustomEvent('rinsetu:extracted', { detail: payload }));
    } catch (e) {
      // fetch can reject with an Event on abort/navigation — don't show "[object Event]"
      const raw = e instanceof Error ? e.message : typeof e === 'object' && e !== null && 'type' in (e as Record<string, unknown>) ? `Network error (${String((e as { type?: string }).type)}) — please retry` : String(e);
      const m = raw.toLowerCase();
      // If fetch threw before we could read Retry-After header, infer from message
      if (retryIn === null && (m.includes('busy') || m.includes('high demand') || m.includes('503') || m.includes('overloaded'))) {
        setStatusCode(503);
        setRetryIn(10);
      } else if (retryIn === null && (m.includes('quota') || m.includes('429'))) {
        setStatusCode(429);
        setRetryIn(5);
      }
      setError(raw);
    } finally {
      setLoading(false);
    }
  }

  function retryLabel() {
    if (retryIn !== null && retryIn > 0) return translate('ui.apply.free_text_retry_in', { seconds: String(retryIn) });
    return translate('ui.apply.free_text_retry');
  }

  return (
    <div className="border-rule bg-paper-sunk mt-6 border p-4">
      <h3 className="text-ink font-serif text-sm font-semibold">{translate('ui.apply.free_text_heading')}</h3>
      <p className="text-ink-2 mt-1 text-xs leading-relaxed">{translate('ui.apply.free_text_hint')}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={translate('ui.apply.free_text_placeholder')}
        rows={3}
        className="border-rule-strong bg-paper-edge text-ink mt-3 w-full border px-3 py-2 text-sm"
      />
      {error ? (
        <div className="bg-fail/10 border-fail/30 mt-2 border px-3 py-2">
          <p className="text-fail text-xs leading-relaxed">{error}</p>
          {statusCode === 503 || statusCode === 429 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleExtract}
                disabled={loading || (retryIn !== null && retryIn > 0)}
                className="border-fail text-fail inline-flex items-center border bg-white px-3 py-1 text-xs font-medium disabled:opacity-50"
              >
                {retryLabel()}
              </button>
              <span className="text-ink-2 text-[0.6875rem]">{translate('ui.apply.free_text_guided_fallback')}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {info ? <p className="text-pass mt-2 text-xs">{info}</p> : null}
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={handleExtract}
          disabled={loading || !text.trim()}
          className="bg-accent text-paper inline-flex items-center px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? translate('ui.apply.free_text_loading') : translate('ui.apply.free_text_submit')}
        </button>
        <span className="text-ink-3 self-center text-xs">{translate('ui.apply.free_text_or')}</span>
      </div>
      <p className="text-ink-3 mt-2 text-[0.6875rem] leading-relaxed">
        {translate('ui.apply.free_text_demo_note')}
        {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? ` — ${translate('ui.apply.free_text_demo_active')}` : ''}
      </p>
    </div>
  );
}
