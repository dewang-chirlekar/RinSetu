'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { translate } from '@/messages';

export function DeleteApplicationButton({
  id,
  compact,
  onDeleted,
}: {
  id: string;
  compact?: boolean;
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<'idle' | 'confirm' | 'deleting' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function doDelete() {
    setPhase('deleting');
    setError(null);
    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(id)}`, { method: 'DELETE' });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? `Delete failed (${res.status})`);
      if (onDeleted) onDeleted();
      else router.refresh();
      // For detail page redirect case, caller will navigate; for list, refresh shows removal.
      // If no onDeleted and we are on detail, the refresh will still show 404 -> not-found UI.
      // Give a tiny visual before refresh
      setPhase('idle');
      if (!onDeleted) {
        // If this is the detail page and no callback, go to list after delete
        if (window.location.pathname.startsWith('/applications/')) {
          window.location.href = '/applications';
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('error');
    }
  }

  if (phase === 'confirm') {
    return (
      <span className={`inline-flex flex-wrap items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
        <span className="text-ink-2 text-xs">{translate('ui.applications.delete_confirm')}</span>
        <button
          type="button"
          onClick={doDelete}
          className="bg-fail text-paper inline-flex items-center px-3 py-1 text-xs font-medium"
        >
          {translate('ui.applications.delete')}
        </button>
        <button
          type="button"
          onClick={() => setPhase('idle')}
          className="border-rule text-ink inline-flex items-center border bg-white px-3 py-1 text-xs"
        >
          {translate('common.back')}
        </button>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={() => setPhase('confirm')}
        disabled={phase === 'deleting'}
        className={`inline-flex items-center font-medium disabled:opacity-50 ${
          compact
            ? 'border-rule text-ink-2 hover:text-fail border bg-white px-2 py-1 text-xs'
            : 'border-fail text-fail hover:bg-fail hover:text-paper border bg-white px-3 py-1.5 text-xs'
        }`}
        aria-label={translate('ui.applications.delete')}
      >
        {phase === 'deleting' ? translate('ui.applications.deleting') : translate('ui.applications.delete')}
      </button>
      {phase === 'error' && error ? <span className="text-fail text-xs">{translate('ui.applications.delete_error')}: {error}</span> : null}
    </span>
  );
}
