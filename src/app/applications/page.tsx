/**
 * src/app/applications/page.tsx
 *
 * List of saved applications. Each row shows the receipt as stored —
 * not re-computed — so reopening in six months still shows the numbers
 * that were actually given that day.
 */

import { getLocale } from 'next-intl/server';
import { translate, type Locale } from '@/messages';
import { getPrisma, hasDatabaseUrl, isDbUnreachableError } from '@/lib/db';
import { longDateTime } from '@/lib/format';

export const dynamic = 'force-dynamic';

function formatDate(iso: string): string {
  try {
    return longDateTime(iso);
  } catch {
    return iso;
  }
}

export default async function ApplicationsPage() {
  const locale = (await getLocale()) as Locale;
  (globalThis as unknown as { __RINSETU_LOCALE__?: string }).__RINSETU_LOCALE__ = locale;
  const t = (k: string, v?: Record<string, string | number | null | undefined>) => translate(k, v, locale);

  if (!hasDatabaseUrl()) {
    return (
      <div>
        <h1 className="text-ink font-serif text-2xl font-semibold">{t('ui.applications.heading')}</h1>
        <p className="text-ink-2 mt-2 text-sm leading-relaxed">{t('ui.applications.lede')}</p>
        <div className="border-hold bg-hold-soft mt-6 border-l-[3px] px-3.5 py-3">
          <p className="text-ink text-sm font-medium">{t('ui.applications.needs_db_heading')}</p>
          <p className="text-ink-2 mt-1 text-xs leading-relaxed">{t('ui.applications.needs_db_detail')}</p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <a href="/apply" className="bg-accent text-paper inline-flex items-center px-4 py-2 text-sm font-medium">
            {t('ui.nav.apply')}
          </a>
          <a href="/personas" className="border-rule text-ink inline-flex items-center border bg-white px-4 py-2 text-sm">
            {t('ui.nav.personas')}
          </a>
        </div>
      </div>
    );
  }

  let rows: {
    id: string;
    schemeCode: string | null;
    partnerCode: string | null;
    applicant: unknown;
    datasetLabel: string;
    figuresAuthoritative: boolean;
    status: string;
    createdAt: Date;
  }[] = [];
  let error: string | null = null;

  try {
    const db = getPrisma();
    rows = await db.application.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        schemeCode: true,
        partnerCode: true,
        applicant: true,
        datasetLabel: true,
        figuresAuthoritative: true,
        status: true,
        createdAt: true,
      },
    });
  } catch (e) {
    if (isDbUnreachableError(e)) {
      error = 'Database unreachable — try again, or run with the seeded JSON fallback.';
    } else {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  if (error) {
    return (
      <div>
        <h1 className="text-ink font-serif text-2xl font-semibold">{t('ui.applications.heading')}</h1>
        <div className="border-fail bg-fail-soft border-l-[3px] mt-6 px-3.5 py-3">
          <p className="text-ink text-sm font-medium">{t('ui.applications.save_error')}</p>
          <p className="text-ink-2 mt-1 text-xs">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-ink font-serif text-2xl font-semibold">{t('ui.applications.heading')}</h1>
      <p className="text-ink-2 mt-2 text-sm leading-relaxed">{t('ui.applications.lede')}</p>
      <p className="text-ink-3 mt-1 text-xs">{t('ui.applications.count', { count: rows.length })}</p>

      {rows.length === 0 ? (
        <div className="border-rule bg-paper-sunk mt-6 border px-4 py-6 text-center">
          <p className="text-ink text-sm font-medium">{t('ui.applications.empty_heading')}</p>
          <p className="text-ink-2 mt-1 text-xs leading-relaxed">{t('ui.applications.empty_detail')}</p>
          <a href="/apply" className="bg-accent text-paper mt-4 inline-flex items-center px-4 py-2 text-sm font-medium">
            {t('ui.nav.apply')}
          </a>
        </div>
      ) : (
        <ul className="border-rule mt-5 divide-y divide-[var(--rule)] border-t">
          {rows.map((r) => {
            const applicant = r.applicant as { name?: string | null; intent?: string; purpose?: string | null; project_cost?: number | null; state?: string | null; district?: string | null };
            const title = applicant.name?.trim() ? applicant.name : t('common.unknown');
            const sub = [applicant.state, applicant.district].filter(Boolean).join(', ') || t('ui.apply.unset');
            return (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <a href={`/applications/${r.id}`} className="text-accent text-sm font-medium hover:underline">
                    {title}
                  </a>
                  <span className="text-ink-3 font-mono text-xs">{r.id.slice(0, 8)}</span>
                  {r.schemeCode ? <span className="stamp text-ink-2">{r.schemeCode}</span> : <span className="text-ink-3 text-xs">{t('recommendation.none')}</span>}
                  <span className="text-ink-3 ml-auto text-xs">{formatDate(r.createdAt.toISOString())}</span>
                </div>
                <p className="text-ink-3 mt-1 text-xs leading-relaxed">
                  {[sub, applicant.purpose ? applicant.purpose : null, applicant.project_cost != null ? `₹${Number(applicant.project_cost).toLocaleString('en-IN')}` : null].filter(Boolean).join(' · ')}
                </p>
                <div className="mt-2 flex gap-3 text-xs">
                  <a href={`/applications/${r.id}`} className="text-accent hover:underline">
                    {t('ui.applications.open')}
                  </a>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
