# RinSetu

**AI-assisted concessional credit scheme matching and assessment platform — SIH 2026, SIH26092**

RinSetu helps Scheduled Caste applicants understand which concessional-credit schemes they may qualify for, why they qualify or do not qualify, what the financial outcome looks like under that scheme's own rules, which documents are required, and which Channel Partner can actually take the file.

> **Illustrative figures — not an offer**
>
> This build runs on **unverified placeholder scheme parameters** plus a labelled demo overlay. Eligibility logic is real and tested; the rupee amounts are not. Every figure carries `source`/`provenance` and the banner `Illustrative figures — not an offer` is rendered wherever a number appears. See `VERIFY.md` for the list of 55 unverified figures. Nothing on screen is a sanction.

---

## Current state — 2026-09-06 (`bd12a83` on `main`, DB+core+Maps+PDF+i18n+form till tehsil+LLM 3.6-flash, clean tree — pause for tomorrow)

| gate | command | result |
|---|---|---|
| all | `npm run check` | **exit 0** |
| typecheck | `npm run typecheck` | exit 0 |
| lint | `npm run lint` | exit 0 |
| boundaries | `npm run check:boundaries` | **passed** — `src/core/` imports nothing from `llm/`, `app/`, `components/`, Next, React or `fs` |
| verify | `npm run check:verify` | **up to date** — `VERIFY.md` is generated from `data/*.json` |
| tests | `npm run test` | **11 files, 237 tests, all passing** (1 skipped without DB) |
| personas CLI | `npm run personas` | **40 rows** — 23 eligible, EMI populated |
| dev server | `npm run dev` | `/`, `/apply`, `/result`, `/personas` + `/api/extract` (Gemini 3.6-flash) render |
| prod build | `npm run build` | compiled, **11 routes** (`ƒ /api/extract`, `ƒ /api/extract-documents`, `ƒ /api/explain`, `ƒ /api/packet`), First Load JS 103 kB |
| db | `DATABASE_URL` (pooler 6543) + `npm run seed` | **connected** — `20260905144514_init` applied, 3 schemes / 15 partners / 15 health rows · DB parity `src/lib/dataset-db.ts` verified |
| llm | `GEMINI_API_KEY` + `gemini-3.6-flash` | **3.6-flash** (was 1.5/2.5 404, now `ListModels` 200, quota 20/min, retry 429 → `Retry-After:5`), `src/llm/` 3 files + `/api/*` |
| i18n | `next-intl` + `hi`/`mr` 265 keys | **accurate** `hi`/`mr` via Gemini-class LLM, globe `LocaleSwitcher`, brand `RinSetu` locked, tab stays English |

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

Dataset: 3 schemes (MICRO, TERM, EDU — all `verified: false`), 15 fabricated partners on real city coordinates, 15 `SIMULATED` health rows, 265 i18n keys (`en`/`hi`/`mr`, +7 map+packet, accurate `hi`/`mr` 0 English left), 40 persona fixtures, `india-states-districts.json` (36 states/UTs, every district, MH 36×7–16 tehsils + 364 tehsils→villages, now till tehsil). Figures authoritative: **false** for two independent reasons (non-citable figures + demo overlay active).

### What's built

**Deterministic core — `src/core/`** (pure, synchronous, no I/O):
- `eligibility/` — predicates return `{code, passed, evaluable, messageKey}`; engine folds to `ELIGIBLE`/`NOT_ELIGIBLE`/`INDETERMINATE`; every failure keeps a remediation. Status precedence: broken outranks unevaluable.
- `finance/` — single rounding policy (`rounding.ts`), cost-ceiling & rate rule tables, `terms.ts` (tenure inclusive/exclusive), `loan.ts` pipeline (eligible cost → subsidy → margin → gross loan → caps → rate → EMI), `emi.ts` with all three moratorium treatments (`CAPITALISED`/`SERVICED`/`WAIVED`) and amortisation. Golden tests pin EMIs to the rupee.
- `partners/` — haversine distance, weighted health composite, hard filters then soft ranking (never blended).
- `documents/resolve.ts` + `recommend.ts` (single entry point the UI calls, returns verdicts for **all** schemes).

**UI baseline — `src/app/` + `src/components/`** (Phase 3–6 baseline `4a8eea7`+`5eb1b1e`, Map 2026-09-05, PDF 2026-09-05, i18n 2026-09-05 — globe + brand lock + accurate `hi`/`mr` + form till tehsil + LLM 3.6-flash):
- `/` — landing: compact provenance stamp, claim, CTAs to `/apply` and `/personas` + language switcher (`LocaleSwitcher.tsx:1` globe `h-7 w-7` → dropdown `English/हिन्दी/मराठी`, cookie `locale`, `NextIntlClientProvider`), 4-step band, scheme list from dataset (cannot drift), detail block. Ledger/paper design: warm paper, ink-navy, hairline rules, tabular monospace figures, stamp badges, no gradients. Mobile-first at 360 px. Brand **`RinSetu`** hardcoded (`layout.tsx:42`, `hi`/`mr` `ui.brand` locked `RinSetu` per glossary), tab stays English (`layout.tsx:16` `generateMetadata` hardcodes `'en'`).
- `/apply` — guided intake, `GET → /result`, **free-text + guided** (both fill same `ApplicantProfile` → `?age=&…`): `FreeTextIntake.tsx:1` (`textarea` + `POST /api/extract` `gemini-3.6-flash` `name`/`tehsil`/`village` + quota 20/min retry `429` → `Retry-After:5`, fills form and **stays on `/apply`** with `router.replace('/apply?...')` + missing-field nudge `free_text_missing_prefix`/`free_text_filled`, no jump to `/result`), locale-aware (`getLocale()` + `globalThis.__RINSETU_LOCALE__` + client `document.cookie` `messages/index.ts:48`, `lib/locale.ts:1`), no JS required for guided, no LLM required for guided. Location cascade **state → district → tehsil** (village removed per request, till taluka), **all states** (36 + UTs) + every district for that state, **all tehsils for every Maharashtra district** (36×7–16, was 11 → now 36, was `Tehsil 1,2,3` → now real `Haveli`…; villages 364 tehsils → `*_Gaon` but UI stops at tehsil), unlocked one after another, every option shows all valid choices, typing `Haveli` auto-fills `Pune`/`Maharashtra` (`tehsil→district→state` reverse maps), village `TextField` removed. All labels/options/hints switch `en`/`hi`/`mr` (fixed 2026-09-05–06: `mr` 16+23 missing `ui.apply.*`/`ui.*` translated, 265 keys `hi` 2 left `mr` 0).
- `/result` — runs `recommend()` on query string or `?persona=Pxx`, locale-aware (`getLocale()` + `translate(..., locale)`, `src/i18n.ts:1`), shows `DatasetBanner` (full), recommended `SchemeCard` + others collapsed with `StatusPill`, finance panel with schedule, partner map (MapLibre GL JS + OSM raster, `PartnerMap.tsx:1`, eligible only, straight-line) + dual ranking, exclusion reasons, checklist, **PDF packet** (`packet.tsx:1` + `api/packet/route.ts:1` `renderToBuffer`, respects `preferred_language`/UI locale) + **LLM explain** (`ExplainPanel.tsx:1` `POST /api/explain` `prose`, do-not-translate) + **Loan confirm → required docs upload** (`LoanConfirmation.tsx:1` → `DocumentUpload.tsx:1` `POST /api/extract-documents` `inlineData` `requiredDocCodes` only for confirmed loan, Gemini reads files to fill form, `Re-apply` link). Invariants: no arithmetic in components, every rupee from the engine, scheme names/amounts never translated.
- `/personas` — 40 fixtures rendered live through `recommend()` at render time; no stored outcomes. Locale-aware.

**Data layer — `data/` + `src/lib/dataset.ts` + `src/lib/dataset-db.ts`**: 7 JSON files, one JSON loader + one DB loader (both derive `verified` via `isCitable()` `src/core/types.ts:94`, never copied — fixed 2026-09-05 `src/lib/dataset.ts:356`/`387`), `figures_authoritative` false when any non-citable figure exists or overlay is applied, `VERIFY.md` generated with 4 structural findings (F1–F4) each with a live `check()` that refuses to write a false document.

**Database — `prisma/schema.prisma` + `prisma/seed.ts` + `src/lib/dataset-db.ts`**: 10 tables via `20260905144514_init` (8 models + `_prisma_migrations`), validated, idempotent seed through the same loader. `DATABASE_URL` connected to Supabase pooler (`aws-0-ap-south-1.pooler.supabase.com:6543`, `sslmode=require`, `rejectUnauthorized:false` in `prisma/seed.ts:57`); `prisma generate` works without it (`prisma.config.ts` conditional datasource); `npm run seed` writes 3 schemes / 15 partners / 15 health rows. Verified 2026-09-05: `schemes 3`, `partners 15`, `partner_health 15`, `global_eligibility 1`. DB loader `src/lib/dataset-db.ts:1` is exact reverse of seed — `tests/dataset-db.parity.test.ts:1` proves JSON↔DB parity (237th test, skipped without `DATABASE_URL`).

### What is not yet built (for tomorrow)

- **LLM is built** — `src/llm/` `client.ts` `extract.ts` (`name`/`tehsil`/`village`, `normalizeExtracted`, `gemini-3.6-flash`, `429` retry) + `explain.ts` + `/api/extract`/`/api/extract-documents`/`/api/explain` + `FreeTextIntake`/`LoanConfirmation`/`DocumentUpload`/`ExplainPanel` — free-text now **requires** `GEMINI_API_KEY` + network (no offline fixture, per your request, quota 20/min `Retry-After:5`), document extraction only for required docs after loan confirm. Guided form still primary and works offline.
- Admin health upload — no `/admin/*`; all `PartnerHealth.data_origin` is `SIMULATED` (Phase 8 next).
- Offline hardening — no fixture cache, no pre-cached tiles (Phase 9).

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
│         india-states-districts.json (36 states/UTs, every district, MH 36×tehsils + 364 villages, now till tehsil)
│         llm.fixtures.json (3 extract fixtures, demo for explain)
├─ prisma/  schema.prisma  seed.ts  prisma.config.ts
├─ src/
│  ├─ core/  types.ts  eligibility/  finance/  partners/  documents/  recommend.ts
│  ├─ app/   layout.tsx  page.tsx  apply/page.tsx  result/page.tsx  personas/page.tsx  api/extract/route.ts  api/extract-documents/route.ts  api/explain/route.ts  api/packet/route.ts
│  ├─ components/  ui.tsx  DatasetBanner.tsx  SchemeCard.tsx  VerdictList.tsx  LoanFigures.tsx  PartnerPanel.tsx  PartnerMap.tsx  ChecklistPanel.tsx  LocaleSwitcher.tsx  FreeTextIntake.tsx  LoanConfirmation.tsx  DocumentUpload.tsx  ExplainPanel.tsx  form.tsx  ScrollReveal.tsx
│  ├─ lib/   dataset.ts  dataset-db.ts  packet.tsx  locale.ts  applicant-params.ts  format.ts  view.ts
│  ├─ llm/   client.ts (gemini-3.6-flash, DEMO_MODE)  extract.ts (name/tehsil/village, 429 retry)  explain.ts
│  ├─ i18n.ts  (next-intl getRequestConfig, en/hi/mr, cookie + Accept-Language)
│  └─ messages/  en.json  hi.json  mr.json  index.ts (strict throw, + next-intl, + globalThis.__RINSETU_LOCALE__)
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

Next.js 15 · TypeScript strict · Tailwind + shadcn/ui · PostgreSQL (Supabase) · Prisma 7 · Vitest · MapLibre GL JS + OSM · `@react-pdf/renderer` · `next-intl` · `@google/generative-ai` (Gemini Flash) behind one adapter · Zod.

Distance is haversine in TypeScript. Do not add PostGIS, Redux, GraphQL, vector DB, Docker orchestration, or auth beyond one admin login.
