/**
 * src/components/ui.tsx
 *
 * The small shared pieces. Server components — nothing here needs state.
 *
 * The one that matters is <Provenance>. CLAUDE.md invariant 2 says every figure
 * carries provenance, and the only way a reader can check that is if the screen
 * shows it. So an unverified figure gets a visible red stamp, not a subtle grey
 * hint that a judge would scroll past. The stamp is meant to be slightly
 * annoying to look at; that is the honest state of this dataset today.
 */

import type { CapacityFlag, FieldProvenance, SchemeStatus } from '@/core/types';
import { translate } from '@/messages';
import type { VerdictTone } from '@/lib/view';

/* ------------------------------------------------------------------------- */
/* Provenance                                                                */
/* ------------------------------------------------------------------------- */

/**
 * Renders the honesty marker for one figure.
 *
 * `verified` is derived in src/lib/dataset.ts from the provenance source via
 * isCitable() — it is never read from a seed file, so a data file cannot promote
 * its own numbers by setting a flag. Do not add a prop that overrides it.
 */
export function Provenance({ provenance }: { provenance: FieldProvenance }) {
  const sourceLabel = translate(`provenance.${provenance.source}`);

  if (provenance.verified) {
    return (
      <span className="text-ink-3 text-[0.6875rem]" title={sourceLabel}>
        {sourceLabel}
      </span>
    );
  }

  return (
    <span
      className="stamp text-fail"
      title={`${translate('provenance.unverified_tooltip')} — ${sourceLabel}`}
    >
      {translate('provenance.unverified_marker')}
    </span>
  );
}

/* ------------------------------------------------------------------------- */
/* Status and verdict marks                                                  */
/* ------------------------------------------------------------------------- */

const STATUS_STYLES: Record<SchemeStatus, string> = {
  ELIGIBLE: 'text-pass bg-pass-soft border-pass',
  NOT_ELIGIBLE: 'text-fail bg-fail-soft border-fail',
  INDETERMINATE: 'text-hold bg-hold-soft border-hold',
};

export function StatusPill({ status }: { status: SchemeStatus }) {
  return (
    <span
      className={`stamp stamp-tilt ${STATUS_STYLES[status]}`}
      title={translate(`status.${status}_detail`)}
    >
      {translate(`status.${status}`)}
    </span>
  );
}

const TONE_MARKS: Record<VerdictTone, { glyph: string; className: string; label: string }> = {
  PASS: { glyph: '✓', className: 'text-pass border-pass', label: 'Met' },
  FAIL: { glyph: '✗', className: 'text-fail border-fail', label: 'Not met' },
  UNKNOWN: { glyph: '?', className: 'text-hold border-hold', label: 'Not known' },
};

/** A checkbox-style mark, as a paper form would have. */
export function VerdictMark({ tone }: { tone: VerdictTone }) {
  const mark = TONE_MARKS[tone];
  return (
    <span
      aria-label={mark.label}
      role="img"
      className={`inline-flex h-[1.125rem] w-[1.125rem] shrink-0 items-center justify-center border text-[0.75rem] leading-none font-bold ${mark.className}`}
    >
      {mark.glyph}
    </span>
  );
}

/* ------------------------------------------------------------------------- */
/* Layout                                                                    */
/* ------------------------------------------------------------------------- */

export function Section({
  title,
  children,
  aside,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="mt-8">
      <div className="rule-heading mb-3">
        <h2 className="text-ink text-base">{title}</h2>
        {aside ? <span className="shrink-0">{aside}</span> : null}
      </div>
      {children}
    </section>
  );
}

/**
 * One labelled figure. `help` is a short clarification, `provenance` the stamp.
 * `emphasis` pulls out the two or three numbers that answer the user's actual
 * question ("how much, and what do I pay a month").
 */
export function FieldRow({
  label,
  value,
  help,
  provenance,
  emphasis = false,
}: {
  label: string;
  value: React.ReactNode;
  help?: string | null;
  provenance?: FieldProvenance;
  emphasis?: boolean;
}) {
  return (
    <div className="field-row">
      <div className="min-w-0">
        <div className={`${emphasis ? 'text-ink font-medium' : 'text-ink-2'} text-sm`}>{label}</div>
        {help ? <div className="text-ink-3 mt-0.5 text-xs">{help}</div> : null}
      </div>
      <div className="flex shrink-0 items-baseline gap-2 text-right">
        {provenance ? <Provenance provenance={provenance} /> : null}
        <span className={`num ${emphasis ? 'text-ink text-lg font-semibold' : 'text-ink text-sm'}`}>
          {value}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/* Data-origin badge — for anything reading a SIMULATED health row            */
/* ------------------------------------------------------------------------- */

export function DataOriginBadge({ origin }: { origin: 'MIS_UPLOAD' | 'SIMULATED' }) {
  if (origin === 'SIMULATED') {
    return (
      <span className="stamp text-fail" title={translate('health.simulated_detail')}>
        {translate('health.simulated_badge')}
      </span>
    );
  }
  return (
    <span className="text-ink-3 text-[0.6875rem]">{translate('health.mis_upload_badge')}</span>
  );
}

const CAPACITY_STYLES: Record<CapacityFlag, string> = {
  OPEN: 'text-pass',
  CONSTRAINED: 'text-hold',
  CLOSED: 'text-fail',
};

export function CapacityLabel({ flag }: { flag: CapacityFlag }) {
  return (
    <span className={`text-xs ${CAPACITY_STYLES[flag]}`}>{translate(`health.capacity.${flag}`)}</span>
  );
}

/* ------------------------------------------------------------------------- */
/* Buttons and links                                                         */
/* ------------------------------------------------------------------------- */

export function PrimaryLink({
  href,
  children,
  type,
}: {
  href?: string;
  children: React.ReactNode;
  type?: 'submit';
}) {
  const className =
    'bg-accent inline-flex items-center justify-center border border-accent px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90';
  if (type === 'submit') {
    return (
      <button type="submit" className={className}>
        {children}
      </button>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export function SecondaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="border-rule-strong text-ink hover:bg-paper-sunk inline-flex items-center justify-center border px-4 py-2.5 text-sm font-medium"
    >
      {children}
    </a>
  );
}

/**
 * "Show details" / "Hide details" for a <details> summary. The swap is pure CSS
 * (see globals.css), so the label stays correct with JavaScript unavailable.
 */
export function ToggleLabel({ className }: { className?: string }) {
  return (
    <span className={className}>
      <span className="when-closed">{translate('common.show_details')}</span>
      <span className="when-open">{translate('common.hide_details')}</span>
    </span>
  );
}
