# RinSetu

**AI-assisted concessional credit scheme matching and assessment platform — SIH 2026, SIH26092**

RinSetu helps Scheduled Caste applicants understand which concessional-credit schemes they may qualify for, why they qualify or do not qualify, what the financial outcome looks like under that scheme's own rules, which documents are required, and which Channel Partner can actually take the file.

> **Illustrative figures — not an offer**
>
> This build runs on **unverified placeholder scheme parameters** plus a labelled demo overlay. Eligibility logic is real and tested; the rupee amounts are not. Every figure carries `source`/`provenance` and the banner `Illustrative figures — not an offer` is rendered wherever a number appears. See `VERIFY.md` for the list of 55 unverified figures. Nothing on screen is a sanction.

---

## Current state — 2026-09-05 (`bd12a83` on `main`, DB connected, clean tree)

| gate | command | result |
|---|---|---|
| all | `npm run check` | **exit 0** |
| typecheck | `npm run typecheck` | exit 0 |
| lint | `npm run lint` | exit 0 |
| boundaries | `npm run check:boundaries` | **passed** — `src/core/` imports nothing from `llm/`, `app/`, `components/`, Next, React or `fs` |
| verify | `npm run check:verify` | **up to date** — `VERIFY.md` is generated from `data/*.json` |
| tests | `npm run test` | **11 files, 237 tests, all passing** (1 skipped without DB) |
| personas CLI | `npm run personas` | **40 rows** — 23 eligible, EMI populated |
| dev server | `npm run dev` | `/`, `/apply`, `/result`, `/personas` render |
| prod build | `npm run build` | compiled, 8 routes, First Load JS 103 kB |
| db | `DATABASE_URL` (pooler 6543) + `npm run seed` | **connected** — `20260905144514_init` applied, 3 schemes / 15 partners / 15 health rows · DB parity loader `src/lib/dataset-db.ts` verified |

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
  6  tests/eligibility.age-format.test.ts   (A3 format coupling, new 2026-09-05)
  1  tests/dataset-db.parity.test.ts        (JSON↔DB parity, skipped without DATABASE_URL)
237  total
```

Dataset: 3 schemes (MICRO, TERM, EDU — all `verified: false`), 15 fabricated partners on real city coordinates, 15 `SIMULATED` health rows, 258 i18n keys, 40 persona fixtures. Figures authoritative: **false** for two independent reasons (non-citable figures + demo overlay active).

### What's built

**Deterministic core — `src/core/`** (pure, synchronous, no I/O):
- `eligibility/` — predicates return `{code, passed, evaluable, messageKey}`; engine folds to `ELIGIBLE`/`NOT_ELIGIBLE`/`INDETERMINATE`; every failure keeps a remediation. Status precedence: broken outranks unevaluable.
- `finance/` — single rounding policy (`rounding.ts`), cost-ceiling & rate rule tables, `terms.ts` (tenure inclusive/exclusive), `loan.ts` pipeline (eligible cost → subsidy → margin → gross loan → caps → rate → EMI), `emi.ts` with all three moratorium treatments (`CAPITALISED`/`SERVICED`/`WAIVED`) and amortisation. Golden tests pin EMIs to the rupee.
- `partners/` — haversine distance, weighted health composite, hard filters then soft ranking (never blended).
- `documents/resolve.ts` + `recommend.ts` (single entry point the UI calls, returns verdicts for **all** schemes).

**UI baseline — `src/app/` + `src/components/`** (Phase 3–6 baseline `4a8eea7`+`5eb1b1e`, Map 2026-09-05, PDF 2026-09-05):
- `/` — landing: compact provenance stamp, claim, CTAs to `/apply` and `/personas`, 4-step band, scheme list from dataset (cannot drift), detail block. Ledger/paper design: warm paper, ink-navy, hairline rules, tabular monospace figures, stamp badges, no gradients. Mobile-first at 360 px.
- `/apply` — guided intake, `GET → /result`, no JS required, no LLM. Every option list derived from dataset/partners/documents; blanks → `undefined` → Zod default; no `required`, no geocoding (distance shows "unknown" — never invents a centroid).
- `/result` — runs `recommend()` on query string or `?persona=Pxx`, shows `DatasetBanner` (full), recommended `SchemeCard` + others collapsed with `StatusPill`, finance panel with schedule, partner map (MapLibre GL JS + OSM raster, `src/components/PartnerMap.tsx:1`, eligible only, straight-line) + dual ranking (nearest vs fastest), exclusion reasons, checklist, **PDF packet** (`src/lib/packet.tsx:1` + `src/app/api/packet/route.ts:1` via `@react-pdf/renderer`, `Download packet` link reusing `recommend()` output). Invariants: no arithmetic in components, every rupee from the engine.
- `/personas` — 40 fixtures rendered live through `recommend()` at render time; no stored outcomes.

**Data layer — `data/` + `src/lib/dataset.ts` + `src/lib/dataset-db.ts`**: 7 JSON files, one JSON loader + one DB loader (both derive `verified` via `isCitable()` `src/core/types.ts:94`, never copied — fixed 2026-09-05 `src/lib/dataset.ts:356`/`387`), `figures_authoritative` false when any non-citable figure exists or overlay is applied, `VERIFY.md` generated with 4 structural findings (F1–F4) each with a live `check()` that refuses to write a false document.

**Database — `prisma/schema.prisma` + `prisma/seed.ts` + `src/lib/dataset-db.ts`**: 10 tables via `20260905144514_init` (8 models + `_prisma_migrations`), validated, idempotent seed through the same loader. `DATABASE_URL` connected to Supabase pooler (`aws-0-ap-south-1.pooler.supabase.com:6543`, `sslmode=require`, `rejectUnauthorized:false` in `prisma/seed.ts:57`); `prisma generate` works without it (`prisma.config.ts` conditional datasource); `npm run seed` writes 3 schemes / 15 partners / 15 health rows. Verified 2026-09-05: `schemes 3`, `partners 15`, `partner_health 15`, `global_eligibility 1`. DB loader `src/lib/dataset-db.ts:1` is exact reverse of seed — `tests/dataset-db.parity.test.ts:1` proves JSON↔DB parity (237th test, skipped without `DATABASE_URL`).

### What is not yet built

- `src/llm/` (`extract.ts` / `explain.ts`) — Gemini adapter in `package.json` but unused. Guided form is primary; LLM is an enhancement that must work with `DEMO_MODE=true`.
- Multilingual — `next-intl` not installed; only `en.json` (+5 `partner.map.*`, +2 `ui.result.download_packet` for PDF); `hi.json`/`mr.json` pending.
- Multilingual — `next-intl` not installed; only `en.json` (258 keys); `hi.json`/`mr.json` pending.
- Admin health upload — no `/admin/*`; all `PartnerHealth.data_origin` is `SIMULATED`.
- Offline hardening — no fixture cache, no pre-cached tiles.

See `docs/PROGRESS.md` §5 and `docs/ROADMAP.md` for the ordered plan.

---

## Quick start

From `rinsetu/`:

```bash
npm install && npm run check   # postinstall runs prisma generate
# must end with 237 passed, 11 files (1 skipped without DATABASE_URL) — if not, stop and fix

npm run personas        # 40 rows live through recommend()
npm run personas P19    # one persona in full detail
npm run dev             # http://localhost:3000  — /, /apply, /result, /personas
npm run verify:report   # regenerate VERIFY.md after editing data/*.json
```

Fresh clone: `npm install` runs `prisma generate` via `postinstall` (`package.json:19`); no manual step needed. `DATABASE_URL` is set in `.env` (gitignored, pooled `6543` for runtime — see `.env.example:7`; use direct `5432` for `prisma migrate dev`). Tests/build/dev do not need a live DB (they run against `data/*.json` via `src/lib/dataset.ts`), but `npm run seed` does.

---

## Architecture

```
guided form (/apply, GET → /result) ─┐
                                     ├→ ApplicantProfile (Zod) → src/core/recommend() → RecommendationResult
free text → LLM extract (planned) ───┘         │  eligibility + finance + partner match + checklist
                                               └→ LLM explain (planned, narration only)
                                               └→ UI: verdict table + finance + partners + checklist
```

Two invariants (`CLAUDE.md`):
1. **The LLM never decides and never produces a number.** Only in `src/llm/extract.ts` (text → profile) and `src/llm/explain.ts` (computed result → prose).
2. **Every figure carries provenance** — `source_url`, `source_date`, `verified`, `data_origin: SIMULATED` for health. Unverified stays in `VERIFY.md`.

`src/core/` must not import from `src/llm/`, `src/app/`, `src/components/` — enforced by `scripts/check-boundaries.mjs` in CI.

---

## Project layout

```
rinsetu/
├─ CLAUDE.md, VERIFY.md (generated), README.md
├─ docs/  PROGRESS.md  ROADMAP.md  HANDOFF.md  FRAGILE.md  TEST-RECORD.md
├─ data/  schemes.seed.json  schemes.demo-overlay.json  partners.seed.json
│         partner-health.sim.json  health-scoring.json  documents.seed.json  personas.fixtures.json
├─ prisma/  schema.prisma  seed.ts  prisma.config.ts
├─ src/
│  ├─ core/  types.ts  eligibility/  finance/  partners/  documents/  recommend.ts
│  ├─ app/   layout.tsx  page.tsx  apply/page.tsx  result/page.tsx  personas/page.tsx  api/packet/route.ts
│  ├─ components/  ui.tsx  DatasetBanner.tsx  SchemeCard.tsx  VerdictList.tsx
│  │              LoanFigures.tsx  PartnerPanel.tsx  PartnerMap.tsx  ChecklistPanel.tsx  form.tsx  ScrollReveal.tsx
│  ├─ lib/   dataset.ts  dataset-db.ts  packet.tsx  applicant-params.ts  format.ts  view.ts
│  └─ messages/  en.json  index.ts (strict throw-on-missing)
└─ tests/  11 files, 237 tests  +  scripts/  check-boundaries.mjs  verify-report.ts  personas.ts
```

---

## Why the numbers can be defended

- Parameters live in `data/`, never in code. The engine is correct independent of the figures.
- Predicates return **codes**, not sentences (`src/messages/en.json`; `translate()` throws on missing key).
- Hard filters before soft ranking — a partner that cannot handle the scheme category never appears.
- One rounding policy in `src/core/finance/rounding.ts`.
- `INDETERMINATE` is a real answer — missing guideline data does not become "not eligible".
- Tests accompany core logic in the same commit; 6 hand-computed EMI golden values pin all three moratorium treatments to the rupee.

---

## Docs

- `docs/PROGRESS.md` — the one file to read cold (current state, what's built, what's deferred, next step).
- `docs/HANDOFF.md` — how not to break the EMI engine, predicates, or matching.
- `docs/FRAGILE.md` — what breaks silently vs loudly (weak spot `scheme.verified` fixed 2026-09-05, derived not copied).
- `docs/ROADMAP.md` — phased plan (29 days at student pace, ~10-day cut).
- `docs/TEST-RECORD.md` — verbatim `npx vitest run --reporter=verbose` output at 237/237.
- `CLAUDE.md` — constitution; overrides convenience.

---

## Stack (pinned)

Next.js 15 · TypeScript strict · Tailwind + shadcn/ui · PostgreSQL (Supabase) · Prisma 7 · Vitest · MapLibre GL JS + OSM · `@react-pdf/renderer` · `@google/generative-ai` (Gemini Flash) behind one adapter · Zod (+ `next-intl` when that phase lands).

Distance is haversine in TypeScript. Do not add PostGIS, Redux, GraphQL, vector DB, Docker orchestration, or auth beyond one admin login.
