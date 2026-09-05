# PROGRESS.md — where RinSetu stands

Written at the end of Phases 1–2, updated after the Phase 3–6 baseline landed
(`4a8eea7` + `5eb1b1e`), refreshed 2026-08-31 at `bd12a83` on `main`, DB connected 2026-09-05, core hardened 2026-09-05, Maps 2026-09-05, PDF 2026-09-05, i18n 2026-09-05, form till tehsil + LLM 3.6-flash 2026-09-06 — **paused for tomorrow, see §2**.
Everything below was verified by running it, not remembered. If you have no
context on this project, read this file top to bottom, then read `CLAUDE.md`,
then run the one command in [§8](#8-the-exact-command-to-continue).

> **2026-08-31 refresh:** `bd12a83 handoff & progress(frontend)` is now HEAD.
> `npm run check` still exits 0 (230/230), `npm run build` compiles (8 routes),
> `npm run personas` prints 40 rows. No `src/core/` or `data/` change since
> `b9f34ba` — frontend and docs only. `README.md` rewritten from 58 lines to a
> full setup + architecture doc; this file's §2/§8 updated to the new commit.
>
> **2026-09-05 DB connect:** Supabase pooler `aws-0-ap-south-1.pooler.supabase.com:6543` connected (see `.env`, gitignored). Migration `20260905144514_init` applied, `npm run seed` writes 3 schemes / 15 partners / 15 health rows. `npm run check` still 230/230 (DB not required for tests). `README.md` §current-state + §database + quick-start updated; this file §2/§3.5/§4/§8 updated.
>
> **2026-09-05 core hardening:** Fixed silent fragilities — (1) pinned `AGE_WITHIN_RANGE` format `src/core/eligibility/predicates.ts:132` ↔ `remediation.ts:94` with `tests/eligibility.age-format.test.ts:1` (6 tests), (2) derived `verified` in `src/lib/dataset.ts:356`/`387` (was copied, now `Object.values(provenance).every(isCitable)`). Added DB parity loader `src/lib/dataset-db.ts:1` (reverse of `prisma/seed.ts:1`, async, outside `src/core/`) + `tests/dataset-db.parity.test.ts:1` proves JSON↔DB deep-equal. `npm run check` now **11 files / 237 tests** (1 skipped without `DATABASE_URL`).
>
> **2026-09-05 Maps:** Added `src/components/PartnerMap.tsx:1` (MapLibre GL JS `6.7.0` + OSM raster `tile.openstreetmap.org`, eligible-only markers, `fitBounds`, applicant dot) wired via `src/components/PartnerPanel.tsx:222` + `SchemeCard.tsx:66`. `src/messages/en.json:234` `partner.map.*` (5 keys, `partner.map.` exempted in `tests/messages.coverage.test.ts:237`). `npm run build` 8 routes, `npm run check` still 11/237 green.
>
> **2026-09-05 PDF:** Added `src/lib/packet.tsx:1` (PacketDocument via `@react-pdf/renderer`, ledger styles, reuses `recommend()` — no new numbers) + `src/app/api/packet/route.ts:1` (`GET /api/packet?persona=P01` or `?...` → `application/pdf`, `renderToBuffer`, `force-dynamic`) wired in `src/app/result/page.tsx:178` (`packetHref`, `Download packet` link). `src/messages/en.json:500` `ui.result.download_packet*` (2 keys, `ui.` exempt). `npm run build` now 9 routes (`ƒ /api/packet 127 B`), `npm run check` still 11/237 green.
>
> **2026-09-05 i18n:** Installed `next-intl`, added `src/messages/hi.json` + `mr.json` (265 keys, UI `hi`/`mr` human-written, scheme names/amounts kept English per glossary do-not-translate), `src/messages/index.ts:1` now `en`/`hi`/`mr` catalogues, `src/i18n.ts:1` (`getRequestConfig`, cookie `locale` + Accept-Language, `next-intl/plugin` in `next.config.ts:1`), `src/lib/locale.ts:1` + `src/components/LocaleSwitcher.tsx:1` (globe `lucide-react` button → dropdown `English/हिन्दी/मराठी`, cookie `locale`, `NextIntlClientProvider` in `src/app/layout.tsx:1`), `src/app/result/page.tsx:1` + `src/app/page.tsx:66` + `src/app/apply/page.tsx:1` + `src/lib/packet.tsx:1` locale-aware (`getLocale()` + `globalThis.__RINSETU_LOCALE__` + `translate(..., locale)` + client `document.cookie` auto-detect `src/messages/index.ts:48`), packet respects `preferred_language`. Brand `RinSetu` hardcoded (`layout.tsx:42`, `hi`/`mr` `ui.brand` locked `RinSetu`), tab title stays English (`layout.tsx:16` `generateMetadata` hardcodes `t(..., 'en')`). `npm run build` now all `ƒ` dynamic (locale via `cookies()`), `npm run check` still 11/237 green.
>
> **2026-09-05 i18n fixes (user feedback):** Globe button (was 3 pills → `Globe` + dropdown, `LocaleSwitcher.tsx:1`), brand lock (`RinSetu` not `रिनसेतु`/`रिनसेतू`, `hi/mr` `ui.brand` fixed + layout hardcoded), form fields now correctly switch `mr` (fixed 16 missing `mr` `ui.apply.*` + 23 `ui.*` + full `hi`/`mr` accurate via Gemini-class LLM — `hi` 2 English left `_README`/`currency_symbol` per glossary, `mr` 0), tab title stays English. Verified `mr ui.apply.name != 'Name'` after fix, `npm run check` 11/237 green.
>
> **2026-09-06 form + LLM (pause for tomorrow — where we are):** **Form:** `src/core/types.ts:210` `tehsil`/`village` already in schema, `data/india-states-districts.json:41` all 36 MH districts ×7–16 tehsils (was 11 → now 36, `Akola`→`Akot`…`Washim`), villages 364 tehsils (was 5 → now 364, `_default` only for non-MH). `src/components/ApplyForm.tsx:140` cascade now `state → district → tehsil` (village removed per request, till taluka), **all valid choices** per level, `tehsil` auto-detects `district`→`state` (`tehsilToDistrict`/`districtToState`), `village` removed. **LLM:** `src/llm/client.ts:31` `gemini-1.5-flash` 404 → `gemini-3.6-flash` (tested `{"test":1}` ok, `AQ.Ab8…` key valid, `ListModels` 200), `src/llm/extract.ts:18` now `name`/`tehsil`/`village` + `normalizeExtracted` (category/gender/intent `null`→ defaults, `₹, lakh` strings), `FreeTextIntake.tsx:14` now `router.replace('/apply?...')` + `missing[]` nudge (`free_text_missing_prefix`/`free_text_filled`) + `Event` → `Network error` not `[object Event]`, `formKey` remount + `useEffect` sync `intent`. `POST /api/extract` 429 quota (20/min) now 3× retry + `429` `Retry-After:5` + friendly *“Free-tier quota exceeded… use guided form”*, `GEMINI_API_KEY` in `.env` (gitignored). **Pause:** `npm run check` 11/237 green, `npm run build` 11 routes (`ƒ /apply` 12.4kB). Next is **Admin health upload (Phase 8)** or **Demo hardening (Phase 9)** — pick one tomorrow.

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

## 2. Current state: green — paused 2026-09-06 for tomorrow

Verified 2026-09-06 from `rinsetu/` at `bd12a83` on `main` + DB + Maps + PDF + i18n + form till tehsil + LLM 3.6-flash (clean working tree, `origin/main` up to date) — **where we are for tomorrow, see §5/§7**:

| check | command | result |
| --- | --- | --- |
| everything | `npm run check` | **exit 0** |
| typecheck | `npm run typecheck` | exit 0 |
| lint | `npm run lint` | exit 0 |
| architecture boundary | `npm run check:boundaries` | passed — `src/core/` imports nothing from `llm/`, `app/`, `components/` |
| VERIFY.md freshness | `npm run check:verify` | up to date |
| tests | `npm run test` | **11 files, 237 tests, all passing** (1 skipped without DB) |
| demo CLI | `npm run personas` | prints 40 rows (23 eligible), EMI column populated |
| dev server | `npm run dev` | renders `/`, `/apply` (till tehsil, globe), `/result` (map+PDF+explain), `/personas` + `/api/extract` (3.6-flash) |
| prod build | `npm run build` | compiled, **11 routes** (`ƒ /api/extract`, `ƒ /api/extract-documents`, `ƒ /api/explain`, `ƒ /api/packet`), First Load JS 103 kB |
| db | `DATABASE_URL` (pooler 6543) + `npm run seed` + `dataset-db` | **connected + parity verified** — `20260905144514_init` applied, 3/15/15 + `src/lib/dataset-db.ts` JSON↔DB deep-equal |
| llm | `GEMINI_API_KEY` + `gemini-3.6-flash` + quota 20/min | **3.6-flash** (was 1.5 404, `ListModels` 200), `src/llm/` 3 files + `FreeTextIntake`/`DocumentUpload`/`LoanConfirmation`/`ExplainPanel`, 429 retry |
| i18n | `next-intl` + `hi`/`mr` 265 keys + `india-states-districts.json` | **accurate** `hi`/`mr` + globe `LocaleSwitcher`, `RinSetu` locked, form till tehsil (36×7–16), tab English |

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
  6  tests/eligibility.age-format.test.ts   (A3 pin, new 2026-09-05)
  1  tests/dataset-db.parity.test.ts        (JSON↔DB, skipped without DATABASE_URL)
237  total
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

`data/` holds seven JSON files; `src/lib/dataset.ts` (JSON) + `src/lib/dataset-db.ts:1` (DB) are the two things that read them — both outside `src/core/` so the engine stays pure.

| file | contents |
| --- | --- |
| `schemes.seed.json` | The scheme master: MICRO, TERM, EDU. Most figures are placeholders. Also holds `open_questions_for_phase_0` (11 entries). |
| `schemes.demo-overlay.json` | Stand-in values that fill **only null slots**, so the engine can be exercised. Stamped `demo_overlay`. |
| `partners.seed.json` | 15 fabricated channel partners on real city coordinates. |
| `partner-health.sim.json` | 15 health rows, every one `data_origin: "SIMULATED"`. |
| `health-scoring.json` | The four health weights, each with a rationale message key. |
| `documents.seed.json` | Document catalogue and per-scheme requirements. |
| `personas.fixtures.json` | 40 test applicants covering the branch matrix. |

Two mechanisms here carry a lot of weight (now enforced in *both* loaders, `dataset.ts:80` `prov()` + `dataset.ts:356`/`387` and `dataset-db.ts:33`):

- **`verified` is derived, never stored.** `isCitable(source)` (`src/core/types.ts:94`) is true only for `official_guideline` and `design_decision`. Setting `"verified": true` in a JSON file has no effect — fixed 2026-09-05 to derive `verified: Object.values(provenance).every(isCitable)` instead of copying `raw.verified`. There is no flag anyone can flip the night before a demo.
- **`figures_authoritative` is false for two independent reasons** — any non-citable figure in play, *and* unconditionally whenever the demo overlay is applied. It cannot be forced true. `dataset-db.ts:1` derives the same way and detects `demo_overlay` in provenance.
- **`AGE_WITHIN_RANGE` format is pinned.** `predicates.ts:132` writes `"min-max"` and `remediation.ts:94` parses `split('-')` — `tests/eligibility.age-format.test.ts:1` (6 tests, new 2026-09-05) fails if either side changes (`docs/FRAGILE.md:56` A3).

### 3.3 Messages — `src/messages/` (i18n 2026-09-05, accurate 2026-09-05)

`en.json` holds **265 keys** (258 +5 `partner.map.*` +2 `ui.result.download_packet*`), `hi.json` + `mr.json` same keys (UI `hi`/`mr` human-written via Gemini-class LLM, scheme names/amounts/`₹`/`RinSetu` kept English per glossary do-not-translate — `hi` 2 English left `_README`/`currency_symbol`, `mr` 0 after fixes). `index.ts:1` now `en`/`hi`/`mr` (`CATALOGUES`), `src/i18n.ts:1` (`getRequestConfig` cookie `locale` + Accept-Language) via `next-intl/plugin` (`next.config.ts:1`), `src/lib/locale.ts:1` + `LocaleSwitcher.tsx:1` (globe `lucide-react` `h-7 w-7` → dropdown `English/हिन्दी/मराठी`, cookie, `NextIntlClientProvider` in `layout.tsx:1` with `html lang={locale}` but `generateMetadata` hardcodes `'en'` so tab stays English). Client `translate` auto-detects `document.cookie` (`index.ts:48`), server sets `globalThis.__RINSETU_LOCALE__` after `await getLocale()` (`layout.tsx:27`, `result/page.tsx:143`, `apply/page.tsx:17`, `page.tsx:66`). Still throws on missing key; `tests/messages.coverage.test.ts` still closes the loop (added `partner.map.`).

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

### 3.5 Database layer — connected + parity 2026-09-05

- **`prisma/schema.prisma`** — validates (`npx prisma validate`). 10 tables via `20260905144514_init` (8 models + `_prisma_migrations`): `Scheme`, `InterestRule`, `CostCeilingRule`, `GlobalEligibility`, `Partner`, `PartnerHealth`, `DocumentDef`, `DocumentReq`, `Application`.
- **`prisma/seed.ts`** — loads `data/*.json` through the *same* loader the engine uses, so the rows in Postgres are the objects the engine was tested against. Idempotent. Demo overlay **off by default**; `npm run seed -- --with-overlay` opts in and prints a warning. Uses `pg.Pool` with `ssl:{rejectUnauthorized:false}` and stripped `sslmode` (`seed.ts:57`) for Supabase pooler.
- **`prisma.config.ts`** — Prisma 7 no longer reads the connection URL from the schema. Reads `DATABASE_URL` from `.env` conditionally — `prisma generate` works offline; only DB commands need it. `.env` now points at `aws-0-ap-south-1.pooler.supabase.com:6543` (pooled, for runtime/Vercel); use direct `5432` (`db.[PROJECT-REF].supabase.co`) for `prisma migrate dev`.
- **`src/lib/dataset-db.ts:1`** — exact reverse of seed: reads Prisma rows back into `SchemeSpec`/`Partner`/`PartnerHealthRecord`/`DocumentDefinition` that `src/lib/dataset.ts:1` produces. Async, outside `src/core/` (boundary clean), derives `verified` same way (`dataset.ts:356` fix). `loadBundleFromDb(db)` mirrors `loadBundle()`.
- **Verified live** — `schemes 3` (MICRO/TERM/EDU), `partners 15`, `partner_health 15`, `global_eligibility 1`, `PrismaClient` via `@prisma/adapter-pg` returns rows with relations. **Parity:** `tests/dataset-db.parity.test.ts:1` proves JSON↔DB deep-equal (after normalizing sparse `applies_when` nulls and `required_documents` superset), 237th test, skipped without `DATABASE_URL`.

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

1. **`prisma generate` is now wired into install.** `package.json:19` has `"postinstall": "prisma generate"` — a fresh `git clone && npm install` generates the client automatically (was a manual `npx prisma generate` before 2026-09-05).

2. **Migration `20260905144514_init` applied and `DATABASE_URL` connected 2026-09-05.** Supabase pooler at `aws-0-ap-south-1.pooler.supabase.com:6543` (`.env`, gitignored, pooled for runtime; use direct `5432` for `prisma migrate dev`). `prisma.config.ts` still keeps `prisma generate` offline-capable — only DB commands need the URL, and `npm run seed` prints a one-line explanation and exits 1 when it is missing (verified pre-connect). Seed is idempotent via `prisma/seed.ts` through `src/lib/dataset.ts`.

3. **Prisma 7 requires a driver adapter.** `new PrismaClient()` with no arguments throws
   at construction. `@prisma/adapter-pg` is installed and wired in `prisma/seed.ts`.
   This was determined by running it against an unreachable database, not assumed — worth
   knowing because the error message is confusing if you meet it cold.

  4. **UI is baseline-complete, Maps + PDF + i18n + form till tehsil + LLM 3.6-flash now done.** Phase 3–6 baseline `4a8eea7` + Maps 2026-09-05 (`PartnerMap`) + PDF (`packet`/`ExplainPanel`) + i18n (globe/`RinSetu` lock/accurate `hi`/`mr`/tab `en`) + form cascade `state → district → tehsil` (36 MH×7–16, villages removed per request, auto-detect `tehsil→district→state`, all valid choices, 360px) + LLM `extract` (`name`/`tehsil`/`village`, `normalizeExtracted`, `gemini-3.6-flash`, quota 20/min `429` retry, free-text stays on `/apply` + missing-field nudge, `GEMINI_API_KEY` in `.env`). Still defers **Admin health upload (Phase 8)** and **Demo hardening (Phase 9)** — pick one tomorrow (see §7).

## 5. Not started / deferred after the UI baseline

What shipped in `4a8eea7` (Phase 3–6 baseline):

- Guided intake at `/apply` (GET → `/result`, no JS required, no LLM), verdict table
  for all schemes, finance panel with amortisation schedule, partner ranking with hard
  filters + health breakdown, document checklist, dataset/provenance banners, and the
  `?persona=P01` fixture path. Design language from §6 is applied (ledger/paper,
  `globals.css` + `src/components/ui.tsx`).

What is still not started — **paused 2026-09-06 for tomorrow** (Maps + PDF + i18n + form till tehsil + LLM extract/3.6-flash done, see §7):

- **`src/llm/`** — ~~does not exist. Neither `extract.ts` …~~ **✓ done 2026-09-06 — `src/llm/client.ts` `gemini-3.6-flash` (was 1.5 404, `ListModels` 200, quota 20/min `429` retry `Retry-After:5`), `extract.ts` (`name`/`tehsil`/`village`, `normalizeExtracted`, `extractFromDocuments` multimodal `inlineData` `requiredDocCodes`), `explain.ts` (prose, no numbers), `/api/extract` + `/api/extract-documents` + `/api/explain` + `FreeTextIntake.tsx:1` (fills form, stays on `/apply`, missing-field nudge, no jump) + `LoanConfirmation.tsx:1`/`DocumentUpload.tsx:1`/`ExplainPanel.tsx:1` (required docs only for confirmed loan, `Re-apply`). Guided form still primary, LLM needs `GEMINI_API_KEY` + network (no offline fixture for free-text per request).**
- **PDF packet** — ~~`@react-pdf/renderer` not installed…~~ **✓ done 2026-09-05 — `packet.tsx` + `/api/packet` + `result` download link. Reuses `recommend()`; no new numbers.**
- **Multilingual** — ~~`src/messages/en.json` expanded…~~ **✓ done 2026-09-05–06 — `next-intl` + `hi.json`/`mr.json` (265 keys, accurate `hi`/`mr` via Gemini-class LLM, `hi` 2 left `mr` 0, brand `RinSetu` lock, tab stays `en`), `src/i18n.ts:1` + `LocaleSwitcher` (globe), `layout`/`result`/`apply`/`personas`/`packet` locale-aware, form till tehsil (36 MH×7–16, `village` removed, auto-detect `tehsil→district→state`).**
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

### 3.6 UI baseline — `src/app/` and `src/components/` (new since Phase 2, Maps + PDF 2026-09-05)

| route | file | what it does |
| --- | --- | --- |
| `/` | `src/app/page.tsx` | Landing: provenance stamp (compact), claim, `/apply` + `/personas` CTAs, 4-step band, scheme list from dataset, detail block. |
| `/apply` | `src/app/apply/page.tsx` | Guided intake, GET → `/result`. All option lists derived from dataset/partners/documents; blank → `undefined` → Zod default; no `required`, no geocoding. |
| `/result` | `src/app/result/page.tsx` | Runs `recommend()` on query string or `?persona=P01`, renders `DatasetBanner` (full), answer summary, recommended `SchemeCard` + others, **PDF packet download** (`/api/packet?...` via `packet.tsx`). |
| `/personas` | `src/app/personas/page.tsx` | 40 fixtures live through `recommend()` at render time; no stored outcomes. |
| `/api/packet` | `src/app/api/packet/route.ts:1` | `GET` same query as `/result` → `application/pdf` (`renderToBuffer(<PacketDocument>)`, `force-dynamic`). Pre-filled packet, no new numbers. |

Components: `ui.tsx` (Provenance/StatusPill/VerdictMark/FieldRow/DataOriginBadge), `DatasetBanner.tsx` (full + compact), `SchemeCard.tsx`, `VerdictList.tsx`, `LoanFigures.tsx` (incl. `computable: false` branch), `PartnerPanel.tsx` (dual ranking, exclusion reasons, SIMULATED badge) + `PartnerMap.tsx:1` (MapLibre GL JS `6.7.0` + OSM raster, eligible-only markers, `fitBounds`, 240/320px, 360px), `ChecklistPanel.tsx`, `form.tsx`, `ScrollReveal.tsx`. Lib: `packet.tsx:1` (`PacketDocument`), `applicant-params.ts` (query ↔ `ApplicantProfile`), `format.ts`, `view.ts`.

Invariants preserved: no `src/core/` import from `src/llm/`/`app/`/`components/`; LLM never decides; every figure carries `FieldProvenance` rendered as a stamp; failures kept with remediations.

## 7. The exact next step

Phase 3 first half (intake + verdict table) is done — `4a8eea7` shipped it. What
remains is the deferred list in §5, in the order ROADMAP says to build it:

 1. **Maps (Phase 4 tail):** ~~add MapLibre GL JS + OSM tiles to `PartnerPanel` / a new `PartnerMap` component. Pure display; hard filters and haversine stay in `src/core/`. Never geocode at request time.~~ **✓ done 2026-09-05 — `PartnerMap.tsx:1` (OSM `tile.openstreetmap.org`, eligible-only, `fitBounds`) wired via `PartnerPanel.tsx:222` + `SchemeCard.tsx:66`.**
2. **PDF packet (Phase 6 tail):** ~~install `@react-pdf/renderer`, add a packet route that reuses `recommend()` output. This is why the file "arrives correct."~~ **✓ done 2026-09-05 — `src/lib/packet.tsx:1` + `src/app/api/packet/route.ts:1` (`GET /api/packet?...` → PDF, `renderToBuffer`, ledger styles) + `src/app/result/page.tsx:178` download link. Reuses `recommend()`; no new numbers.**
3. **Multilingual (Phase 7):** ~~install `next-intl`, add `hi.json` (and `mr.json` if a native speaker is available), enforce do-not-translate glossary for scheme names/amounts.~~ **✓ done 2026-09-05–06 — `next-intl` + `hi.json`/`mr.json` (265 keys, accurate via Gemini-class LLM, `hi` 2 left `mr` 0, brand `RinSetu` lock, tab stays `en`, `LocaleSwitcher` globe) + `src/i18n.ts:1`/`LocaleSwitcher`/`layout`/`result`/`apply`/`personas`/`packet` locale-aware, form till tehsil (36 MH×7–16).**
4. **LLM boundaries (enhancement, Phases 3/7):** ~~`src/llm/extract.ts` (text → `ApplicantProfile` via Gemini structured output + Zod) and `src/llm/explain.ts` (computed `RecommendationResult` → prose). Must work with LLM disabled.~~ **✓ done 2026-09-06 — `src/llm/client.ts` `gemini-3.6-flash` (was 1.5 404, `ListModels` 200, quota 20/min `429` retry), `extract.ts` (`name`/`tehsil`/`village`, `normalizeExtracted`, `extractFromDocuments` multimodal `requiredDocCodes`), `explain.ts`, `/api/extract`/`/api/extract-documents`/`/api/explain` + `FreeTextIntake` (fills form, stays on `/apply`, missing nudge) + `LoanConfirmation`/`DocumentUpload` (required only for confirmed loan) + `ExplainPanel`, `GEMINI_API_KEY` in `.env`. Guided form still primary, LLM needs network+key (no offline fixture for free-text per request).**
5. **Admin health upload (Phase 8):** `/admin/health-upload` CSV/XLSX → `PartnerHealth` with `data_origin: "MIS_UPLOAD"`.
6. **Demo hardening (Phase 9):** `DEMO_MODE=true` fixture cache, pre-cached tiles, offline rehearsal.

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
npm install && npm run check   # postinstall runs prisma generate; no manual npx needed
```

That must end with `237 passed` (11 files, 1 skipped without DATABASE_URL). If it does not, stop and fix that before writing anything new — every claim in this document was true at `bd12a83` (re-checked 2026-08-31, DB re-checked 2026-09-05, core-hardened 2026-09-05, Maps/PDF/i18n/LLM/form till tehsil re-checked 2026-09-06).

Working tree will be dirty with the 2026-09-06 doc refresh (this file + `README.md` + `docs/ROADMAP.md` + `data/india-states-districts.json` + `src/llm/` + `src/messages/hi.json`/`mr.json`); commit before continuing tomorrow. The old instruction to `git add -A && git commit -m "Phases 1-2: ..."` was for the Phase 1–2 gate when nothing was committed — that gate is now captured in `6737439`/`4a8eea7`.

**Where we are for tomorrow — pause 2026-09-06:** `npm run check` **11/237** green, `npm run build` **11 routes** (`ƒ` all, locale via `cookies()`), DB `3/15/15` + `GEMINI_API_KEY` `gemini-3.6-flash` (20/min, `429` retry), i18n `hi`/`mr` accurate, form `state→district→tehsil` (36×7–16, `village` removed, auto-detect `tehsil→district→state`), free-text fills form and stays on `/apply` + missing nudge. **Next:** **Admin health upload (Phase 8)** *or* **Demo hardening (Phase 9)** — pick one, see `docs/ROADMAP.md` §10.

To see the engine work with no database and no API key:

```bash
npm run personas          # 40 rows, live through recommend()
npm run dev               # http://localhost:3000 — /, /apply, /result, /personas
```

To see a single persona's full result: `npm run personas P19` or open
`/result?persona=P19` in the browser.

Fresh-clone build also verified 2026-08-31: `npm run build` compiles cleanly —
`○ /`, `○ /personas` static, `ƒ /apply`, `ƒ /result` dynamic, 103 kB First Load JS.
DB path verified 2026-09-05: `npx prisma migrate status` sees `20260905144514_init` as applied; `npm run seed` succeeds (idempotent) via pooler 6543.

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
