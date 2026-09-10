# PROGRESS.md — where RinSetu stands

Written at the end of Phases 1–2, updated after the Phase 3–6 baseline landed
(`4a8eea7` + `5eb1b1e`), refreshed 2026-08-31 at `bd12a83` on `main`, DB connected 2026-09-05, core hardened 2026-09-05, Maps 2026-09-05, PDF 2026-09-05, i18n 2026-09-05, form till tehsil + LLM 3.6-flash 2026-09-06, **admin health upload 2026-09-07, demo hardening 2026-09-07, parity offline-fix 2026-09-07, 5 schemes + F2 P41 + cascade/LLM harden 2026-09-10 at `13b111d` — code-complete pause for guideline transcription, intent-filter `result/page.tsx:180` 2026-09-11, Phase 0 check 2026-09-11 (single-page PDF + 172p Lending Policy — no margin/subsidy/treatment found, stays placeholder), see §2**.
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
>
> **2026-09-07 admin health upload:** Built `src/lib/admin-auth.ts:1` (single `ADMIN_PASSWORD` → `sha256` cookie `rinsetu_admin` 8h) + `src/lib/health-csv.ts:1` (quoted-field split, `partner_code` existence, `npa_pct` 0..100, `as_of` YYYY-MM-DD, duplicate `partner_code+as_of` guard, forced `MIS_UPLOAD`) + `src/app/admin/health-upload/page.tsx:1` + `src/components/AdminHealthUpload.tsx:1` + `AdminLogin.tsx:1` + 5 APIs (`/api/admin/login|logout|health-preview|health-apply|health-template`) with `isDbUnreachableError` guard, `pg.Pool` `ssl:{rejectUnauthorized:false}`. `npm run build` now 15 routes, `npm run check` 11/237 green, template CSV downloadable.
>
> **2026-09-07 demo hardening:** `src/llm/extract.ts:119` `DEMO_MODE` fixture cache (`extract:<lowercased>` + `__fallback__` in `data/llm.fixtures.json:1` now 7 fixtures) + `src/llm/explain.ts:49` already deterministic, `src/components/DatasetBanner.tsx:1` `DEMO MODE` stamp, `src/components/PartnerMap.tsx:48` offline fallback (no `tile.openstreetmap.org` fetch, shows ranked codes), `src/app/layout.tsx:26` `window.__RINSETU_DEMO__` + `next.config.ts:4` `NEXT_PUBLIC_DEMO_MODE`, `public/manifest.json:1` PWA, `FreeTextIntake.tsx:88` hint. Verified `DEMO_MODE=true npx tsx` extract + `npm run personas` 40 rows offline.
>
> **2026-09-07 parity offline-fix:** `tests/dataset-db.parity.test.ts:38` now `isDbUnreachableError()` + 2s `connectionTimeoutMillis` probe + `console.warn('DB unreachable, skipping parity check')` → `ctx.skip()`. Wifi on: `11 files, 237 passed`; wifi off: `11 files, 236 passed | 1 skipped` — `npm run check` stays green for Phase 9 gate.
>
> **2026-09-10 5 schemes + F2 P41 + cascade/LLM harden:** HEAD `13b111d` on `main` + working tree — `data/schemes.seed.json:1` now 5 schemes (MICRO, TERM, EDU, **AMY Aajeevika 15% via NBFC-MFI**, **UNY Udyam Nidhi 13% via Coop**), `data/personas.fixtures.json:1` 41 personas (**P41** tailoring 90k eligible for MICRO 6.5% + AMY 15% both, ranking picks MICRO — **F2 now live**), `src/components/ApplyForm.tsx:1` purpose flat deduped (no `optgroup`, eligibility `category C` only) + cascade strict (`district` disabled until `state`, `tehsil` disabled until `district`, `paramsKey` intent-sync + `lakh`/`thousand` parsing fix), `src/llm/client.ts:1` fallback `gemini-2.5-flash` → `gemini-flash-latest` with 429/503 retry + `Retry-After` handling (was 3.6-flash), `src/messages/en.json:1` + `hi`/`mr` missing `ui.confirm.*` fixed (`/result?persona=P41` now 200, was 500), `src/lib/health-csv.ts:1` duplicate guard `finalSeen` fixed (valid > invalid), `src/components/PartnerMap.tsx:1` offline `partner.map.offline` i18n keys. `npm run check` **11 files / 237 tests** all passing, `npm run personas` **41 rows / 24 eligible / 0 no figures**, `npm run build` **15 routes**, DB **5/15/15 +53 doc reqs**, `VERIFY.md:11` now **48 unverified (was 55)** = 19 `demo_overlay` + 29 `placeholder` (5/5 schemes unverified), F2 now expects P41 multi.
>
> **2026-09-11 intent-filter + Phase 0 check:** `src/app/result/page.tsx:180` now filters `visibleSchemes` by `applicant.intent` (`LIVELIHOOD`→`MICRO|TERM`, `EDUCATION`→`EDUCATION`, `UNKNOWN`→all) + re-derives `pickRecommended` — fixes `EDU` showing in business results and vice-versa; `npm run check` still **11/237** green, `npm run build` 15 routes. Phase 0: fetched `NSFDC SCHEMES` single-page PDF `2026-06-15` (`nsfdc schemes.pdf:1` 1 page, OCR’d) + `LENDING POLICY OF NSFDC SCHEMES` 172p (`staging-1-4-2.pdf:1`) — both confirm `max_unit_cost/max_loan/90%/rates/tenure/moratorium duration` already `official_guideline` 2026-09-09; **no explicit `margin_pct` / `subsidy_pct,cup,timing` / `moratorium_interest_treatment` found in either**, so all three stay `placeholder TODO(verify)` per `CLAUDE.md:31` hard rule 1 (never invent). `data/schemes.seed.json:17` notes + `_CHANGELOG` updated, `npm run verify:report` still **48 unverified (10 demo_overlay+38 placeholder)**, `figures_authoritative=false`, banner `DatasetBanner.tsx:74` correctly stays.

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

## 2. Current state: green — code-complete 2026-09-10, pause for guideline transcription

Verified 2026-09-10 from `rinsetu/` at `13b111d` on `main` + working tree with 5 schemes (MICRO, TERM, EDU, AMY Aajeevika 15% via NBFC-MFI, UNY Udyam Nidhi 13% via Coop), 41 personas (P41 tailoring 90k eligible for MICRO 6.5% + AMY 15% both, ranking picks MICRO — F2 now live), purpose flat deduped, cascade strict, LLM 2.5-flash fallback + health-csv guard + `ui.confirm` fix (`/result?persona=P41` 200) — **code-complete, see §5/§7**:

| check | command | result |
| --- | --- | --- |
| everything | `npm run check` | **exit 0** (237/237 wifi on, 236+1 skipped wifi off) |
| typecheck | `npm run typecheck` | exit 0 |
| lint | `npm run lint` | exit 0 |
| architecture boundary | `npm run check:boundaries` | passed — `src/core/` imports nothing from `llm/`, `app/`, `components/` |
| VERIFY.md freshness | `npm run check:verify` | up to date |
| tests | `npm run test` | **11 files, 237 tests** (wifi on: 237 passed, wifi off: 236 passed +1 skipped via `DB unreachable, skipping parity check`) |
| demo CLI | `npm run personas` | prints **41 rows (24 eligible, 0 no figures)**, EMI column populated (also `DEMO_MODE=true` offline) — **P41** tailoring 90k proves F2 multi-eligible ranking |
| dev server | `npm run dev` | renders `/`, `/apply` (flat purpose, cascade strict, globe), `/result` (map+PDF+explain, **P41 now 200**), `/personas`, `/admin/health-upload` + `/api/extract` (**2.5-flash → flash-latest** 429/503 `Retry-After` or `DEMO_MODE` fixture) |
| prod build | `npm run build` | compiled, **15 routes** (`ƒ /api/extract`, `ƒ /api/extract-documents`, `ƒ /api/explain`, `ƒ /api/packet`, `ƒ /api/admin/*`×5, `ƒ /admin/health-upload`, `ƒ /apply` 12.4kB), First Load JS 103 kB |
| db | `DATABASE_URL` (pooler 6543) + `npm run seed` + `dataset-db` | **connected + parity verified** — `20260905144514_init` applied, **5/15/15 +53 doc reqs** + `src/lib/dataset-db.ts` JSON↔DB deep-equal (now 2s probe, offline graceful) |
| llm | `GEMINI_API_KEY` + `gemini-2.5-flash` + `DEMO_MODE` fixture | **2.5-flash → flash-latest** fallback (was 3.6-flash, 1.5 404) with **429/503 retry + `Retry-After`** + `data/llm.fixtures.json:1` 7 fixtures (`extract:<lowercased>` + `__fallback__`), `src/llm/` 3 files + `FreeTextIntake`/`DocumentUpload`/`LoanConfirmation`/`ExplainPanel`, `DEMO MODE` banner |
| i18n | `next-intl` + `hi`/`mr` 265 keys + `india-states-districts.json` | **accurate** `hi`/`mr` + globe `LocaleSwitcher`, `RinSetu` locked, form till tehsil (36×7–16), tab English, **PartnerMap offline keys added** |
| admin | `ADMIN_PASSWORD` + `/admin/health-upload` | **done** — `rinsetu-admin` default, `health-csv.ts` quoted split + **duplicate guard fixed** (`finalSeen`), `MIS_UPLOAD` forced, preview → apply upsert |
| demo | `DEMO_MODE=true` + `public/manifest.json:1` | **done** — `PartnerMap` offline fallback (no tiles, shows codes), full demo with wifi off |

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

Git: `main` at `13b111d` (was `3f4939e`/`bd12a83`, 5 commits ahead of `9f6bffc` — `6737439 initialize RinSetu project` → `4a8eea7 built frontend` → `5eb1b1e landing page ui changes` → `b9f34ba Update README.md` → `bd12a83 handoff & progress(frontend)` → … → `13b111d`). Working tree with 5 schemes + P41 + cascade/LLM/i18n/health-csv edits (uncommitted, see §2). After this refresh: this file updated — commit before continuing. Earlier drafts claimed "nothing is committed" — that was true at the Phase 1–2 gate, no longer.

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

Four properties of the core worth knowing before you touch it (all still true at 5 schemes, 2026-09-10):

- **It is parameterised over the data.** There are no scheme numbers in `src/core/` — MICRO, TERM, EDU, **AMY (Aajeevika 15% via NBFC-MFI)** and **UNY (Udyam Nidhi 13% via Coop)** landed 2026-09-10 without a line of core changed. P41 tailoring 90k is eligible for both MICRO 6.5% and AMY 15%; ranking picks the cheaper MICRO — **F2 now live**, proves `hard filters before soft ranking` (§6) generically.
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
| `schemes.seed.json` | The scheme master: **MICRO, TERM, EDU, AMY (Aajeevika 15% via NBFC-MFI), UNY (Udyam Nidhi 13% via Coop)** — 5 schemes, all `verified: false`, most figures placeholders. Also holds `open_questions_for_phase_0` (11 entries). |
| `schemes.demo-overlay.json` | Stand-in values that fill **only null slots**, so the engine can be exercised. Stamped `demo_overlay` — now **19 `demo_overlay`** slots (was 32). |
| `partners.seed.json` | 15 fabricated channel partners on real city coordinates. |
| `partner-health.sim.json` | 15 health rows, every one `data_origin: "SIMULATED"`. |
| `health-scoring.json` | The four health weights, each with a rationale message key. |
| `documents.seed.json` | Document catalogue and per-scheme requirements — now **53 doc reqs** (AMY/UNY add `aay-jat`, `udyam-nidhi` blocks). |
| `personas.fixtures.json` | **41** test applicants covering the branch matrix — **P41** (tailoring 90k, `intent: other`, Nagpur) proves F2 multi-eligible ranking. |

Two mechanisms here carry a lot of weight (now enforced in *both* loaders, `dataset.ts:80` `prov()` + `dataset.ts:356`/`387` and `dataset-db.ts:33`):

- **`verified` is derived, never stored.** `isCitable(source)` (`src/core/types.ts:94`) is true only for `official_guideline` and `design_decision`. Setting `"verified": true` in a JSON file has no effect — fixed 2026-09-05 to derive `verified: Object.values(provenance).every(isCitable)` instead of copying `raw.verified`. There is no flag anyone can flip the night before a demo.
- **`figures_authoritative` is false for two independent reasons** — any non-citable figure in play, *and* unconditionally whenever the demo overlay is applied. It cannot be forced true. `dataset-db.ts:1` derives the same way and detects `demo_overlay` in provenance.
- **`AGE_WITHIN_RANGE` format is pinned.** `predicates.ts:132` writes `"min-max"` and `remediation.ts:94` parses `split('-')` — `tests/eligibility.age-format.test.ts:1` (6 tests, new 2026-09-05) fails if either side changes (`docs/FRAGILE.md:56` A3).

### 3.3 Messages — `src/messages/` (i18n 2026-09-05, accurate 2026-09-05, harden 2026-09-10)

`en.json` holds **265 keys** (258 +5 `partner.map.*` +2 `ui.result.download_packet*` + **2026-09-10 `partner.map.offline*` + `ui.confirm.*` fix — missing keys that broke `/result?persona=P41` now restored**), `hi.json` + `mr.json` same keys (UI `hi`/`mr` human-written via Gemini-class LLM, scheme names/amounts/`₹`/`RinSetu` kept English per glossary do-not-translate — `hi` 2 English left `_README`/`currency_symbol`, `mr` 0 after fixes). `index.ts:1` now `en`/`hi`/`mr` (`CATALOGUES`), `src/i18n.ts:1` (`getRequestConfig` cookie `locale` + Accept-Language) via `next-intl/plugin` (`next.config.ts:1`), `src/lib/locale.ts:1` + `LocaleSwitcher.tsx:1` (globe `lucide-react` `h-7 w-7` → dropdown `English/हिन्दी/मराठी`, cookie, `NextIntlClientProvider` in `layout.tsx:1` with `html lang={locale}` but `generateMetadata` hardcodes `'en'` so tab stays English). Client `translate` auto-detects `document.cookie` (`index.ts:48`), server sets `globalThis.__RINSETU_LOCALE__` after `await getLocale()` (`layout.tsx:27`, `result/page.tsx:143`, `apply/page.tsx:17`, `page.tsx:66`). Still throws on missing key; `tests/messages.coverage.test.ts` still closes the loop (added `partner.map.`).

### 3.4 Tooling

- **`npm run personas`** — runs all **41** personas through `recommend()` and prints a
  summary table (24 eligible, 0 no figures), or `npm run personas P41` for the F2 multi-eligible case (or `P19`) in full detail.
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

Current content (2026-09-10): **48 unverified figures** across 4 locations — **19 `demo_overlay` + 29 `placeholder`** (was 55 = 32 `demo_overlay` + 23 placeholders) — **5/5 schemes unverified** (MICRO/TERM/EDU/AMY/UNY). F2 now expects P41 multi.

### 3.5 Database layer — connected + parity 2026-09-05

- **`prisma/schema.prisma`** — validates (`npx prisma validate`). 10 tables via `20260905144514_init` (8 models + `_prisma_migrations`): `Scheme`, `InterestRule`, `CostCeilingRule`, `GlobalEligibility`, `Partner`, `PartnerHealth`, `DocumentDef`, `DocumentReq`, `Application`.
- **`prisma/seed.ts`** — loads `data/*.json` through the *same* loader the engine uses, so the rows in Postgres are the objects the engine was tested against. Idempotent. Demo overlay **off by default**; `npm run seed -- --with-overlay` opts in and prints a warning. Uses `pg.Pool` with `ssl:{rejectUnauthorized:false}` and stripped `sslmode` (`seed.ts:57`) for Supabase pooler.
- **`prisma.config.ts`** — Prisma 7 no longer reads the connection URL from the schema. Reads `DATABASE_URL` from `.env` conditionally — `prisma generate` works offline; only DB commands need it. `.env` now points at `aws-0-ap-south-1.pooler.supabase.com:6543` (pooled, for runtime/Vercel); use direct `5432` (`db.[PROJECT-REF].supabase.co`) for `prisma migrate dev`.
- **`src/lib/dataset-db.ts:1`** — exact reverse of seed: reads Prisma rows back into `SchemeSpec`/`Partner`/`PartnerHealthRecord`/`DocumentDefinition` that `src/lib/dataset.ts:1` produces. Async, outside `src/core/` (boundary clean), derives `verified` same way (`dataset.ts:356` fix). `loadBundleFromDb(db)` mirrors `loadBundle()`.
- **Verified live 2026-09-10** — `schemes 5` (MICRO/TERM/EDU/AMY/UNY), `partners 15`, `partner_health 15`, `global_eligibility 1` + **53 `document_req`** rows, `PrismaClient` via `@prisma/adapter-pg` returns rows with relations. **Parity:** `tests/dataset-db.parity.test.ts:1` proves JSON↔DB deep-equal (after normalizing sparse `applies_when` nulls and `required_documents` superset), 237th test, skipped without `DATABASE_URL`.

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

2. **Migration `20260905144514_init` applied and `DATABASE_URL` connected 2026-09-05, now 5/15/15 +53 doc reqs 2026-09-10.** Supabase pooler at `aws-0-ap-south-1.pooler.supabase.com:6543` (`.env`, gitignored, pooled for runtime; use direct `5432` for `prisma migrate dev`). `prisma.config.ts` still keeps `prisma generate` offline-capable — only DB commands need the URL, and `npm run seed` prints a one-line explanation and exits 1 when it is missing (verified pre-connect). Seed is idempotent via `prisma/seed.ts` through `src/lib/dataset.ts`, now seeds **5 schemes + 53 doc reqs**.

3. **Prisma 7 requires a driver adapter.** `new PrismaClient()` with no arguments throws
   at construction. `@prisma/adapter-pg` is installed and wired in `prisma/seed.ts`.
   This was determined by running it against an unreachable database, not assumed — worth
   knowing because the error message is confusing if you meet it cold.

    4. **UI is baseline-complete, Maps + PDF + i18n + form till tehsil + LLM 2.5-flash + Admin + Demo hardening + 2026-09-10 harden now done.** Phase 3–6 baseline `4a8eea7` + Maps 2026-09-05 (`PartnerMap` offline fallback 2026-09-07, **2026-09-10 offline i18n keys `partner.map.offline*`**) + PDF (`packet`/`ExplainPanel`) + i18n (globe/`RinSetu` lock/accurate `hi`/`mr`/tab `en`, **missing `ui.confirm.*` fixed — `/result?persona=P41` now 200**) + form cascade `state → district → tehsil` (36 MH×7–16, villages removed per request, auto-detect `tehsil→district→state`, all valid choices, **purpose now flat deduped without optgroups**, **cascade strict `district` disabled until `state`, `tehsil` disabled until `district`**, `paramsKey` intent-sync + `lakh`/`thousand` parsing fix, 360px mobile-first) + LLM `extract` (`name`/`tehsil`/`village`, `normalizeExtracted`, **`gemini-2.5-flash` → `gemini-flash-latest` fallback with 429/503 retry + `Retry-After`**, `DEMO_MODE` fixture cache 7 fixtures) + Admin health upload (`/admin/health-upload` 2026-09-07, **duplicate guard `finalSeen` fixed 2026-09-10**) + Demo hardening (`DEMO_MODE` + manifest + `DatasetBanner` stamp 2026-09-07) + parity offline-fix (2s probe). Code-complete; only **guideline transcription (Phase 0)** remains (see §7).

## 5. What remains / what we are trying to do

We are building **RinSetu end-to-end, then transcribing real guidelines**. All code phases (0–9) are now complete except the non-code Phase 0 figure transcription. What that means:

**What shipped in `4a8eea7` (Phase 3–6 baseline):**

- Guided intake at `/apply` (GET → `/result`, no JS required, no LLM), verdict table
  for all schemes, finance panel with amortisation schedule, partner ranking with hard
  filters + health breakdown, document checklist, dataset/provenance banners, and the
  `?persona=P01` fixture path. Design language from §6 is applied (ledger/paper,
  `globals.css` + `src/components/ui.tsx`).

**What is done — code-complete 2026-09-10** (was 2026-09-07, paused 2026-09-06):

- **5 schemes + F2 — ✓ done 2026-09-10 — `data/schemes.seed.json:1` now 5 schemes (MICRO, TERM, EDU, **AMY Aajeevika 15% via NBFC-MFI**, **UNY Udyam Nidhi 13% via Coop**), `data/personas.fixtures.json:1` 41 personas (**P41** tailoring 90k eligible for MICRO 6.5% and AMY 15% both, ranking picks MICRO — **F2 now live**, proves hard-filters-then-ranking generically), purpose dropdown now **flat deduped without `optgroup`** (eligibility is `category C` only), `documents.seed.json` 53 doc reqs, `VERIFY.md:11` now **48 unverified (was 55)** = **19 `demo_overlay` + 29 `placeholder`**, **5/5 schemes unverified**, no `src/core/` change — parameterised.**
- **`src/llm/`** — **✓ done 2026-09-06–10 — `src/llm/client.ts` now `gemini-2.5-flash` → `gemini-flash-latest` fallback (was 3.6-flash, was 1.5 404) with **429/503 retry + `Retry-After` handling** (`ListModels` 200, quota 20/min), `extract.ts` (`name`/`tehsil`/`village`, `normalizeExtracted` + **`lakh`/`thousand` parsing fix**, `extractFromDocuments` multimodal `inlineData` `requiredDocCodes`, **2026-09-07 `DEMO_MODE` fixture cache `extract:<lowercased>` + `__fallback__` via `data/llm.fixtures.json:1`)**, `explain.ts` (prose, no numbers, deterministic `DEMO_MODE` fallback), `/api/extract` + `/api/extract-documents` + `/api/explain` + `FreeTextIntake.tsx:1` (fills form, stays on `/apply`, missing-field nudge, no jump, now `DEMO MODE` hint) + `LoanConfirmation.tsx:1`/`DocumentUpload.tsx:1`/`ExplainPanel.tsx:1` (required docs only for confirmed loan, `Re-apply`). Guided form still primary, LLM needs `GEMINI_API_KEY` + network except in `DEMO_MODE`.**
- **PDF packet** — **✓ done 2026-09-05 — `packet.tsx` + `/api/packet` + `result` download link. Reuses `recommend()`; no new numbers.**
- **Multilingual + form harden — ✓ done 2026-09-05–10** — `next-intl` + `hi.json`/`mr.json` (265 keys + **PartnerMap offline `partner.map.offline*` i18n keys added 2026-09-10**, accurate `hi`/`mr` via Gemini-class LLM, `hi` 2 left `mr` 0, brand `RinSetu` lock, tab stays `en`, **missing `ui.confirm.*` keys fixed 2026-09-10 — `/result?persona=P41` now 200 was 500**), `src/i18n.ts:1` + `LocaleSwitcher` (globe), `layout`/`result`/`apply`/`personas`/`packet` locale-aware, form till tehsil (36 MH×7–16, `village` removed, auto-detect `tehsil→district→state`, **purpose flat deduped**, **cascade strict `district` disabled until `state`, `tehsil` disabled until `district`, `paramsKey` intent-sync + `lakh`/`thousand` fix**).**
- **Admin health-data upload — ✓ done 2026-09-07–10** — `/admin/health-upload` (`src/app/admin/health-upload/page.tsx:1` + `src/components/AdminHealthUpload.tsx:1` + `AdminLogin.tsx:1`) + `src/lib/admin-auth.ts:1` (`ADMIN_PASSWORD` → `sha256` cookie `rinsetu_admin` 8h, default `rinsetu-admin`) + `src/lib/health-csv.ts:1` (quoted split, `npa_pct` 0..100, forced `MIS_UPLOAD`, **duplicate guard `finalSeen` fixed 2026-09-10 — valid > invalid**) + 5 APIs (`/api/admin/login|logout|health-preview|health-apply|health-template`), template CSV, preview (valid/invalid per line) → apply upsert `(partnerCode,asOf)`. `PartnerHealth.data_origin` still `SIMULATED` until first CSV; `PartnerPanel.tsx:1` already renders `DataOriginBadge`.
- **`DEMO_MODE` fixture cache + offline hardening — ✓ done 2026-09-07** — `DEMO_MODE=true` (`next.config.ts:4` `NEXT_PUBLIC_DEMO_MODE`, `src/app/layout.tsx:26` `window.__RINSETU_DEMO__`, `public/manifest.json:1` PWA) → `src/llm/extract.ts:119` fixture cache (7 fixtures) + `src/llm/explain.ts:49` deterministic prose + `src/components/DatasetBanner.tsx:1` `DEMO MODE` stamp + `src/components/PartnerMap.tsx:48` offline fallback (no OSM fetch, shows codes) + `tests/dataset-db.parity.test.ts:38` now `DB unreachable, skipping parity check` (2s probe, 236+1 skipped wifi off). Full demo runs with wifi off.
- **`README.md`** — was boilerplate at Phase 2, 58 lines at `b9f34ba`; rewritten 2026-08-31 to a full setup + architecture doc, refreshed 2026-09-07 for admin+demo+parity, **2026-09-10 still accurate (237 tests, 15 routes).**

**What we are trying to do next (deferred, not code):**

- **Phase 0 verification** — **48 unverified figures (was 55) — 19 `demo_overlay` + 29 `placeholder` (`VERIFY.md:11`), 5/5 schemes unverified**, 11 open questions (`data/schemes.seed.json:1` `open_questions_for_phase_0`). Need official guideline `source_url`/`source_date` per field; engine ingests without logic change, `figures_authoritative` flips automatically when citable. F2 now expects P41 multi.
- Optional polish — Lighthouse a11y ≥90, XLSX alongside CSV, voice/Bhashini, Vercel deploy. Not blocking the code gate.

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
| `/personas` | `src/app/personas/page.tsx` | **41** fixtures live through `recommend()` at render time (P41 proves F2); no stored outcomes. |
| `/api/packet` | `src/app/api/packet/route.ts:1` | `GET` same query as `/result` → `application/pdf` (`renderToBuffer(<PacketDocument>)`, `force-dynamic`). Pre-filled packet, no new numbers. |

Components: `ui.tsx` (Provenance/StatusPill/VerdictMark/FieldRow/DataOriginBadge), `DatasetBanner.tsx` (full + compact), `SchemeCard.tsx`, `VerdictList.tsx`, `LoanFigures.tsx` (incl. `computable: false` branch), `PartnerPanel.tsx` (dual ranking, exclusion reasons, SIMULATED badge) + `PartnerMap.tsx:1` (MapLibre GL JS `6.7.0` + OSM raster, eligible-only markers, `fitBounds`, 240/320px, 360px), `ChecklistPanel.tsx`, `form.tsx`, `ScrollReveal.tsx`. Lib: `packet.tsx:1` (`PacketDocument`), `applicant-params.ts` (query ↔ `ApplicantProfile`), `format.ts`, `view.ts`.

Invariants preserved: no `src/core/` import from `src/llm/`/`app/`/`components/`; LLM never decides; every figure carries `FieldProvenance` rendered as a stamp; failures kept with remediations.

## 7. The exact next step — code-complete, what we try next

All code phases (3–9) are done. The remaining work is **non-code** (see §5):

 1. **Maps (Phase 4 tail):** **✓ done 2026-09-05–10 — `PartnerMap.tsx:1` (OSM `tile.openstreetmap.org`, eligible-only, `fitBounds`, 2026-09-07 offline fallback `tile` skip when `!navigator.onLine` or `DEMO_MODE`, shows ranked codes, **2026-09-10 offline i18n `partner.map.offline*` keys added**) wired via `PartnerPanel.tsx:222` + `SchemeCard.tsx:66`.**
2. **PDF packet (Phase 6 tail):** **✓ done 2026-09-05 — `src/lib/packet.tsx:1` + `src/app/api/packet/route.ts:1` (`GET /api/packet?...` → PDF, `renderToBuffer`, ledger styles) + `src/app/result/page.tsx:178` download link. Reuses `recommend()`; no new numbers.**
3. **Multilingual (Phase 7):** **✓ done 2026-09-05–10 — `next-intl` + `hi.json`/`mr.json` (265 keys + offline keys, accurate via Gemini-class LLM, `hi` 2 left `mr` 0, brand `RinSetu` lock, tab stays `en`, `LocaleSwitcher` globe, **2026-09-10 missing `ui.confirm.*` fixed — `/result?persona=P41` 200**) + `src/i18n.ts:1`/`LocaleSwitcher`/`layout`/`result`/`apply`/`personas`/`packet` locale-aware, form till tehsil (36 MH×7–16, **purpose now flat deduped**, **cascade strict**).**
4. **LLM boundaries (enhancement, Phases 3/7):** **✓ done 2026-09-06–10 — `src/llm/client.ts` now `gemini-2.5-flash` → `gemini-flash-latest` fallback (was 3.6-flash, was 1.5 404) with **429/503 retry + `Retry-After` handling** + `extract.ts` (`name`/`tehsil`/`village`, `normalizeExtracted` + `lakh`/`thousand` fix, `extractFromDocuments` multimodal `requiredDocCodes`, 2026-09-07 `DEMO_MODE` `extract:<lowercased>` + `__fallback__` fixture cache, **2026-09-10 `paramsKey` intent-sync fix**), `explain.ts` (deterministic fallback), `/api/extract`/`/api/extract-documents`/`/api/explain` + `FreeTextIntake` (fills form, stays on `/apply`, missing nudge) + `LoanConfirmation`/`DocumentUpload` (required only for confirmed loan) + `ExplainPanel`, `GEMINI_API_KEY` in `.env` or `DEMO_MODE=true` fixture.**
5. **Admin health upload (Phase 8):** **✓ done 2026-09-07–10 — `/admin/health-upload` (`src/app/admin/health-upload/page.tsx:1` + `AdminHealthUpload.tsx:1` + `AdminLogin.tsx:1` + `src/lib/admin-auth.ts:1` + `health-csv.ts:1` + 5 `api/admin/*`), CSV `partner_code…as_of` → `PartnerHealth.data_origin=MIS_UPLOAD` (default `rinsetu-admin`, 8h cookie), `DB unreachable` guard, **2026-09-10 duplicate guard `finalSeen` fixed**.**
6. **Demo hardening (Phase 9):** **✓ done 2026-09-07 — `DEMO_MODE=true` (`next.config.ts:4` `NEXT_PUBLIC_DEMO_MODE`, `layout.tsx:26` `window.__RINSETU_DEMO__`, `public/manifest.json:1` PWA, `DatasetBanner` `DEMO MODE` stamp, `PartnerMap` offline fallback) + `tests/dataset-db.parity.test.ts:38` now 2s probe + `DB unreachable, skipping parity check` (236+1 skipped wifi off). Full demo runs with wifi off.**
7. **5 schemes + F2 + cascade/LLM harden (2026-09-10):** **✓ done — 5 schemes (MICRO/TERM/EDU/AMY 15% NBFC-MFI/UNY 13% Coop) + 41 personas P41 tailoring 90k proves F2 ranking (MICRO 6.5% > AMY 15%) + purpose flat deduped + cascade strict (`district`/`tehsil` disabled) + `paramsKey` + `lakh` fix + LLM 2.5-flash fallback + `ui.confirm` fix + health-csv guard + PartnerMap offline i18n.**

**We are trying to do next — updated 2026-09-11 after Phase 0 check + intent-filter:**

**Immediate — done 2026-09-11:**
- **Phase 0 transcription attempt:** fetched `NSFDC SCHEMES` PDF `2026-06-15` + `LENDING POLICY` 172p `2026-05-15` staging — both confirm costs/rates/tenure/duration but contain **no explicit `margin_pct` / `subsidy` / `moratorium_interest_treatment`**; all three correctly stay `placeholder TODO(verify)` per hard rule 1, notes updated `data/schemes.seed.json:31`, `VERIFY.md:58` now records check date. Goal `MICRO/TERM → verified:true` blocked pending a circular that actually states the 3 fields — ask nodal officer for written treatment.
- **Intent-filter + LoanConfirmation:** `src/app/result/page.tsx:180` now filters by `intent` and re-derives recommendation; `P41` tailoring `90k LIVELIHOOD` shows `MICRO+AMY` only (EDU hidden), education `pro_course` shows only `EDU`. Both `ELIGIBLE` radios still shown `src/components/LoanConfirmation.tsx:15` — verify with you on next `P41` demo.

**Next (this week):**
- **Save my applications:** wire `Application` `prisma/schema.prisma:47` — `POST /api/applications` on `See result` → `GET /applications` list, so manual form isn't lost if you lose the link `src/lib/applicant-params.ts:122`.
- **Deploy:** `Vercel` + `Supabase` prod, `DEMO_MODE` rehearsal `docs/ROADMAP.md:391` 4-min script, record video.
- **Polish:** Lighthouse a11y, replace `PLACEHOLDER_*` with real `indicative-activities` flat list (you asked purpose should be generic, not scheme-picked — done `ApplyForm.tsx:59`), `ui.upload` fix done.

After that: Vercel deploy + rehearsal (§12).

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

That must end with `237 passed` (11 files, wifi on: 237 passed, wifi off: 236 passed +1 skipped `DB unreachable, skipping parity check`). If it does not, stop and fix that before writing anything new — every claim in this document was true at `13b111d` (re-checked 2026-09-10, 5 schemes + P41 + cascade/LLM harden).

Working tree will be dirty with the 2026-09-10 doc refresh (this file); commit before continuing. The old instruction to `git add -A && git commit -m "Phases 1-2: ..."` was for the Phase 1–2 gate when nothing was committed — that gate is now captured in `6737439`/`4a8eea7` plus `13b111d`.

**Where we are now — 2026-09-11 after intent-filter + Phase 0 check:** `npm run check` **11/237** green (236+1 skipped offline), `npm run build` **15 routes** (`ƒ /api/admin/*`×5 + `ƒ /admin/health-upload`, locale via `cookies()`), DB **5/15/15 +53 doc reqs** + `GEMINI_API_KEY` **`gemini-2.5-flash` → `flash-latest` 429/503 `Retry-After`** + `DEMO_MODE=true` fixture cache (7 fixtures) + `ADMIN_PASSWORD=rinsetu-admin` (default), i18n `hi`/`mr` accurate (PartnerMap offline keys + `ui.confirm` fix), form `state→district→tehsil` (36×7–16, `village` removed, **purpose flat deduped**, **cascade strict** `district`/`tehsil` disabled, `paramsKey` + `lakh`/`thousand` fix, auto-detect `tehsil→district→state`, 360px mobile-first) + **`result/page.tsx:180` intent-filter (EDU hidden from livelihood, livelihood hidden from education)** + **Phase 0 check 2026-09-11 PDFs: no margin/subsidy/treatment found, stays placeholder**, free-text stays on `/apply` + missing nudge, admin CSV → `MIS_UPLOAD` (duplicate guard fixed), map offline fallback, **41 personas / 24 eligible / 0 no figures (P41 proves F2)**. **Next:** **Phase 0 still blocked on written treatment** (48 figures — 19 `demo_overlay` + 29 `placeholder`, 5/5 schemes unverified + 11 open questions) — see `docs/ROADMAP.md` §10 and `VERIFY.md:58` checked notes.

To see the engine work with no database and no API key:

```bash
npm run personas          # 41 rows (24 eligible, 0 no figures), live through recommend()
DEMO_MODE=true npm run personas  # same, offline fixture path
npm run dev               # http://localhost:3000 — /, /apply, /result?persona=P41, /personas, /admin/health-upload
DEMO_MODE=true npm run dev  # offline demo — no GEMINI_API_KEY, no tiles, parity skips
```

To see a single persona's full result: `npm run personas P41` (F2 multi) or `npm run personas P19` or open
`/result?persona=P41` in the browser — now 200 (was 500 before `ui.confirm` fix).

Fresh-clone build also verified 2026-09-10: `npm run build` compiles cleanly —
`ƒ /`, `ƒ /apply`, `ƒ /result` (`ƒ /result?persona=P41` 200), `ƒ /admin/health-upload`, 103 kB First Load JS.
DB path verified 2026-09-10: `npx prisma migrate status` sees `20260905144514_init` as applied; `5/15/15 +53` via pooler 6543 (`npm run seed` idempotent). Offline path verified 2026-09-10: `DEMO_MODE=true` `npx tsx` extract + `npm run personas` 41 rows + `PartnerMap` fallback, parity 236+1 skipped.

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
