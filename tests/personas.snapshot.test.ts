/**
 * tests/personas.snapshot.test.ts
 *
 * ⚠ EVERY NUMBER IN THE SNAPSHOTS THIS FILE WRITES IS NON-AUTHORITATIVE.
 *
 * They are computed correctly from the parameters currently in play, and those
 * parameters are placeholders plus a loudly-labelled demo overlay (see
 * data/schemes.demo-overlay.json and VERIFY.md). Nothing here may be quoted, put
 * on a slide, or read as a scheme figure. When real guideline values land, these
 * snapshots are EXPECTED to change wholesale, and the correct response is to
 * regenerate them — never to adjust the engine so they stay put.
 *
 * What they are for: a regression net with a readable diff. Forty personas, each
 * exercising eligibility, remediation, the loan pipeline, partner matching and
 * the checklist. A one-line change in src/core/ that alters any of it shows up
 * here as a specific row, not as a vague failure.
 *
 * Two snapshots, deliberately:
 *
 *   1. the CLI's own stdout, captured by running it — so what a human reads at
 *      `npm run personas` is what is under test, formatting included. Never
 *      hand-written or hand-edited.
 *   2. a compact per-persona digest built from recommend() in-process, which is
 *      what actually fails informatively when a computation changes.
 *
 * Regenerate with:  npx vitest run tests/personas.snapshot.test.ts -u
 */

import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { recommend } from '../src/core/recommend';
import { loadBundle, loadPersonas } from '../src/lib/dataset';

/** The same fixed timestamp scripts/personas.ts uses, so runs diff cleanly. */
const GENERATED_AT = '2026-01-01T00:00:00.000Z';

const personas = loadPersonas();

function runCli(args: string[]): string {
  // `node --import tsx` rather than the npm script: no shell, no platform-
  // specific .cmd shim, and it inherits this process's cwd.
  const stdout = execFileSync(process.execPath, ['--import', 'tsx', 'scripts/personas.ts', ...args], {
    encoding: 'utf8',
    // Capture stderr instead of inheriting it, so the expected-failure test does
    // not print the child's error into the suite output.
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  });
  // Normalise line endings so the snapshot is identical on Windows and CI.
  return stdout.replace(/\r\n/g, '\n').trimEnd();
}

/**
 * One line per persona × scheme. Every value comes from the engine; none is
 * written by hand. Deliberately terse so a diff is readable in a terminal.
 */
function digest(applyOverlay: boolean): string {
  const bundle = loadBundle({ applyOverlay });
  const lines: string[] = [];
  for (const persona of personas) {
    const result = recommend({
      applicant: persona.applicant,
      dataset: bundle.dataset,
      partners: bundle.partners,
      health: bundle.health,
      healthConfig: bundle.healthConfig,
      documentDefinitions: bundle.documentDefinitions,
      documentRequirements: bundle.documentRequirements,
      generatedAt: GENERATED_AT,
    });
    lines.push(`${persona.id}  recommended=${result.recommended_scheme_code ?? 'none'}`);
    for (const scheme of result.schemes) {
      const parts = [
        `  ${scheme.scheme_code.padEnd(6)}`,
        scheme.status.padEnd(15),
        `fail=${scheme.verdicts.filter((v) => v.evaluable && !v.passed).length}`,
        `unknown=${scheme.verdicts.filter((v) => !v.evaluable).length}`,
        `rem=${scheme.remediations.length}`,
      ];
      if (scheme.computation == null) {
        parts.push('figures=n/a');
      } else if (!scheme.computation.computable) {
        parts.push(`figures=blocked[${scheme.computation.missing.join(',')}]`);
      } else {
        const figures = scheme.computation;
        parts.push(
          `loan=${figures.loan}`,
          `own=${figures.own_contribution}`,
          `subsidy=${figures.subsidy}`,
          `rate=${figures.annual_rate_pct}`,
          `emi=${figures.schedule.emi}`,
          `outflow=${figures.schedule.totals.total_outflow}`,
          `rows=${figures.schedule.rows.length}`,
          `bind=${figures.binding_constraint}`,
        );
      }
      if (scheme.partners != null) {
        parts.push(
          `partners=${scheme.partners.eligible.length}/${scheme.partners.eligible.length + scheme.partners.excluded.length}`,
          `nearest=${scheme.partners.ranked_by_distance[0]?.partner.code ?? 'none'}`,
          `healthiest=${scheme.partners.ranked_by_health[0]?.partner.code ?? 'none'}`,
        );
      }
      if (scheme.checklist != null) {
        parts.push(
          `docs=${scheme.checklist.mandatory_missing}/${scheme.checklist.mandatory_total}`,
          `ready=${scheme.checklist.ready}`,
        );
      }
      lines.push(parts.join(' '));
    }
  }
  return lines.join('\n');
}

describe('the persona CLI', () => {
  // The only test in the suite that spawns a process, hence the raised timeout.
  // Everything else in tests/ is pure and must stay under the 5s global limit.
  it('prints a stable summary table for all 40 personas', { timeout: 30_000 }, () => {
    const output = runCli([]);
    expect(output).toMatchSnapshot();
  });

  it('prints a stable table against the seed alone, with no overlay', { timeout: 30_000 }, () => {
    // This is the run that shows how much of the engine is currently blocked on
    // unpublished figures. If it ever starts producing loans, either a real
    // guideline landed in the seed (good, regenerate) or something is inventing
    // a parameter (bad, stop).
    const output = runCli(['--no-overlay']);
    expect(output).toMatchSnapshot();
  });

  it('prints a stable detail view for P19', { timeout: 30_000 }, () => {
    // P19 is the widest single row: a full amortisation schedule with a
    // moratorium, and every partner excluded with reasons.
    const output = runCli(['P19']);
    expect(output).toMatchSnapshot();
  });

  it('says out loud that the figures are not authoritative', () => {
    // The label is not decoration. If this ever disappears the snapshots above
    // become quotable-looking, which is the failure mode CLAUDE.md invariant 2
    // exists to prevent.
    const output = runCli([]);
    expect(output.toLowerCase()).toMatch(/not.*(verified|authoritative)|do not quote/);
  });

  it('prints one row per persona and no more', () => {
    const output = runCli([]);
    const ids = personas.map((persona) => persona.id);
    expect(ids).toHaveLength(40);
    for (const id of ids) {
      // One occurrence, at the start of a line.
      const matches = output.split('\n').filter((line) => line.startsWith(id));
      expect(matches, `${id} appeared ${matches.length} times`).toHaveLength(1);
    }
  });

  it('exits non-zero and names the valid ids for an unknown persona', () => {
    let failed = false;
    try {
      runCli(['P99']);
    } catch (error) {
      failed = true;
      const stderr = String((error as { stderr?: string }).stderr ?? '');
      expect(stderr).toContain('P99');
      expect(stderr).toContain('P01');
    }
    expect(failed).toBe(true);
  });
});

describe('the engine digest', () => {
  it('is stable with the demo overlay applied', () => {
    expect(digest(true)).toMatchSnapshot();
  });

  it('is stable against the seed alone', () => {
    expect(digest(false)).toMatchSnapshot();
  });

  it('produces the same digest twice, since the core reads no clock and no random', () => {
    expect(digest(true)).toBe(digest(true));
  });

  it('never reports a loan of any kind when the seed has no figures of its own', () => {
    // Stated as an assertion rather than left to the snapshot, because this is
    // the one property that must hold no matter how the snapshot is regenerated:
    // without the overlay there is nothing to price with.
    //
    // Note the shape of the answer. Seed-only, no scheme reaches ELIGIBLE at all
    // — the missing parameters make the cost predicates unevaluable, so the
    // status is INDETERMINATE and recommend() never calls computeLoan, giving
    // `figures=n/a` rather than `figures=blocked`. The blocked case (eligible but
    // unpriceable) is reachable only with a dataset that states its eligibility
    // rules and withholds its money figures, which is what tests/loan.test.ts
    // constructs directly.
    const seedDigest = digest(false);
    expect(seedDigest).toContain('figures=n/a');
    expect(seedDigest).not.toMatch(/\bemi=\d/);
    expect(seedDigest).not.toMatch(/\bloan=\d/);
    expect(seedDigest).not.toMatch(/recommended=(MICRO|TERM|EDU)/);
  });
});
