/**
 * scripts/personas.ts
 *
 * Runs all 40 personas through the deterministic core and prints one row each.
 *
 *   npm run personas              summary table
 *   npm run personas -- P19       full detail for one persona
 *   npm run personas -- --no-overlay
 *                                 run against the seed alone, so you can see
 *                                 exactly how much of the engine is currently
 *                                 blocked on unpublished figures
 *
 * This is the fastest honest check that the engine works. It exercises
 * eligibility, remediation, the loan pipeline, partner matching and the document
 * checklist in one command, with no server, no database and no model.
 */

import { recommend } from '../src/core/recommend';
import { loadBundle, loadPersonas } from '../src/lib/dataset';
import { translate, translateOptional } from '../src/messages';
import type { RecommendationResult, SchemeRecommendation } from '../src/core/types';

/* Fixed timestamp so two runs of this script diff cleanly. */
const GENERATED_AT = '2026-01-01T00:00:00.000Z';

const argv = process.argv.slice(2);
const applyOverlay = !argv.includes('--no-overlay');
const only = argv.find((arg) => /^P\d\d$/i.test(arg))?.toUpperCase();

const bundle = loadBundle({ applyOverlay });
const personas = loadPersonas();

function pad(value: string, width: number): string {
  const clean = value.length > width ? `${value.slice(0, width - 1)}…` : value;
  return clean.padEnd(width, ' ');
}

function padLeft(value: string, width: number): string {
  const clean = value.length > width ? value.slice(0, width) : value;
  return clean.padStart(width, ' ');
}

function rupees(value: number | null): string {
  if (value == null) return '—';
  return value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

const STATUS_GLYPH: Record<string, string> = {
  ELIGIBLE: 'YES',
  NOT_ELIGIBLE: 'no ',
  INDETERMINATE: '?  ',
};

function schemeOf(result: RecommendationResult, code: string): SchemeRecommendation | undefined {
  return result.schemes.find((entry) => entry.scheme_code === code);
}

/* ------------------------------------------------------------------------- */
/* Detail view                                                               */
/* ------------------------------------------------------------------------- */

function printDetail(id: string, result: RecommendationResult): void {
  const persona = personas.find((entry) => entry.id === id);
  // The caller has already checked the id and printed the available list, so
  // this is an internal invariant rather than a second user-facing message.
  if (!persona) throw new Error(`printDetail called with unknown persona '${id}'.`);

  console.log(`\n${id} — ${persona.label}`);
  console.log(`Tests: ${persona.tests.join('; ')}`);
  console.log(
    `Dataset: ${translate(result.dataset.label)}  authoritative=${result.dataset.figures_authoritative}`,
  );
  const applicant = persona.applicant;
  console.log(
    `Applicant: age ${applicant.age ?? '—'}, ${applicant.category}, income ${rupees(applicant.annual_family_income)}, ` +
      `${applicant.district ?? '—'} (${applicant.state ?? '—'}), purpose ${applicant.purpose ?? '—'}, ` +
      `cost ${rupees(applicant.project_cost)}`,
  );

  for (const scheme of result.schemes) {
    console.log(`\n  ── ${scheme.scheme_code} ${'─'.repeat(Math.max(0, 60 - scheme.scheme_code.length))}`);
    console.log(`  status: ${scheme.status}`);

    for (const verdict of scheme.verdicts) {
      const mark = verdict.passed ? 'pass' : verdict.evaluable ? 'FAIL' : '?   ';
      console.log(
        `    [${mark}] ${pad(verdict.code, 32)} ${translate(verdict.messageKey, {
          actual: verdict.actual === null ? '—' : String(verdict.actual),
          required: Array.isArray(verdict.required)
            ? verdict.required.join(', ')
            : verdict.required === null
              ? '—'
              : String(verdict.required),
        })}`,
      );
      if (verdict.missing && verdict.missing.length > 0) {
        console.log(`           missing: ${verdict.missing.join(', ')}`);
      }
    }

    if (scheme.remediations.length > 0) {
      console.log('    remediation:');
      for (const remediation of scheme.remediations) {
        console.log(
          `      ${pad(remediation.kind, 18)} ${translate(remediation.messageKey, {
            delta: remediation.delta != null ? rupees(remediation.delta) : undefined,
            target: remediation.target != null ? String(remediation.target) : undefined,
            fields: remediation.alternatives?.join(', '),
            alternatives: remediation.alternatives?.join(', '),
          })}`,
        );
      }
    }

    if (scheme.computation && !scheme.computation.computable) {
      console.log(`    NOT COMPUTABLE — missing: ${scheme.computation.missing.join(', ')}`);
    }

    if (scheme.computation?.computable) {
      const figures = scheme.computation;
      console.log(
        `    cost ${rupees(figures.project_cost)} → eligible ${rupees(figures.eligible_cost)} ` +
          `(${figures.cost_ceiling_source})`,
      );
      console.log(
        `    subsidy ${rupees(figures.subsidy)} (${figures.subsidy_timing})  ` +
          `margin ${(figures.margin_pct * 100).toFixed(1)}% = ${rupees(figures.own_contribution)}`,
      );
      console.log(
        `    gross ${rupees(figures.gross_loan)} → LOAN ${rupees(figures.loan)}  ` +
          `limited by ${figures.binding_constraint}` +
          (figures.loan_below_min ? `  (below scheme minimum ${rupees(figures.min_loan)})` : ''),
      );
      console.log(
        `    rate ${figures.annual_rate_pct}%  moratorium ${figures.moratorium_months}m ` +
          `(${figures.schedule.treatment})  repayment ${figures.repayment_months}m`,
      );
      console.log(
        `    EMI ${rupees(figures.schedule.emi)}  total interest ${rupees(figures.schedule.totals.total_interest)}  ` +
          `total outflow ${rupees(figures.schedule.totals.total_outflow)}`,
      );
      const rows = figures.schedule.rows;
      console.log(
        `    schedule: ${rows.length} rows, closing balance ${rupees(rows[rows.length - 1]?.closing_balance ?? 0)}`,
      );
    }

    if (scheme.partners) {
      const nearest = scheme.partners.ranked_by_distance[0];
      const healthiest = scheme.partners.ranked_by_health[0];
      console.log(`    partners: ${scheme.partners.eligible.length} eligible, ${scheme.partners.excluded.length} excluded`);
      if (nearest) {
        console.log(
          `      nearest:    ${pad(nearest.partner.code, 22)} ${nearest.distance_km ?? '—'} km`,
        );
      }
      if (healthiest) {
        console.log(
          `      healthiest: ${pad(healthiest.partner.code, 22)} score ${(healthiest.health?.score ?? 0).toFixed(3)}` +
            ` [${healthiest.health?.data_origin ?? 'no health row'}]`,
        );
      }
      if (scheme.partners.loan_exceeds_all_tickets) {
        console.log(`      ${translate('partner.loan_exceeds_all_tickets')}`);
      }
      for (const exclusion of scheme.partners.excluded) {
        console.log(
          `      excluded ${pad(exclusion.partner.code, 22)} ${exclusion.reasons.map((r) => r.code).join(', ')}`,
        );
      }
    }

    if (scheme.checklist) {
      console.log(
        `    checklist: ${scheme.checklist.mandatory_total} mandatory, ` +
          `${scheme.checklist.mandatory_missing} still to obtain, ready=${scheme.checklist.ready}`,
      );
      for (const item of scheme.checklist.items) {
        const note = translateOptional(item.notes_key);
        console.log(
          `      ${item.status === 'HAVE' ? '✓' : '·'} ${pad(item.doc_code, 18)}` +
            `${item.mandatory ? 'mandatory' : 'optional '} ${pad(item.required_by, 13)}` +
            `${translate(`doc.${item.doc_code}.name`)}${note ? ` — ${note}` : ''}`,
        );
      }
    }
  }

  console.log(`\n  recommended: ${result.recommended_scheme_code ?? 'none'}\n`);
}

/* ------------------------------------------------------------------------- */
/* Summary table                                                             */
/* ------------------------------------------------------------------------- */

function printSummary(results: { id: string; label: string; result: RecommendationResult }[]): void {
  const header =
    `${pad('ID', 5)}${pad('Persona', 46)}${pad('MICRO', 6)}${pad('TERM', 6)}${pad('EDU', 6)}` +
    `${pad('Rec', 6)}${padLeft('Loan', 11)}${padLeft('EMI', 9)}${padLeft('Rate', 6)}` +
    `${padLeft('Ptnr', 6)}${padLeft('Docs', 7)}`;
  console.log(header);
  console.log('─'.repeat(header.length));

  let eligibleCount = 0;
  let notComputable = 0;
  let zeroPartners = 0;

  for (const { id, label, result } of results) {
    const micro = schemeOf(result, 'MICRO');
    const term = schemeOf(result, 'TERM');
    const edu = schemeOf(result, 'EDU');
    const recommended = result.recommended_scheme_code
      ? schemeOf(result, result.recommended_scheme_code)
      : undefined;

    const figures =
      recommended?.computation?.computable === true ? recommended.computation : null;
    if (recommended?.computation && !recommended.computation.computable) notComputable += 1;
    if (recommended) eligibleCount += 1;

    const partnerCount = recommended?.partners ? recommended.partners.eligible.length : null;
    if (recommended && partnerCount === 0) zeroPartners += 1;

    const docs = recommended?.checklist
      ? `${recommended.checklist.mandatory_total - recommended.checklist.mandatory_missing}/${recommended.checklist.mandatory_total}`
      : '—';

    console.log(
      pad(id, 5) +
        pad(label, 46) +
        pad(STATUS_GLYPH[micro?.status ?? ''] ?? '—', 6) +
        pad(STATUS_GLYPH[term?.status ?? ''] ?? '—', 6) +
        pad(STATUS_GLYPH[edu?.status ?? ''] ?? '—', 6) +
        pad(result.recommended_scheme_code ?? '—', 6) +
        padLeft(figures ? rupees(figures.loan) : '—', 11) +
        padLeft(figures ? rupees(figures.schedule.emi) : '—', 9) +
        padLeft(figures ? `${figures.annual_rate_pct}%` : '—', 6) +
        padLeft(partnerCount == null ? '—' : String(partnerCount), 6) +
        padLeft(docs, 7),
    );
  }

  console.log('─'.repeat(header.length));
  console.log(`${results.length} personas`);
  console.log(`  ${eligibleCount} with at least one eligible scheme`);
  console.log(`  ${notComputable} eligible but no figures (missing scheme parameters)`);
  console.log(`  ${zeroPartners} eligible with zero capable partners`);
  console.log(
    `\nDataset: ${translate(results[0].result.dataset.label)}  ` +
      `figures_authoritative=${results[0].result.dataset.figures_authoritative}`,
  );
  for (const note of results[0].result.dataset.notes) {
    console.log(`  ! ${translate(note)}`);
  }
  console.log(
    '\nLoan, EMI and rate columns are illustrative. They are computed correctly from\n' +
      'the parameters in play, and those parameters are placeholders. Do not quote them.\n',
  );
}

/* ------------------------------------------------------------------------- */

const results = personas.map((persona) => ({
  id: persona.id,
  label: persona.label,
  result: recommend({
    applicant: persona.applicant,
    dataset: bundle.dataset,
    partners: bundle.partners,
    health: bundle.health,
    healthConfig: bundle.healthConfig,
    documentDefinitions: bundle.documentDefinitions,
    documentRequirements: bundle.documentRequirements,
    generatedAt: GENERATED_AT,
  }),
}));

if (only) {
  const entry = results.find((candidate) => candidate.id === only);
  if (!entry) {
    console.error(`No persona ${only}. Available: ${personas.map((p) => p.id).join(', ')}`);
    process.exit(1);
  }
  printDetail(only, entry.result);
} else {
  printSummary(results);
}
