'use client';

import { useState } from 'react';
import { translate } from '@/messages';
import type { ChecklistItem } from '@/core/types';

export function DocumentUpload({
  items,
  onExtracted,
}: {
  items: ChecklistItem[];
  onExtracted?: (profilePatch: Record<string, unknown>) => void;
}) {
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const required = items.filter((it) => it.mandatory);

  function onFileChange(docCode: string, file: File | null) {
    setFiles((prev) => ({ ...prev, [docCode]: file }));
    setError(null);
    setSuccess(null);
  }

  async function handleExtract() {
    const toUpload = required.filter((it) => files[it.doc_code]);
    if (toUpload.length === 0) {
      setError(translate('ui.upload.no_file'));
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const filePayloads = await Promise.all(
        toUpload.map(async (item) => {
          const file = files[item.doc_code]!;
          const dataBase64 = await fileToBase64(file);
          return {
            name: file.name,
            mimeType: file.type || 'application/octet-stream',
            dataBase64,
            docCodeHint: item.doc_code,
          };
        }),
      );
      const res = await fetch('/api/extract-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          files: filePayloads,
          requiredDocCodes: required.map((it) => it.doc_code),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Extract failed');
      setSuccess(translate('ui.upload.extracted'));
      if (onExtracted) onExtracted(data);
      // Optionally, trigger a page reload with new profile via query string
      // For now, just show success; parent can handle merging
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="border-rule bg-paper-sunk mt-3 border p-3">
      <h4 className="text-ink font-serif text-sm font-semibold">{translate('ui.upload.heading')}</h4>
      <p className="text-ink-2 mt-1 text-xs leading-relaxed">{translate('ui.upload.hint')}</p>
      <p className="text-ink-3 mt-1 text-[0.6875rem]">{translate('ui.upload.only_required')}</p>

      <ul className="mt-3 space-y-3">
        {required.map((item) => (
          <li key={item.doc_code} className="border-rule bg-paper-edge border p-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-ink text-xs font-medium">{translate(item.name_key)}</span>
              <span className="text-ink-3 text-[0.6875rem]">{translate(item.status === 'HAVE' ? 'checklist.have' : 'checklist.missing')}</span>
            </div>
            <p className="text-ink-3 mt-1 text-[0.6875rem]">{translate(item.where_to_obtain_key)}</p>
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => onFileChange(item.doc_code, e.target.files?.[0] ?? null)}
              className="text-ink mt-2 block w-full text-xs"
            />
            {files[item.doc_code] ? (
              <p className="text-pass mt-1 text-[0.6875rem]">{files[item.doc_code]!.name} — {translate('ui.upload.selected')}</p>
            ) : null}
          </li>
        ))}
      </ul>

      {error ? <p className="text-fail mt-2 text-xs">{error}</p> : null}
      {success ? <p className="text-pass mt-2 text-xs">{success}</p> : null}

      <button
        type="button"
        onClick={handleExtract}
        disabled={loading}
        className="bg-accent text-paper mt-3 inline-flex items-center px-4 py-2 text-sm font-medium disabled:opacity-50"
      >
        {loading ? translate('ui.upload.extracting') : translate('ui.upload.extract_action')}
      </button>
      <p className="text-ink-3 mt-2 text-[0.6875rem] leading-relaxed">{translate('ui.upload.gemini_note')}</p>
    </div>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // result is data: URL like data:image/png;base64,xxx — strip prefix
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}
