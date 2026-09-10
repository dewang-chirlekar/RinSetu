/**
 * scripts/verify-report.ts
 *
 * Generates VERIFY.md from the data, so the document cannot drift away from the
 * figures it describes.
 *
 *   npm run verify:report            rewrite VERIFY.md
 *   npm run verify:report -- --check exit 1 if VERIFY.md is out of date
 *
 * CLAUDE.md invariant 2 requires every unverified value to be listed in
 * VERIFY.md. A hand-maintained list would be wrong within a week — someone adds
 * a placeholder and forgets the doc — so the list is derived from
 * unverifiedFigures(), which in turn derives `verified` from isCitable(). The
 * only way to shorten VERIFY.md is to transcribe a real guideline.
 *
 * The file deliberately carries NO timestamp. A generated-at line would make
 * `--check` fail on every run and the check would be turned off within a day.
 * Git already records when it changed.
 *
 * The script also re-checks a handful of structural claims the document makes
 * about the engine (the P06 gap, single-scheme eligibility, the unreachable
 * SERVICED treatment). If one of them stops being true, the script exits
 * non-zero rather than writing a document that says something false.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { recommend } from '../src/core/recommend';
import { PROVENANCE_SOURCES, isCitable } from '../src/core/types';
import {
  loadBundle,
  loadHealthMap,
  loadPartners,
  loadPersonas,
  loadSchemeDataset,
  unverifiedFigures,
  type UnverifiedFigure,
} from '../src/lib/dataset';
import schemesSeed from '../data/schemes.seed.json';

const OUTPUT_PATH = 'VERIFY.md';

/**
 * recommend() stamps its result with the clock the caller supplies. A real clock
 * here would change the output on every run and make `--check` meaningless, so
 * the checks below run against a fixed instant. Nothing in this document quotes
 * it.
 */
const FIXED_CLOCK = '2026-01-01T00:00:00.000Z';

/* ------------------------------------------------------------------------- */
/* Structural claims this document makes, re-checked on every run            */
/* ------------------------------------------------------------------------- */

interface Finding {
  id: string;
  title: string;
  detail: string;
  /** Returns null when the claim still holds, or a reason when it does not. */
  check: () => string | null;
}

const bundle = loadBundle({ applyOverlay: true });
const personas = loadPersonas();

function resultFor(id: string) {
  // Through the loader, so the applicant is the same Zod-parsed object the app
  // would see rather than the raw fixture JSON.
  const persona = personas.find((entry) => entry.id === id);
  if (!persona) throw new Error(`No persona ${id} in data/personas.fixtures.json`);
  return recommend({
    applicant: persona.applicant,
    dataset: bundle.dataset,
    partners: bundle.partners,
    health: bundle.health,
    healthConfig: bundle.healthConfig,
    documentDefinitions: bundle.documentDefinitions,
    documentRequirements: bundle.documentRequirements,
    generatedAt: FIXED_CLOCK,
  });
}

const FINDINGS: Finding[] = [
  {
    id: 'F1',
    title: 'A manufacturing project costing exactly ₹1,40,000 qualifies for no scheme',
    detail:
      'Persona P06. MICRO rejects the purpose (manufacturing is not in its eligible_purposes) and ' +
      'TERM rejects the cost (₹1,40,000 is one rupee below its floor). This is a finding about the ' +
      'seed parameters, not a defect in the engine: with disjoint purpose lists and a floor set one ' +
      'rupee above the micro ceiling, an applicant can fall between the two schemes. Either the real ' +
      'guidelines overlap at this boundary or the boundary genuinely excludes this applicant, and we ' +
      'cannot tell which until open question 7 is answered. Whichever it is, the engine reports it ' +
      'honestly today: two rejections, each with its own reason code and remediation.',
    check: () => {
      const result = resultFor('P06');
      if (result.schemes.some((scheme) => scheme.status === 'ELIGIBLE')) {
        return 'P06 now matches a scheme — the parameters changed and this finding is stale.';
      }
      const micro = result.schemes.find((scheme) => scheme.scheme_code === 'MICRO');
      const term = result.schemes.find((scheme) => scheme.scheme_code === 'TERM');
      const failed = (code: string, target: typeof micro) =>
        target?.verdicts.some(
          (verdict) => verdict.code === code && verdict.evaluable && !verdict.passed,
        ) ?? false;
      if (!failed('PURPOSE_ELIGIBLE', micro)) return 'MICRO no longer fails on PURPOSE_ELIGIBLE.';
      if (!failed('PROJECT_COST_ABOVE_MICRO_FLOOR', term)) {
        return 'TERM no longer fails on PROJECT_COST_ABOVE_MICRO_FLOOR.';
      }
      return null;
    },
  },
  {
    id: 'F2',
    title: 'One applicant (P41) is eligible for two schemes at once — the ranking policy is live',
    detail:
      'P41 tailoring 90k is ELIGIBLE for both MICRO (6.5% via SCA) and AMY (15% via NBFC-MFI) — they share PLACEHOLDER_tailoring and the same 1.40L/1.25L ceiling. The remaining 40 personas stay single-eligible to keep snapshots stable. Ranking in src/core/recommend.ts (RECOMMENDATION_POLICY: largest share → lower rate → code) now fires on real data via P41 and is visible in the UI (MICRO recommended, AMY ELIGIBLE collapsed). If more overlaps are added, review the policy copy in SchemeCard.tsx.',
    check: () => {
      const expectedMulti = new Set(['P41']);
      for (const persona of personas) {
        const result = resultFor(persona.id);
        const eligible = result.schemes.filter((scheme) => scheme.status === 'ELIGIBLE');
        const isMulti = eligible.length > 1;
        const shouldBeMulti = expectedMulti.has(persona.id);
        if (isMulti && !shouldBeMulti) {
          return `${persona.id} is now eligible for ${eligible.length} schemes — update expectedMulti in FINDINGS.F2 or fix the purpose overlap.`;
        }
        if (!isMulti && shouldBeMulti) {
          return `${persona.id} should be multi-eligible (${[...expectedMulti].join(', ')}) but is not — the overlap broke.`;
        }
      }
      // Also prove ranking picks the cheaper: P41 should recommend MICRO (6.5% vs 15%)
      const p41 = resultFor('P41');
      if (p41.recommended_scheme_code !== 'MICRO') {
        return `P41 should recommend MICRO (lower rate) but recommends ${p41.recommended_scheme_code} — ranking policy changed.`;
      }
      return null;
    },
  },
  {
    id: 'F3',
    title: 'The SERVICED moratorium treatment is not reachable from any scheme in the data',
    detail:
      'All three seed placeholders are CAPITALISED or WAIVED, and the demo overlay deliberately does ' +
      'not override the treatment — which treatment applies is open question 5, and guessing it ' +
      'changes the EMI. SERVICED is implemented and tested directly in tests/finance.golden.test.ts. ' +
      'This line exists so that nobody concludes from the persona output that only two treatments ' +
      'exist.',
    check: () => {
      const treatments = new Set(
        bundle.dataset.schemes.map((scheme) => scheme.moratorium_interest_treatment),
      );
      return treatments.has('SERVICED')
        ? 'A scheme now uses SERVICED — regenerate and drop this finding.'
        : null;
    },
  },
  {
    id: 'F4',
    title: 'The dataset cannot report itself as authoritative, in either load mode',
    detail:
      'figures_authoritative is derived, not stored: it is true only when every figure in play comes ' +
      'from a citable source AND no demo overlay is applied. Both conditions fail today, for two ' +
      'independent reasons, which is deliberate — this is the one flag that must not be capable of ' +
      'silently flipping.',
    check: () => {
      const withOverlay = loadSchemeDataset({ applyOverlay: true });
      const seedOnly = loadSchemeDataset({ applyOverlay: false });
      if (withOverlay.figures_authoritative) return 'The overlaid dataset claims to be authoritative.';
      if (seedOnly.figures_authoritative) {
        return 'The seed-only dataset claims to be authoritative. If every guideline really has been ' +
          'transcribed, delete this finding by hand and say so in the commit message.';
      }
      return null;
    },
  },
];

/* ------------------------------------------------------------------------- */
/* Rendering                                                                 */
/* ------------------------------------------------------------------------- */

function cell(value: string | null): string {
  if (value == null || value === '') return '—';
  return value.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim();
}

function table(rows: UnverifiedFigure[]): string[] {
  const lines = ['| field | value in play | source | note |', '| --- | --- | --- | --- |'];
  for (const row of rows) {
    lines.push(
      `| \`${cell(row.field)}\` | ${cell(row.value)} | \`${row.source}\` | ${cell(row.note)} |`,
    );
  }
  return lines;
}

function render(): string {
  const figures = unverifiedFigures({ applyOverlay: true });
  const seedFigures = unverifiedFigures({ applyOverlay: false });
  const dataset = loadSchemeDataset({ applyOverlay: true });
  const partners = loadPartners();
  const health = loadHealthMap();

  const byLocation = new Map<string, UnverifiedFigure[]>();
  for (const figure of figures) {
    const list = byLocation.get(figure.where) ?? [];
    list.push(figure);
    byLocation.set(figure.where, list);
  }

  const overlayCount = figures.filter((figure) => figure.source === 'demo_overlay').length;
  const bySource = new Map<string, number>();
  for (const figure of figures) bySource.set(figure.source, (bySource.get(figure.source) ?? 0) + 1);
  const out: string[] = [];

  out.push('# VERIFY.md — every figure RinSetu cannot yet defend');
  out.push('');
  out.push('<!--');
  out.push('  GENERATED FILE — do not edit by hand.');
  out.push('    regenerate:  npm run verify:report');
  out.push('    check in CI: npm run verify:report -- --check');
  out.push('  Built from data/*.json via unverifiedFigures() in src/lib/dataset.ts.');
  out.push('  No timestamp on purpose, so --check means something. Git records the dates.');
  out.push('-->');
  out.push('');
  out.push(
    'CLAUDE.md invariant 2: no numeric or regulatory value enters this codebase without a source. ' +
      'Where we do not have one, the value stays a placeholder, `verified` stays false, and the ' +
      'figure is listed here. This file is generated from the data, so it cannot fall behind it — ' +
      'the only way to shorten it is to transcribe a published guideline.',
  );
  out.push('');
  out.push('## Where things stand');
  out.push('');
  out.push(
    `- **${figures.length}** unverified figures across **${byLocation.size}** locations, with the demo overlay applied.`,
  );
  out.push(
    `- **${overlayCount}** of those are values the demo overlay supplies purely so the engine can be exercised; the other **${figures.length - overlayCount}** are seed placeholders or paraphrases of the problem statement.`,
  );
  out.push(
    `- With the overlay off, **${seedFigures.length}** figures are unverified — the same slots. Turning the overlay off changes where a value comes from, never whether it can be defended.`,
  );
  out.push(
    `- By source: ${[...bySource.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([source, count]) => `\`${source}\` ${count}`)
      .join(' · ')}.`,
  );
  out.push(
    `- \`figures_authoritative\` is **${dataset.figures_authoritative}** (overlay applied: **${dataset.overlay_applied}**).`,
  );
  out.push(
    `- **${dataset.schemes.filter((scheme) => !scheme.verified).length} of ${dataset.schemes.length}** schemes are unverified.`,
  );
  out.push(
    `- Partner registry: **${partners.length}** partners, all \`${partners[0]?.provenance.source ?? 'unknown'}\`. Health data: **${health.size}** rows, all \`SIMULATED\`.`,
  );
  out.push('');
  out.push('**Nothing in the loan, EMI, subsidy or rate columns of this application may be quoted.**');
  out.push('');

  out.push('## How to read the source column');
  out.push('');
  out.push('| source | citable on a slide? | meaning |');
  out.push('| --- | --- | --- |');
  const LEGEND: Record<string, string> = {
    official_guideline: 'Transcribed from a published scheme guideline, with a URL and a date.',
    design_decision: 'Our own design choice, stated as ours — a weight, a policy, a UI threshold.',
    ps_text: 'Taken from the wording of the problem statement, which is not a guideline.',
    open_data: 'From a public dataset that is not the scheme authority.',
    common_practice: 'What comparable schemes typically do. An assumption, not a rule.',
    placeholder: 'A shape-correct stand-in so the engine can be built. Not a figure.',
    demo_overlay: 'Supplied by data/schemes.demo-overlay.json purely to make the demo run.',
    fabricated: 'Invented by us for a fixture or a test. Never a scheme value.',
  };
  for (const source of PROVENANCE_SOURCES) {
    out.push(
      `| \`${source}\` | ${isCitable(source) ? '**yes**' : 'no' } | ${LEGEND[source] ?? '—'} |`,
    );
  }
  out.push('');

  const globalRows = byLocation.get('global_eligibility') ?? [];
  if (globalRows.length > 0) {
    out.push('## Global eligibility rules');
    out.push('');
    out.push(
      'These apply across all schemes: the income ceiling, the reserved category and the age window.',
    );
    out.push('');
    out.push(...table(globalRows));
    out.push('');
  }

  out.push('## Scheme parameters');
  out.push('');
  for (const scheme of dataset.schemes) {
    const rows = byLocation.get(`scheme:${scheme.code}`) ?? [];
    out.push(`### ${scheme.code} — ${scheme.name_i18n.en ?? scheme.code}`);
    out.push('');
    // The seed carries the literal string "TODO" in source_url for schemes whose
    // guideline we have not found. Render it as the absence it is, rather than as
    // if it were a citation.
    const url = scheme.source_url && scheme.source_url !== 'TODO' ? scheme.source_url : '**none**';
    out.push(
      `\`verified: ${scheme.verified}\` · source_url: ${url} · source_date: ${scheme.source_date ?? '**none**'}`,
    );
    out.push('');
    if (rows.length === 0) {
      out.push('No unverified figures. (If this is unexpected, check the provenance stamps.)');
    } else {
      out.push(...table(rows));
    }
    out.push('');
  }

  out.push('## Partner registry and health data');
  out.push('');
  out.push(
    `The ${partners.length} channel partners in data/partners.seed.json are **fabricated**: plausible ` +
      'institution types, ticket ranges and jurisdictions attached to real city coordinates, so that ' +
      'distance and routing can be built and demonstrated. No branch listed is a real branch, and no ' +
      'ticket range is a real credit policy.',
  );
  out.push('');
  out.push(
    `All ${health.size} health rows in data/partner-health.sim.json carry \`data_origin: "SIMULATED"\`, ` +
      'which is non-nullable precisely so that no screen can render a health figure without saying ' +
      'where it came from. The four weights that combine into the composite score are our own ' +
      'design decision, documented in data/health-scoring.json with a rationale key each, and the ' +
      'UI shows the breakdown rather than only the number.',
  );
  out.push('');
  out.push(
    'Replacing this with a real MIS feed changes `data_origin` to `MIS_UPLOAD` and nothing else — ' +
      'that is the whole reason the field exists.',
  );
  out.push('');

  out.push('## Open questions that must be answered before anything above can be verified');
  out.push('');
  out.push(
    'Transcribed from `open_questions_for_phase_0` in data/schemes.seed.json. These are questions ' +
      'about the schemes, not about the code.',
  );
  out.push('');
  schemesSeed.open_questions_for_phase_0.forEach((question, index) => {
    out.push(`${index + 1}. ${question}`);
  });
  out.push('');

  out.push('## Structural findings');
  out.push('');
  out.push(
    'Consequences of the current parameters, not defects. Each one is re-checked against the engine ' +
      'every time this file is generated; if a claim stops being true the generator fails instead of ' +
      'writing it down.',
  );
  out.push('');
  for (const finding of FINDINGS) {
    out.push(`### ${finding.id} — ${finding.title}`);
    out.push('');
    out.push(finding.detail);
    out.push('');
  }

  out.push('## What "verified" will require');
  out.push('');
  out.push(
    'For each figure above: the published guideline it comes from, as a URL; the date of that ' +
      'document; and the value transcribed into data/schemes.seed.json with `source: ' +
      '"official_guideline"`. `verified` is then **derived** by isCitable() — there is no flag to ' +
      'set, and setting one in the JSON has no effect. When every figure in a scheme is citable, ' +
      'that scheme reports `verified: true`; when every scheme is and the demo overlay is off, ' +
      '`figures_authoritative` becomes true and the not-authoritative banner disappears on its own.',
  );
  out.push('');

  return `${out.join('\n')}\n`;
}

/* ------------------------------------------------------------------------- */
/* Entry point                                                               */
/* ------------------------------------------------------------------------- */

const checkOnly = process.argv.slice(2).includes('--check');

const failures = FINDINGS.map((finding) => ({ finding, reason: finding.check() })).filter(
  (entry) => entry.reason !== null,
);

if (failures.length > 0) {
  console.error('VERIFY.md was not written: a documented finding no longer holds.\n');
  for (const { finding, reason } of failures) {
    console.error(`  ${finding.id} — ${finding.title}`);
    console.error(`     ${reason}\n`);
  }
  console.error('Update FINDINGS in scripts/verify-report.ts, then regenerate.');
  process.exit(1);
}

const content = render();

if (checkOnly) {
  let existing: string | null = null;
  try {
    existing = readFileSync(OUTPUT_PATH, 'utf8');
  } catch {
    existing = null;
  }
  if (existing === null) {
    console.error(`${OUTPUT_PATH} does not exist. Run: npm run verify:report`);
    process.exit(1);
  }
  if (existing.replace(/\r\n/g, '\n') !== content) {
    console.error(`${OUTPUT_PATH} is out of date with the data. Run: npm run verify:report`);
    process.exit(1);
  }
  console.log(`${OUTPUT_PATH} is up to date.`);
} else {
  writeFileSync(OUTPUT_PATH, content, 'utf8');
  const figures = unverifiedFigures({ applyOverlay: true });
  console.log(
    `Wrote ${OUTPUT_PATH}: ${figures.length} unverified figures, ${FINDINGS.length} structural findings, all re-checked.`,
  );
}
