'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate } from '@/messages';
import { applicantToParams } from '@/lib/applicant-params';

export function FreeTextIntake() {
  const router = useRouter();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [info, setInfo] = useState<string | null>(null);

  async function handleExtract() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setInfo(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errMsg = typeof payload.error === 'string' ? payload.error : `Extract failed (${res.status})`;
        // 429 quota — show the friendly message from the API (already translated prefix in en/hi/mr via error string)
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
      const msg = e instanceof Error ? e.message : typeof e === 'object' && e !== null && 'type' in (e as Record<string, unknown>) ? `Network error (${String((e as { type?: string }).type)}) — please retry` : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
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
      {error ? <p className="text-fail mt-2 text-xs">{error}</p> : null}
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
        {process.env.NEXT_PUBLIC_DEMO_MODE === 'true' ? ' — DEMO MODE: fixture cache active, no API key needed.' : ''}
      </p>
    </div>
  );
}
