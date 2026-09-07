'use client';

/**
 * src/components/AdminHealthUpload.tsx
 *
 * Client UI for /admin/health-upload. Handles file selection, preview via
 * /api/admin/health-preview, and commit via /api/admin/health-apply.
 *
 * Mobile-first at 360px, no assumption of desktop. All feedback is inline
 * (no toast library) so it works with JS but degrades visibly if an API
 * is unreachable.
 */

import { useState } from 'react';

interface PreviewRow {
  line: number;
  raw: Record<string, string>;
  valid: boolean;
  errors: string[];
  record?: {
    partner_code: string;
    funds_sanctioned: number;
    funds_utilised: number;
    overdue_amount: number;
    npa_pct: number;
    avg_processing_days: number;
    capacity_flag: string;
    data_origin: string;
    as_of: string;
  };
}

interface PreviewResult {
  rows: PreviewRow[];
  errors: { line: number; message: string }[];
  validCount: number;
  invalidCount: number;
  asOfFallback: string;
}

export function AdminHealthUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyResult, setApplyResult] = useState<{ inserted: number; updated: number } | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);

  async function handlePreview() {
    if (!file) return;
    setPreviewLoading(true);
    setPreviewError(null);
    setPreview(null);
    setApplyResult(null);
    setApplyError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/admin/health-preview', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) {
        setPreviewError(data.error ?? 'Preview failed');
        return;
      }
      setPreview(data as PreviewResult);
    } catch (e) {
      setPreviewError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleApply() {
    if (!preview || preview.validCount === 0) return;
    setApplyLoading(true);
    setApplyError(null);
    setApplyResult(null);
    try {
      const res = await fetch('/api/admin/health-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: preview.rows.filter((r) => r.valid).map((r) => r.record) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApplyError(data.error ?? 'Apply failed');
        return;
      }
      setApplyResult(data);
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplyLoading(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Template + instructions */}
      <div className="sheet px-4 py-4">
        <h2 className="text-ink font-serif text-sm font-semibold">Upload health CSV</h2>
        <p className="text-ink-2 mt-1 text-xs leading-relaxed">
          Replacement for the simulated seed. Expected columns: <span className="num text-ink-3">partner_code, funds_sanctioned, funds_utilised, overdue_amount, npa_pct, avg_processing_days, capacity_flag, as_of</span>
          . <span className="font-medium">as_of</span> is optional (defaults to today, YYYY-MM-DD). Every uploaded row is stored as <span className="stamp text-pass">MIS_UPLOAD</span>.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="/api/admin/health-template"
            className="border-rule-strong text-ink hover:bg-paper-sunk inline-flex items-center border px-3 py-2 text-xs font-medium"
            download
          >
            Download template CSV
          </a>
        </div>
        <p className="text-ink-3 mt-2 text-[0.6875rem]">
          Tip: export from your MIS with exactly these headers. Quoted fields and commas inside numbers (e.g. “1,20,00,000”) are accepted.
        </p>
      </div>

      {/* File picker */}
      <div className="sheet px-4 py-4">
        <label className="text-ink text-xs font-medium" htmlFor="health-csv-file">
          Choose CSV file
        </label>
        <input
          id="health-csv-file"
          type="file"
          accept=".csv,text/csv"
          className="mt-2 block w-full text-xs file:mr-3 file:border file:border-rule-strong file:bg-paper-sunk file:px-3 file:py-2 file:text-xs file:font-medium file:text-ink"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setPreview(null);
            setPreviewError(null);
            setApplyResult(null);
            setApplyError(null);
          }}
        />
        <button
          type="button"
          onClick={handlePreview}
          disabled={!file || previewLoading}
          className="bg-accent text-paper mt-3 inline-flex items-center px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {previewLoading ? 'Checking…' : 'Preview'}
        </button>
        {previewError ? <p className="text-fail mt-2 text-xs">{previewError}</p> : null}
      </div>

      {/* Preview */}
      {preview ? (
        <div className="sheet px-4 py-4">
          <h3 className="text-ink font-serif text-sm font-semibold">
            Preview — {preview.validCount} valid, {preview.invalidCount} invalid
          </h3>
          {preview.errors.length > 0 ? (
            <div className="border-fail bg-fail-soft mt-2 border-l-[3px] px-3 py-2">
              <p className="text-fail text-xs font-medium">Issues</p>
              <ul className="mt-1 list-disc pl-4 text-xs leading-relaxed">
                {preview.errors.slice(0, 20).map((e, idx) => (
                  <li key={`${e.line}-${idx}`} className="text-ink-2">
                    Line {e.line}: {e.message}
                  </li>
                ))}
                {preview.errors.length > 20 ? <li className="text-ink-3">…and {preview.errors.length - 20} more</li> : null}
              </ul>
            </div>
          ) : (
            <p className="text-pass mt-2 text-xs">No header errors. All rows validated against the partner registry.</p>
          )}

          {/* Table — scrolls horizontally at 360px */}
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead>
                <tr className="border-rule text-ink-3 border-b text-[0.6875rem] uppercase tracking-wider">
                  <th className="py-2 pr-2">Line</th>
                  <th className="py-2 pr-2">Partner</th>
                  <th className="py-2 pr-2 text-right">Sanctioned</th>
                  <th className="py-2 pr-2 text-right">Utilised</th>
                  <th className="py-2 pr-2 text-right">Overdue</th>
                  <th className="py-2 pr-2 text-right">NPA%</th>
                  <th className="py-2 pr-2 text-right">Days</th>
                  <th className="py-2 pr-2">Flag</th>
                  <th className="py-2 pr-2">As of</th>
                  <th className="py-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-rule divide-y">
                {preview.rows.map((row) => (
                  <tr key={row.line} className={row.valid ? '' : 'bg-fail-soft'}>
                    <td className="num text-ink-3 py-2 pr-2">{row.line}</td>
                    <td className="num py-2 pr-2">{row.raw.partner_code ?? '—'}</td>
                    <td className="num py-2 pr-2 text-right">{row.raw.funds_sanctioned ?? '—'}</td>
                    <td className="num py-2 pr-2 text-right">{row.raw.funds_utilised ?? '—'}</td>
                    <td className="num py-2 pr-2 text-right">{row.raw.overdue_amount ?? '—'}</td>
                    <td className="num py-2 pr-2 text-right">{row.raw.npa_pct ?? '—'}</td>
                    <td className="num py-2 pr-2 text-right">{row.raw.avg_processing_days ?? '—'}</td>
                    <td className="py-2 pr-2">{row.raw.capacity_flag ?? '—'}</td>
                    <td className="num py-2 pr-2">{row.raw.as_of ?? preview.asOfFallback}</td>
                    <td className="py-2">
                      {row.valid ? (
                        <span className="stamp text-pass">OK → MIS_UPLOAD</span>
                      ) : (
                        <span className="stamp text-fail" title={row.errors.join('; ')}>
                          {row.errors[0] ?? 'invalid'}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button
            type="button"
            onClick={handleApply}
            disabled={preview.validCount === 0 || applyLoading}
            className="bg-accent text-paper mt-4 inline-flex items-center px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {applyLoading ? 'Writing…' : `Apply ${preview.validCount} row(s) to database`}
          </button>
          <p className="text-ink-3 mt-1.5 text-[0.6875rem]">
            Writes <span className="font-medium">latest row per partner</span> to Postgres. Existing <span className="stamp text-pass">MIS_UPLOAD</span> history is kept; the newest <span className="num">as_of</span> is what the ranking reads.
          </p>
          {applyError ? <p className="text-fail mt-2 text-xs">{applyError}</p> : null}
          {applyResult ? (
            <p className="text-pass mt-2 text-xs">
              Done — {applyResult.inserted} inserted, {applyResult.updated} updated. Reload <a href="/result" className="underline">/result</a> to see the new ranking badge.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
