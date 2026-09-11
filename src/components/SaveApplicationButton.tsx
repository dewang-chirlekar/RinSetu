'use client';

import { useState } from 'react';
import { translate } from '@/messages';

export function SaveApplicationButton({ search, schemeCode }: { search: string; schemeCode?: string | null }) {
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [id, setId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setState('saving');
    setError(null);
    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search, schemeCode: schemeCode ?? null }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? `Save failed (${res.status})`);
      if (!data.id) throw new Error('No id returned');
      setId(data.id);
      setState('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  }

  if (state === 'done' && id) {
    return (
      <div className="border-pass bg-pass-soft border-l-[3px] px-3.5 py-3">
        <p className="text-ink text-sm font-medium">{translate('ui.applications.save_done')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <a href={`/applications/${id}`} className="bg-accent text-paper inline-flex items-center px-4 py-2 text-sm font-medium">
            {translate('ui.applications.open')}
          </a>
          <a href="/applications" className="border-rule text-ink inline-flex items-center border bg-white px-4 py-2 text-sm">
            {translate('ui.applications.back_to_list')}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="sheet mt-4 px-4 py-4">
      <h3 className="text-ink font-serif text-sm font-semibold">{translate('ui.applications.save_heading')}</h3>
      <p className="text-ink-2 mt-1 text-xs leading-relaxed">{translate('ui.applications.save_detail')}</p>
      <button
        type="button"
        onClick={handleSave}
        disabled={state === 'saving'}
        className="bg-accent text-paper mt-3 inline-flex items-center px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {state === 'saving' ? translate('ui.applications.saving') : translate('ui.applications.save_action')}
      </button>
      {state === 'error' && error ? <p className="text-fail mt-2 text-xs">{translate('ui.applications.save_error')}: {error}</p> : null}
    </div>
  );
}
