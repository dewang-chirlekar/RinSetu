# PROGRESS.md — where RinSetu stands

Written at the end of Phases 1–2, updated after the Phase 3–6 baseline landed
(`4a8eea7` + `5eb1b1e`), refreshed 2026-08-31 at `bd12a83` on `main`.
Everything below was verified by running it, not remembered. If you have no
context on this project, read this file top to bottom, then read `CLAUDE.md`,
then run the one command in [§8](#8-the-exact-command-to-continue).

> **2026-08-31 refresh:** `bd12a83 handoff & progress(frontend)` is now HEAD.
> `npm run check` still exits 0 (230/230), `npm run build` compiles (8 routes),
> `npm run personas` prints 40 rows. No `src/core/` or `data/` change since
> `b9f34ba` — frontend and docs only. `README.md` rewritten from 58 lines to a
> full setup + architecture doc; this file's §2/§8 updated to the new commit.

---

## 1. What this project is

**RinSetu** — SIH 2026, problem statement **SIH26092**. A web platform that:

1. takes an applicant's details (guided form; free text is an optional enhancement),
2. decides which concessional-credit schemes for Scheduled Caste beneficiaries they
   qualify for — **and, just as importantly, which they do not, and why**,
3. computes the loan, subsidy, margin money, EMI and full amortisation schedule under
   that scheme's own guidelines,
4. routes them to the nearest Channel Partner that can actually process it,
5. hands over a pre-filled application packet and a document checklist.

The whole project is organised around one idea: **the numbers have to be defensible.**
A plausible-looking invented interest rate is the worst possible outcome, worse than no
number at all. Almost every design decision recorded below follows from that.

## 2. Current state: green

Verified 2026-08-31 from `rinsetu/` at `bd12a83` on `main` (clean working tree, `origin/main` up to date):

| check | command | result |
| --- | --- | --- |
| everything | `npm run check` | **exit 0** |
| typecheck | `npm run typecheck` | exit 0 |
| lint | `npm run lint` | exit 0 |
| architecture boundary | `npm run check:boundaries` | passed — `src/core/` imports nothing from `llm/`, `app/`, `components/` |
| VERIFY.md freshness | `npm run check:verify` | up to date |
| tests | `npm run test` | **9 files, 230 tests, all passing** |
| demo CLI | `npm run personas` | prints 40 rows (23 eligible), EMI column populated |
| dev server | `npm run dev` | renders `/`, `/apply`, `/result`, `/personas` |
| prod build | `npm run build` | compiled, 8 routes, First Load JS 103 kB |

Per-file test counts (they should only ever go up):

```
 45  tests/eligibility.branches.test.ts
 44  tests/finance.golden.test.ts
 33  tests/loan.test.ts
 23  tests/dataset.honesty.test.ts
 21  tests/health.test.ts
 19  tests/partners.match.test.ts
 19  tests/recommend.ranking.test.ts
 16  tests/messages.coverage.test.ts
 10  tests/personas.snapshot.test.ts
230  total
```

Git: `main` is 5 commits ahead of `9f6bffc` — `6737439 initialize RinSetu
project` → `4a8eea7 built frontend` → `5eb1b1e landing page ui changes` →
`b9f34ba Update README.md` → `bd12a83 handoff & progress(frontend)`. Working
tree clean. After this refresh: two files modified locally (`README.md` rewritten,
this file updated) — commit before continuing. Earlier drafts claimed "nothing is
committed" — that was true at the Phase 1–2 gate, no longer.

---

## 3. Fully built and tested

### 3.1 The deterministic core — `src/core/`

Pure, synchronous TypeScript. No I/O, no async, no React, no Prisma, no `fs`. This is
enforced by `scripts/check-boundaries.mjs`, which runs in `npm run check`.

| file | what it does |
| --- | --- |
| `types.ts` | Every type and every closed code list (`PREDICATE_CODES`, `PROVENANCE_SOURCES`, …). `isCitable()` lives here. |
| `eligibility/predicates.ts` | One function per predicate. Returns a `Verdict` with a code, never a sentence. |
| `eligibility/engine.ts` | Runs a scheme's predicates and folds verdicts into `ELIGIBLE` / `NOT_ELIGIBLE` / `INDETERMINATE`. |
| `eligibility/remediation.ts` | For each failing verdict, what the applicant could do about it. |
| `finance/rounding.ts` | The single rounding policy. Nothing else rounds. |
| `finance/rules.ts` | `resolveInterestRate`, `resolveCostCeiling` — condition-keyed rule tables, most-specific-match wins. |
| `finance/terms.ts` | Derives repayment months from tenure and moratorium. |
| `finance/emi.ts` | EMI and the amortisation schedule, including all three moratorium treatments. |
| `finance/loan.ts` | The fixed pipeline: eligible cost → subsidy → own contribution → gross loan → loan → rate → EMI. |
| `partners/distance.ts` | Haversine. No PostGIS — there are ~150 partners. |
| `partners/health.ts` | The weighted partner-health composite. |
| `partners/match.ts` | Hard filters, then distance and health ranking. |
| `documents/resolve.ts` | Scheme + partner-type document checklist. |
| `recommend.ts` | The one entry point the UI will call. Returns verdicts for **all** schemes. |

Four properties of the core worth knowing before you touch it:

- **It is parameterised over the data.** There are no scheme numbers in `src/core/`.
  This is what lets real guideline figures drop in without editing logic — and it is why
  the engine can be correct while the figures are still placeholders.
- **`INDETERMINATE` is a real answer.** A verdict carries `evaluable: false` when a
  scheme parameter or applicant field was missing. Collapsing that into "not eligible"
  would tell someone they are ineligible when the truth is that we do not know.
- **Failures are kept, not thrown away.** `recommend()` returns every scheme with its
  reason codes and remediations. "No scheme fits, here is exactly why" is a headline
  feature.
- **`computeLoan` refuses rather than guesses.** It returns a discriminated union:
  `{computable: true, …}` or `{computable: false, missing: string[]}`. The `missing`
  array holds dotted paths like `scheme.margin_pct`, each of which has a `field.<path>`
  message key so the UI can say precisely what is absent.

### 3.2 Data and the loader

`data/` holds seven JSON files; `src/lib/dataset.ts` is the only thing that reads them.

| file | contents |
| --- | --- |
| `schemes.seed.json` | The scheme master: MICRO, TERM, EDU. Most figures are placeholders. Also holds `open_questions_for_phase_0` (11 entries). |
| `schemes.demo-overlay.json` | Stand-in values that fill **only null slots**, so the engine can be exercised. Stamped `demo_overlay`. |
| `partners.seed.json` | 15 fabricated channel partners on real city coordinates. |
| `partner-health.sim.json` | 15 health rows, every one `data_origin: "SIMULATED"`. |
| `health-scoring.json` | The four health weights, each with a rationale message key. |
| `documents.seed.json` | Document catalogue and per-scheme requirements. |
| `personas.fixtures.json` | 40 test applicants covering the branch matrix. |

Two mechanisms here carry a lot of weight:

- **`verified` is derived, never stored.** `isCitable(source)` is true only for
  `official_guideline` and `design_decision`. Setting `"verified": true` in a JSON file
  has no effect. There is no flag anyone can flip the night before a demo.
- **`figures_authoritative` is false for two independent reasons** — any non-citable
  figure in play, *and* unconditionally whenever the demo overlay is applied. It cannot
  be forced true.

### 3.3 Messages — `src/messages/`

`en.json` holds **258 keys**. `index.ts` is a deliberately strict stand-in for next-intl:
it **throws** on a missing key rather than rendering the key. `tests/messages.coverage.test.ts`
closes the loop in both directions — every key the core can emit exists, and every key
that exists is reachable (with a short, reviewable allowlist for presentational strings).

### 3.4 Tooling

- **`npm run personas`** — runs all 40 personas through `recommend()` and prints a
  summary table, or `npm run personas P19` for one applicant in full detail.
- **`npm run verify:report`** — regenerates `VERIFY.md` from the data.
- **`npm run check:verify`** — fails if `VERIFY.md` is out of date. In `npm run check`.
- **`npm run check:boundaries`** — fails if `src/core/` imports from `llm/`, `app/`,
  `components/`, Next, React or `fs`.

`VERIFY.md` deserves a note, because it is not a hand-written document. It is generated,
it carries **no timestamp** (so `--check` is meaningful), and it contains four
**structural findings** each paired with a `check()` that re-verifies the claim against
the live engine at generation time. If a documented claim stops being true, the generator
**exits 1 and refuses to write the file** rather than emitting a document that says
something false. Verified this session by temporarily flipping a seed value and watching
it refuse.

Current content: **55 unverified figures** across 4 locations — 32 supplied by the demo
overlay, 23 seed placeholders or problem-statement paraphrases.

### 3.5 Database layer

- **`prisma/schema.prisma`** — validates (`npx prisma validate`). Models: `Scheme`,
  `InterestRule`, `CostCeilingRule`, `GlobalEligibility`, `Partner`, `PartnerHealth`,
  `DocumentDef`, `DocumentReq`, `Application`.
- **`prisma/seed.ts`** — loads `data/*.json` through the *same* loader the engine uses,
  so the rows in Postgres are the objects the engine was tested against. Idempotent.
  Demo overlay **off by default**; `npm run seed -- --with-overlay` opts in and prints a
  warning.
- **`prisma.config.ts`** — Prisma 7 no longer reads the connection URL from the schema.

Three decisions in the schema you should not undo without reading the header comments:

- **No `verified` column, and no `figures_authoritative` column.** Same reasoning as
  §3.2 — a stored boolean is a boolean someone can set by hand.
- **Nullable means unknown, and it survives the round trip.** A `NOT NULL DEFAULT 0` on
  `max_unit_cost` would turn "we do not know the ceiling" into "the ceiling is nothing".
- **`PartnerHealth.data_origin` is non-nullable with no default.** Every screen that
  renders a health figure reads its origin in the same query.

---

## 4. In progress / rough edges

Nothing is half-finished in the sense of broken code — the gate is green. But four
things are worth knowing:

1. **`prisma generate` is not wired into install.** The generated client lives in
   `node_modules`, so a fresh `git clone && npm install` will fail `npm run typecheck`
   until someone runs `npx prisma generate`. The one-line fix is to add
   `"postinstall": "prisma generate"` to `package.json` scripts. Not done here because
   this session stopped at the phase gate; it is a two-minute job for whoever picks up.

2. **No migration has ever been run, and `DATABASE_URL` is unset.** The Supabase project
   does not exist yet. `prisma.config.ts` is written so that `prisma generate` still works
   without it — Prisma's own `env()` helper throws while *loading the config*, which would
   take down typecheck on every laptop without credentials. `npm run seed` with no
   `DATABASE_URL` prints a one-line explanation and exits 1. Verified. Unchanged since
   Phase 2.

3. **Prisma 7 requires a driver adapter.** `new PrismaClient()` with no arguments throws
   at construction. `@prisma/adapter-pg` is installed and wired in `prisma/seed.ts`.
   This was determined by running it against an unreachable database, not assumed — worth
   knowing because the error message is confusing if you meet it cold.

4. **UI is baseline-complete, not feature-complete.** The Phase 3–6 baseline shipped
   in `4a8eea7` (see §3.6) gives a working end-to-end flow, but deliberately defers
   maps, PDF, i18n and admin upload. Those are tracked in §5, not missing by accident.

## 5. Not started / deferred after the UI baseline

What shipped in `4a8eea7` (Phase 3–6 baseline):

- Guided intake at `/apply` (GET → `/result`, no JS required, no LLM), verdict table
  for all schemes, finance panel with amortisation schedule, partner ranking with hard
  filters + health breakdown, document checklist, dataset/provenance banners, and the
  `?persona=P01` fixture path. Design language from §6 is applied (ledger/paper,
  `globals.css` + `src/components/ui.tsx`).

What is still not started (ROADMAP §§4–9, in priority order):

- **`src/llm/`** does not exist. Neither `extract.ts` (free text → profile) nor
  `explain.ts` (computed result → prose). Both are enhancements; the guided form is the
  primary path and everything must work with the LLM disabled. Gemini adapter is in
  `package.json` (`@google/generative-ai`) but unused.
- **Map** — MapLibre GL JS + OSM raster tiles. `PartnerPanel` lists and ranks but
  renders no map. Do not add PostGIS; distance is haversine in `src/core/`.
- **PDF packet** — `@react-pdf/renderer` not installed; no `/api/packet` route.
  Checklist renders on screen but does not download.
- **Multilingual** — `src/messages/en.json` expanded; `next-intl` not installed,
  no `hi.json`/`mr.json`, `src/messages/index.ts` is still the strict throw-on-missing
  stand-in.
- **Admin health-data upload** — no `/admin/*` route; `PartnerHealth.data_origin`
  is SIMULATED everywhere.
- **`DEMO_MODE` fixture cache + offline hardening** — no fixture cache for LLM
  calls, no pre-cached tiles, no local-DB fallback.
- **`README.md`** — was boilerplate at Phase 2, 58 lines at `b9f34ba`; rewritten
  2026-08-31 to a full setup + architecture doc (current state, quick start,
  layout, provenance model).

---

## 6. The design language — decided in Phase 2, applied in the baseline

The user's explicit instruction was: **no generic AI gradient theme.** Keep it minimal,
or replicate something related to the nature of the project.

The chosen direction, because the project's nature is *an official credit file that has
to arrive correct*: the interface is a **ledger / government document**.

- warm paper background, ink-navy text
- hairline rules instead of cards and shadows
- tabular monospace figures, so columns of rupees line up and reconcile
- rubber-stamp-style provenance badges
- IBM Plex Sans / Mono / Serif (via `next/font` Geist + Source Serif 4 — institutional, and
  has a real Devanagari cut for the translation phase)
- **no gradients, no glassmorphism, no glow**
- mobile-first, usable at 360px — target users are on low-end phones

Applied in `src/app/globals.css`, `src/app/layout.tsx:19`, and
`src/components/ui.tsx` / `DatasetBanner.tsx` / `LoanFigures.tsx` etc. in
`4a8eea7` plus polish in `5eb1b1e` (`ScrollReveal`, hero at 76svh). Do not
re-litigate; extend.

### 3.6 UI baseline — `src/app/` and `src/components/` (new since Phase 2)

| route | file | what it does |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Landing: provenance stamp (compact), claim, `/apply` + `/personas` CTAs, 4-step band, scheme list from dataset, detail block. |
| `/apply` | `src/app/apply/page.tsx` | Guided intake, GET → `/result`. All option lists derived from dataset/partners/documents; blank → `undefined` → Zod default; no `required`, no geocoding. |
| `/result` | `src/app/result/page.tsx` | Runs `recommend()` on query string or `?persona=P01`, renders `DatasetBanner` (full), answer summary, recommended `SchemeCard` + others. |
| `/personas` | `src/app/personas/page.tsx` | 40 fixtures live through `recommend()` at render time; no stored outcomes. |

Components: `ui.tsx` (Provenance/StatusPill/VerdictMark/FieldRow/DataOriginBadge), `DatasetBanner.tsx` (full + compact), `SchemeCard.tsx`, `VerdictList.tsx`, `LoanFigures.tsx` (incl. `computable: false` branch), `PartnerPanel.tsx` (dual ranking, exclusion reasons, SIMULATED badge), `ChecklistPanel.tsx`, `form.tsx`, `ScrollReveal.tsx`. Lib: `applicant-params.ts` (query ↔ `ApplicantProfile`), `format.ts`, `view.ts`.

Invariants preserved: no `src/core/` import from `src/llm/`/`app/`/`components/`; LLM never decides; every figure carries `FieldProvenance` rendered as a stamp; failures kept with remediations.

## 7. The exact next step

Phase 3 first half (intake + verdict table) is done — `4a8eea7` shipped it. What
remains is the deferred list in §5, in the order ROADMAP says to build it:

1. **Maps (Phase 4 tail):** add MapLibre GL JS + OSM tiles to `PartnerPanel` / a
   new `PartnerMap` component. Pure display; hard filters and haversine stay in
   `src/core/`. Never geocode at request time.
2. **PDF packet (Phase 6 tail):** install `@react-pdf/renderer`, add a packet
   route that reuses `recommend()` output. This is why the file "arrives correct."
3. **Multilingual (Phase 7):** install `next-intl`, add `hi.json` (and `mr.json`
   if a native speaker is available), enforce do-not-translate glossary for scheme
   names/amounts.
4. **LLM boundaries (enhancement, Phases 3/7):** `src/llm/extract.ts` (text →
   `ApplicantProfile` via Gemini structured output + Zod) and `src/llm/explain.ts`
   (computed `RecommendationResult` → prose). Must work with LLM disabled.
5. **Admin health upload (Phase 8):** `/admin/health-upload` CSV/XLSX → `PartnerHealth`
   with `data_origin: "MIS_UPLOAD"`.
6. **Demo hardening (Phase 9):** `DEMO_MODE=true` fixture cache, pre-cached tiles,
   offline rehearsal.

Pick **one** of the above per session and stop at the gate for review.

**Two constraints still apply.** Do not edit `src/core/` from the UI side — if the UI
needs something the core does not expose, that is a core change with its own tests, in
its own commit. And every user-facing string is a key in `src/messages/en.json`; a
hardcoded English sentence in a component is a bug (`tests/messages.coverage.test.ts`
will not catch it for you, but a reviewer should).

Read `docs/ROADMAP.md` §3 before starting.

## 8. The exact command to continue

From `C:\Users\chirl\Desktop\SIH\PROJECT\rinsetu`. First, confirm you have inherited a
green tree:

```bash
npm install && npx prisma generate && npm run check
```

That must end with `230 passed` (9 files). If it does not, stop and fix that before
writing anything new — every claim in this document was true at exit 0 on `bd12a83`
(re-checked 2026-08-31).

Working tree is clean at `bd12a83` plus the two local doc edits from this refresh;
commit them before starting new work. The old instruction to
`git add -A && git commit -m "Phases 1-2: ..."` was for the Phase 1–2 gate when
nothing was committed — that gate is now captured in `6737439`/`4a8eea7`.

To see the engine work with no database and no API key:

```bash
npm run personas          # 40 rows, live through recommend()
npm run dev               # http://localhost:3000 — /, /apply, /result, /personas
```

To see a single persona's full result: `npm run personas P19` or open
`/result?persona=P19` in the browser.

Fresh-clone build also verified 2026-08-31: `npm run build` compiles cleanly —
`○ /`, `○ /personas` static, `ƒ /apply`, `ƒ /result` dynamic, 103 kB First Load JS.

## 9. Rules that are not negotiable

`CLAUDE.md` is the project constitution and overrides convenience. The two invariants,
in short:

1. **The LLM never decides and never produces a number.** It is allowed in exactly two
   places, `src/llm/extract.ts` and `src/llm/explain.ts`, and `explain.ts` receives only
   an already-computed result — it must not have the authority or the data to introduce a
   fact.
2. **Every figure carries provenance.** No numeric or regulatory value enters the
   codebase without a source. Unverified values are `verified: false` and appear in
   `VERIFY.md`. Simulated data carries `data_origin: "SIMULATED"` and every UI surface
   that reads it renders a visible label.

And the one that has shaped the most code: **never invent a scheme parameter.** Not a
rate, ceiling, margin, subsidy, moratorium length or tenure. If a value is unknown, use
the placeholder, leave `verified: false`, add `TODO(verify)`, regenerate `VERIFY.md`, and
say so in your summary.

Read the full file. It also covers the moratorium trap (all three of `CAPITALISED` /
`SERVICED` / `WAIVED` are implemented, and which one applies is a per-scheme field from
the official guideline — never assume), hard filters before soft ranking, one rounding
policy, tests in the same commit as core logic, and the pinned stack.
