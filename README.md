# RinSetu

**AI-assisted concessional credit scheme matching and assessment platform — SIH 2026, SIH26092**

RinSetu helps Scheduled Caste applicants understand which concessional-credit schemes they may qualify for, why they qualify or do not qualify, what the financial outcome looks like under that scheme's own rules, which documents are required, and which Channel Partner can actually take the file.

> **Illustrative figures — not an offer**
>
> This build runs on **unverified placeholder scheme parameters** plus a labelled demo overlay. Eligibility logic is real and tested; the rupee amounts are not. Every figure carries `source`/`provenance` and the banner `Illustrative figures — not an offer` is rendered wherever a number appears. See `VERIFY.md` for the list of 48 unverified figures. Nothing on screen is a sanction.

---

## Current state — 2026-09-10 (`13b111d` on `main` + 5 schemes, 41 personas, form + LLM hardening — pause for remaining guideline transcription)

| gate | command | result |
|---|---|---|
| all | `npm run check` | **exit 0** |
| typecheck | `npm run typecheck` | exit 0 |
| lint | `npm run lint` | exit 0 |
| boundaries | `npm run check:boundaries` | **passed** — `src/core/` imports nothing from `llm/`, `app/`, `components/`, Next, React or `fs` |
| verify | `npm run check:verify` | **up to date** — `VERIFY.md` is generated from `data/*.json` |
| tests | `npm run test` | **11 files, 237 tests, all passing** (now `DB unreachable, skipping parity check` only when DB truly unreachable via `isDbUnreachableError`) |
| personas CLI | `npm run personas` | **41 rows** — 24 eligible (P41 multi-eligible MICRO+AMY), EMI populated (also `DEMO_MODE=true npm run personas` offline) |
| dev server | `npm run dev` | `/`, `/apply`, `/result`, `/personas`, `/admin/health-upload` + `/api/extract` (Gemini 2.5-flash / fixture, 503→fallback) render |
| prod build | `npm run build` | compiled, **15 routes** (`ƒ /api/extract`, `ƒ /api/extract-documents`, `ƒ /api/explain`, `ƒ /api/packet`, `ƒ /api/admin/*` ×5, `ƒ /admin/health-upload`), First Load JS 103 kB |
| db | `DATABASE_URL` (pooler 6543) + `npm run seed` | **connected** — `20260905144514_init` applied, **5 schemes** / 15 partners / 15 health rows · DB parity `src/lib/dataset-db.ts` verified (offline-graceful) |
| llm | `GEMINI_API_KEY` + `gemini-2.5-flash` | **2.5-flash** (3.6-flash 503 high-demand → fallback `flash-latest/2.5-flash-lite/3-flash-preview`, `isTransientError` + model fallback, `429/503` → `Retry-After:5/10`), `src/llm/` 3 files + `/api/*` + `DEMO_MODE` fixture cache `data/llm.fixtures.json:1` |
| i18n | `next-intl` + `hi`/`mr` 274 keys | **accurate** `hi`/`mr`, globe `LocaleSwitcher`, brand `RinSetu` locked, tab stays English, `amy/uny` + `free_text_retry` + `partner.map.offline_*` added |
| admin | `ADMIN_PASSWORD` + `/admin/health-upload` | **done** — CSV `partner_code…as_of` → `PartnerHealth.data_origin=MIS_UPLOAD`, `src/lib/health-csv.ts:210` duplicate guard fixed (seen added even for invalid rows), template download, preview → apply |
| demo | `DEMO_MODE=true` + `public/manifest.json:1` | **done** — `src/llm/extract.ts:119` fixture cache, `PartnerMap.tsx:48` offline fallback (now `offline_badge/title` i18n), `DatasetBanner.tsx:1` `DEMO MODE` banner, full demo with wifi off |

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

Dataset: **5 schemes** (MICRO, TERM, EDU, **AMY Aajeevika 15%** + **UNY Udyam Nidhi 13%** — all `verified: false`, from `https://nsfdc.nic.in/scheme` 09.09.2026: MICRO 1.40L/1.25L 6.5% 3y, TERM 50L/45L 8% 7y, EDU 40L 6.5% 12y, AMY 1.40L/1.25L 15% 3y via NBFC-MFI, UNY 5L/4.5L 13% 5y via Coop; overlap **P41 tailoring 90k → MICRO+AMY both ELIGIBLE, ranking picks MICRO** `F2` live), 15 fabricated partners on real city coordinates, 15 `SIMULATED` health rows (replaceable via `/admin/health-upload` CSV → `MIS_UPLOAD`), 274 i18n keys (`en`/`hi`/`mr`, + `amy/uny` + `free_text_retry` + `offline_*`), **41 persona fixtures** (P41 multi-eligible), `india-states-districts.json` (36 states/UTs, every district, MH 36×7–16 tehsils + 364 tehsils→villages, now till tehsil). Figures authoritative: **false** for two independent reasons (non-citable figures + demo overlay active).

### What's built

**Deterministic core — `src/core/`** (pure, synchronous, no I/O):
- `eligibility/` — predicates return `{code, passed, evaluable, messageKey}`; engine folds to `ELIGIBLE`/`NOT_ELIGIBLE`/`INDETERMINATE`; every failure keeps a remediation. Status precedence: broken outranks unevaluable.
- `finance/` — single rounding policy (`rounding.ts`), cost-ceiling & rate rule tables, `terms.ts` (tenure inclusive/exclusive), `loan.ts` pipeline (eligible cost → subsidy → margin → gross loan → caps → rate → EMI), `emi.ts` with all three moratorium treatments (`CAPITALISED`/`SERVICED`/`WAIVED`) and amortisation. Golden tests pin EMIs to the rupee.
- `partners/` — haversine distance, weighted health composite, hard filters then soft ranking (never blended).
- `documents/resolve.ts` + `recommend.ts` (single entry point the UI calls, returns verdicts for **all** schemes).

**UI baseline — `src/app/` + `src/components/`** (Phase 3–6 baseline `4a8eea7`+`5eb1b1e`, Map 2026-09-05, PDF 2026-09-05, i18n 2026-09-05 — globe + brand lock + accurate `hi`/`mr` + form till tehsil + LLM 2.5-flash + purpose flat):
- `/` — landing: compact provenance stamp, claim, CTAs to `/apply` and `/personas` + language switcher (`LocaleSwitcher.tsx:1` globe `h-7 w-7` → dropdown `English/हिन्दी/मराठी`, cookie `locale`, `NextIntlClientProvider`), 4-step band, scheme list from dataset (cannot drift, now 5 schemes), detail block. Ledger/paper design: warm paper, ink-navy, hairline rules, tabular monospace figures, stamp badges, no gradients. Mobile-first at 360 px. Brand **`RinSetu`** hardcoded (`layout.tsx:42`, `hi`/`mr` `ui.brand` locked `RinSetu` per glossary), tab stays English (`layout.tsx:16` `generateMetadata` hardcodes `'en'`).
- `/apply` — guided intake, `GET → /result`, **free-text + guided** (both fill same `ApplicantProfile` → `?age=&…`): `FreeTextIntake.tsx:1` (`textarea` + `POST /api/extract` `gemini-2.5-flash` fallback `flash-latest/2.5-lite` + `429/503` retry `isTransientError` + `Retry-After:5/10` with countdown `free_text_retry_in` → `free_text_guided_fallback`, fills form and **stays on `/apply`** with `router.replace('/apply?...')` + missing-field nudge `free_text_missing_prefix`/`free_text_filled`, no jump to `/result`), locale-aware (`getLocale()` + `globalThis.__RINSETU_LOCALE__` + client `document.cookie` `messages/index.ts:48`, `lib/locale.ts:1`), no JS required for guided, no LLM required for guided. **Purpose now flat** `ApplyForm.tsx:59` `purposeOptionsForIntent()` — deduped sorted generic activities without `optgroup` scheme labels (user describes activity, not picks scheme; was leaking `Micro Finance Scheme → petty_trade`). **Location cascade strict** `ApplyForm.tsx:171` — `district` disabled until `state`, `tehsil` disabled until `district` (was showing 700+ districts / 800+ tehsils unfiltered), `tehsil→district→state` auto-fill retained, `intent` sync fixed `paramsKey` not reverting, `applicant-params.ts:41` now parses `5 lakh`→500000. All labels/options/hints switch `en`/`hi`/`mr` (274 keys).
- `/result` — runs `recommend()` on query string or `?persona=Pxx`, locale-aware (`getLocale()` + `translate(..., locale)`, `src/i18n.ts:1`), shows `DatasetBanner` (full), recommended `SchemeCard` + others collapsed with `StatusPill`, finance panel with schedule, partner map (MapLibre GL JS + OSM raster, `PartnerMap.tsx:1`, eligible only, straight-line; offline fallback now `offline_badge/title` i18n) + dual ranking, exclusion reasons, checklist, **PDF packet** (`packet.tsx:1` + `api/packet/route.ts:1` `renderToBuffer`, respects `preferred_language`/UI locale) + **LLM explain** (`ExplainPanel.tsx:1` `POST /api/explain` `prose`, do-not-translate, now 2.5-flash fallback) + **Loan confirm → required docs upload** (`LoanConfirmation.tsx:1` → `DocumentUpload.tsx:1` `POST /api/extract-documents` `inlineData` `requiredDocCodes` only for confirmed loan, now fixed `ui.confirm.*` keys). Invariants: no arithmetic in components, every rupee from the engine, scheme names/amounts never translated.
- `/personas` — **41 fixtures** rendered live through `recommend()` at render time; no stored outcomes. Locale-aware. `P41` tailoring `90k` is `MICRO+AMY` both `ELIGIBLE` → ranking demo.

**Data layer — `data/` + `src/lib/dataset.ts` + `src/lib/dataset-db.ts`**: 7 JSON files, one JSON loader + one DB loader (both derive `verified` via `isCitable()` `src/core/types.ts:94`, never copied — fixed 2026-09-05 `src/lib/dataset.ts:356`/`387`), `figures_authoritative` false when any non-citable figure exists or overlay is applied, `VERIFY.md` generated with 4 structural findings (F1–F4) each with a live `check()` that refuses to write a false document. **F2 now live:** `P41` tailoring proves `MICRO+AMY` overlap, ranking policy fires on real data.

**Database — `prisma/schema.prisma` + `prisma/seed.ts` + `src/lib/dataset-db.ts`**: 10 tables via `20260905144514_init` (8 models + `_prisma_migrations`), validated, idempotent seed through the same loader. `DATABASE_URL` connected to Supabase pooler (`aws-0-ap-south-1.pooler.supabase.com:6543`, `sslmode=require`, `rejectUnauthorized:false` in `prisma/seed.ts:57`); `prisma generate` works without it (`prisma.config.ts` conditional datasource); `npm run seed` writes **5 schemes** / 15 partners / 15 health rows / **53 doc reqs** (was 38). Verified 2026-09-10: `schemes 5`, `partners 15`, `partner_health 15`, `global_eligibility 1`. DB loader `src/lib/dataset-db.ts:1` is exact reverse of seed — `tests/dataset-db.parity.test.ts:1` proves JSON↔DB parity (now `DB unreachable, skipping parity check` offline graceful with 2s probe).

**Admin health upload — `src/app/admin/health-upload/page.tsx:1` + `src/lib/admin-auth.ts:1` + `src/lib/health-csv.ts:1`** (Phase 8, 2026-09-07): single-password `ADMIN_PASSWORD` (default `rinsetu-admin`) → HttpOnly `rinsetu_admin` cookie (8h), CSV `partner_code,funds_sanctioned,funds_utilised,overdue_amount,npa_pct,avg_processing_days,capacity_flag,as_of` → `PartnerHealth.data_origin=MIS_UPLOAD`, template download, preview (valid/invalid per line, `isDbUnreachableError` guard) → apply upsert `(partnerCode,asOf)` via `prisma/seed.ts:57` pool. All 15 rows currently `SIMULATED` until first upload; `PartnerPanel.tsx:1` already renders `DataOriginBadge` (`SIMULATED` amber / `MIS_UPLOAD`).

**Demo hardening — `DEMO_MODE=true`** (Phase 9, 2026-09-07): `src/llm/client.ts:18` `DEMO_MODE` flag → `src/llm/extract.ts:119` fixture cache `data/llm.fixtures.json:1` (`extract:<lowercased>` + `__fallback__`), `src/llm/explain.ts:49` deterministic prose fallback, `src/components/DatasetBanner.tsx:1` `DEMO MODE` stamp, `src/components/PartnerMap.tsx:48` offline fallback (no `tile.openstreetmap.org` fetch, shows ranked codes), `src/app/layout.tsx:26` `window.__RINSETU_DEMO__` + `next.config.ts:4` `NEXT_PUBLIC_DEMO_MODE`, `public/manifest.json:1` PWA manifest, `FreeTextIntake.tsx:88` hint. Full demo runs with wifi off: `DEMO_MODE=true npm run dev` + `npm run personas` + `/apply` free-text `I want to start a tailoring unit…` → `/result` → `/personas`. `tests/dataset-db.parity.test.ts:38` now skips on unreachable DB (236+1) so gate stays green offline.

### What is not yet built — what we will do next

**Immediate (next 1–2 days) — you asked to store for tomorrow:**
- **Phase 0 — finish transcription:** fetch `NSFDC Compendium 2024-05-15` `nsfdc.nic.in/UploadedFiles/.../1-4-1.pdf`, fill `margin_pct`, `subsidy_pct/cap/timing`, `moratorium_interest_treatment` for `MICRO/TERM/AMY/UNY` (now `placeholder` `TODO(verify)`), re-run `npm run verify:report` → aim for `MICRO/TERM` → `verified:true` and `figures_authoritative` flip for at least those 2. No code change, only `data/schemes.seed.json` values + `source_url/date`.
- **Form choice fix (done, needs your review tomorrow):** `LoanConfirmation` now lets user **pick any `ELIGIBLE`**, not just recommended — `P41` shows `MICRO 6.5%` vs `AMY 15%` radios `src/components/LoanConfirmation.tsx:9` `src/app/result/page.tsx:257`. Test with `P41` and real manual entries where 2 schemes overlap (e.g., tailoring `90k`).

**Next (3–5 days):**
- **Save my applications:** wire `Application` `prisma/schema.prisma:47` — `POST /api/applications` on `See result` → `GET /applications` list + `/applications/[id]` view (DB already 5/15/15, no auth needed for demo, just cookie). So manual form isn't lost if you lose the link `src/lib/applicant-params.ts:122`.
- **Deploy:** `Vercel` + `Supabase` prod env, `DEMO_MODE` rehearsal `docs/ROADMAP.md:391` 4-min script, record demo video.
- **Polish:** Lighthouse a11y ≥90, XLSX alongside CSV, voice/Bhashini (optional), replace `PLACEHOLDER_petty_trade` with real `indicative-activities` flat list (you asked purpose should be generic, not scheme-picked — done `ApplyForm.tsx:59`).

We are at **code-complete + real-data pause** `2026-09-10`: deterministic, UI, DB, LLM `2.5-flash` fallback, i18n 274 keys, admin, offline paths work **and 5 NSFDC schemes transcribed**; remaining `TODO(verify)` need compendium. See `docs/PROGRESS.md` §7–§8 and `docs/ROADMAP.md` §10–§14 for step-by-step.

---

## Quick start

From `rinsetu/`:

```bash
npm install && npm run check   # postinstall runs prisma generate
# must end with 237 passed, 11 files — if not, stop and fix

npm run personas        # 41 rows live through recommend() (P41 multi-eligible MICRO+AMY)
npm run personas P41    # multi-scheme ranking demo
npm run personas P19    # one persona in full detail
npm run dev             # http://localhost:3000  — /, /apply, /result, /personas, /admin/health-upload
DEMO_MODE=true npm run dev  # offline demo — fixture cache, no GEMINI_API_KEY, map fallback, parity test skips
npm run verify:report   # regenerate VERIFY.md after editing data/*.json
```

Fresh clone: `npm install` runs `prisma generate` via `postinstall` (`package.json:19`); no manual step needed. `DATABASE_URL` is set in `.env` (gitignored, pooled `6543` for runtime — see `.env.example:7`; use direct `5432` for `prisma migrate dev`). Tests/build/dev do not need a live DB (they run against `data/*.json` via `src/lib/dataset.ts`), but `npm run seed` does.

---

## Architecture

```
guided form (/apply, GET → /result) ─┐
                                     ├→ ApplicantProfile (Zod) → src/core/recommend() → RecommendationResult
free text → LLM extract (DEMO_MODE fixture) ─┘   │  eligibility + finance + partner match + checklist
                                               └→ LLM explain (fixture/deterministic, narration only)
                                               └→ UI: verdict table + finance + partners + checklist + admin health CSV → MIS_UPLOAD
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
├─ data/  schemes.seed.json (5 schemes: MICRO/TERM/EDU/AMY/UNY)  schemes.demo-overlay.json  partners.seed.json
│         partner-health.sim.json  health-scoring.json  documents.seed.json (53 reqs)  personas.fixtures.json (41, P41 multi-eligible)
│         india-states-districts.json (36 states/UTs, every district, MH 36×7–16 tehsils + 364 tehsils→villages, now till tehsil)
│         llm.fixtures.json (7 fixtures, extract + documents fallback, DEMO_MODE)
├─ prisma/  schema.prisma  seed.ts  prisma.config.ts
├─ src/
│  ├─ core/  types.ts  eligibility/  finance/  partners/  documents/  recommend.ts
│  ├─ app/   layout.tsx  page.tsx  apply/page.tsx  result/page.tsx  personas/page.tsx  admin/health-upload/page.tsx  api/extract/route.ts  api/extract-documents/route.ts  api/explain/route.ts  api/packet/route.ts  api/admin/login|logout|health-preview|health-apply|health-template/route.ts
│  ├─ components/  ui.tsx  DatasetBanner.tsx  SchemeCard.tsx  VerdictList.tsx  LoanFigures.tsx  PartnerPanel.tsx  PartnerMap.tsx  ChecklistPanel.tsx  LocaleSwitcher.tsx  FreeTextIntake.tsx  LoanConfirmation.tsx  DocumentUpload.tsx  ExplainPanel.tsx  AdminHealthUpload.tsx  AdminLogin.tsx  form.tsx  ScrollReveal.tsx
│  ├─ lib/   dataset.ts  dataset-db.ts  packet.tsx  locale.ts  applicant-params.ts (lakh/thousand parse)  format.ts  view.ts  admin-auth.ts  health-csv.ts (dedupe fix)
│  ├─ llm/   client.ts (gemini-2.5-flash fallback, isTransientError)  extract.ts (purpose flat, fixture cache, 429/503 retry)  explain.ts (deterministic fallback)
│  ├─ i18n.ts  (next-intl getRequestConfig, en/hi/mr, cookie + Accept-Language)
│  └─ messages/  en.json (274 keys: +amy/uny + retry/confirm/offline)  hi.json  mr.json  index.ts (strict throw, + next-intl, + globalThis.__RINSETU_LOCALE__)
├─ public/  manifest.json (PWA, offline demo)
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
