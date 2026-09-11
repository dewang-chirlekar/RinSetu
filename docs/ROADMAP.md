# RinSetu — SIH26092 Build Roadmap

**Problem Statement:** SIH26092 — AI-Driven Scheme Matching for Marginalized Entrepreneurs
**Working name:** RinSetu (*ṛin* = credit, *setu* = bridge). The PS itself says the goal is to "bridge the gap between the beneficiaries and the channelizing agencies," so the name argues your case for you. Rename freely.
**Document owner:** _________ · **Last updated:** 2026-09-11 · **HEAD:** `8cfdefc` on `main` + 5 schemes + 41 personas + harden 2026-09-10 + Save my applications 2026-09-11 (18 routes) — **code-complete + Save**

> **Progress through 2026-09-11 (code-complete + Save — where we are):** Phases **0–2 complete, 3–6 baseline shipped** (`13b111d` + `4a8eea7` + `5eb1b1e` + `bd12a83` — 5 schemes + 41 personas + harden 2026-09-10) + **DB connected + parity** (Supabase pooler 6543, `20260905144514_init`, `dataset-db.ts` JSON↔DB deep-equal, 2026-09-07 offline-graceful `DB unreachable, skipping parity check` + 2s probe) + **schemes** (5 from https://nsfdc.nic.in/scheme 09.09.2026: MICRO 1.40L/1.25L 6.5%, TERM 50L/45L 8%, EDU 40L 6.5%, AMY 1.40L 15% NBFC-MFI, UNY 5L 13% Coop) + **personas** (41, P41 tailoring 90k multi-eligible MICRO+AMY proving F2) + **core hardened** (A3 `age 18-60` pinned, `verified` derived) + **Maps** (`PartnerMap` MapLibre `6.7.0` OSM, 2026-09-07 offline fallback) + **PDF** (`packet` + `/api/packet`) + **i18n** (`next-intl` `hi`/`mr` 265 keys accurate, globe `LocaleSwitcher`, brand `RinSetu` lock, tab stays `en`, `layout`/`result`/`apply`/`personas`/`packet` locale-aware) + **form till tehsil** (`india-states-districts.json` 36 states + every district, MH 36×7–16 tehsils + 364 villages, `ApplyForm` `state→district→tehsil` strict cascade `tehsil→district→state` auto-detect, purpose dropdown flat deduped (no optgroup scheme names), `village` removed per request, `FreeTextIntake` fills form + stays on `/apply` + missing nudge) + **LLM** (`src/llm/` `gemini-2.5-flash` fallback (was 1.5 404, 3.6-flash, now 2.5-flash with 503 handling, quota 20/min `429` retry + `503` fallback), `extract` `name`/`tehsil`/`village` + `normalizeExtracted` + `DEMO_MODE` fixture cache 7 fixtures, `/api/extract`/`/api/extract-documents`/`/api/explain` + `DocumentUpload`/`LoanConfirmation`/`ExplainPanel`, `GEMINI_API_KEY` or `DEMO_MODE=true`) + **admin** (`/admin/health-upload` CSV→`MIS_UPLOAD` 2026-09-07, `health-csv.ts` + `admin-auth.ts`) + **demo hardening** (`DEMO_MODE` banner, `public/manifest.json`, `PartnerMap` fallback 2026-09-07) + **Save my applications 2026-09-11** (`POST /api/applications` + `GET /applications` list/receipt, 18 routes, `src/lib/db.ts` + `SaveApplicationButton.tsx`). Deterministic core, **237 tests** (11 files, 236+1 skipped offline) green, `npm run personas` and `/result` (map+PDF+explain+upload) work end-to-end with `DEMO_MODE=true` offline. UI baseline renders `/`, `/apply` (free-text + guided, till tehsil), `/result` (verdict + finance + map + partners + checklist + PDF + explain + upload), `/personas`, `/admin/health-upload`. **Next:** **Phase 0 harden** (now 48 unverified was 55, 5 schemes live from https://nsfdc.nic.in/scheme 09.09.2026, 11 open questions) — see `docs/PROGRESS.md` §2/§5/§7 + `VERIFY.md` for gate. Guideline transcription partially done, harden 2026-09-10 (`13b111d`) ships purpose dedupe + LLM 503 fallback + strict cascade.

---

## 0. Read this first

Two sentences that should govern every decision in this project:

> **The language model never decides anything and never produces a number.** It parses messy human input into a structured profile at one end, and narrates a decision at the other. Everything in between — eligibility, loan amount, EMI, partner ranking — is deterministic, versioned, and unit-tested code.

> **Every figure in the app carries provenance.** Each number is tagged `official_guideline`, `open_data`, or `simulated`, and the UI shows that tag. You cannot get real per-partner NPA data, so you will show simulated values — labelled, out loud, before a judge asks.

These are not just engineering hygiene. They are your two strongest lines in the pitch, and they pre-empt the two questions most likely to sink you.

### The one-sentence pitch

> RinSetu takes a spoken description of a livelihood plan, determines in deterministic code which concessional credit scheme the applicant qualifies for and why they *don't* qualify for the others, computes the exact loan and EMI under that scheme's guidelines, routes them to the nearest Channel Partner that actually handles that loan category, and hands them a complete, pre-filled application packet — so the file arrives correct the first time.

---

## 1. Scope

### In scope (the three required deliverables)

| # | PS deliverable | What we build |
|---|---|---|
| 1 | Smart Scheme Recommender | Deterministic predicate-based eligibility engine over the scheme master, returning pass **and** fail reason codes. LLM only parses the input. |
| 2 | Financial Calculator | Pure functions: eligible project cost → subsidy → margin money → loan → EMI with correct moratorium treatment → full amortisation schedule. |
| 3 | Geo-Spatial Partner Locator & Router | Map of Channel Partners, filtered by capability and jurisdiction, ranked by distance × partner-health score. "Router" = generates a routed application packet and notifies the partner's listed contact. |

### Our two differentiators (decided now, not later)

| # | Feature | Why it wins |
|---|---|---|
| A | **Path to eligibility** — for every scheme the applicant fails, show the specific reason and the minimum change that would qualify them | The PS's own impact goal is "enhance financial literacy." Almost nobody builds the negative case. It converts a rejection into guidance. |
| B | **Document readiness + pre-filled packet** | The PS complains about "misrouted applications" and "delays in disbursement." The cure isn't a better recommendation — it's the file arriving complete. Directly attacks the stated pain. |

### Explicitly out of scope (say this in the pitch before you're asked)

- Real integration with 100+ Channel Partners' loan-origination systems. We generate a packet and notify a contact. We do not pretend to have API access to a hundred banks.
- Live disbursement status. We model an acknowledgement handshake; we cannot see inside partner systems.
- Real per-partner NPA / fund-utilisation figures. Schema + admin upload path + clearly-labelled simulated seed.
- Native mobile app. Web only, mobile-responsive. (See §4 note.)
- Credit scoring or approval decisions. We tell you what you're *eligible to apply for*. We never imply sanction.

---

## 2. Architecture

```
                        ┌──────────────────────────────────────┐
                        │  Web client (Next.js, mobile-first)  │
                        │  guided form  ·  or free-text/voice  │
                        └───────────────┬──────────────────────┘
                                        │
              ┌─────────────────────────▼─────────────────────────┐
              │  INTAKE — LLM boundary #1                         │
              │  free text → Gemini structured output → Zod       │
              │  validate → ApplicantProfile                      │
              │  ⚠ falls back to the plain form if LLM is down    │
              └─────────────────────────┬─────────────────────────┘
                                        │  ApplicantProfile (typed, validated)
        ┌───────────────────────────────▼───────────────────────────────┐
        │              DETERMINISTIC CORE — no LLM in here              │
        │                                                               │
        │  ┌─────────────────────┐   ┌──────────────────────────────┐   │
        │  │ Eligibility engine  │   │ Financial calculator         │   │
        │  │ predicates/scheme   │──▶│ cost→subsidy→margin→loan     │   │
        │  │ pass + fail codes   │   │ →EMI (moratorium-aware)      │   │
        │  │ path-to-eligibility │   │ →amortisation schedule       │   │
        │  └─────────────────────┘   └──────────────┬───────────────┘   │
        │                                          │                    │
        │  ┌───────────────────────────────────────▼────────────────┐   │
        │  │ Partner matcher                                        │   │
        │  │ filter: handles scheme category · ticket size · state  │   │
        │  │ rank:   haversine distance × partner-health score      │   │
        │  └───────────────────────────────────────┬────────────────┘   │
        │                                          │                    │
        │  ┌───────────────────────────────────────▼────────────────┐   │
        │  │ Document checklist resolver (scheme × partner type)    │   │
        │  └───────────────────────────────────────┬────────────────┘   │
        └──────────────────────────────────────────┼────────────────────┘
                                                   │  RecommendationResult
              ┌────────────────────────────────────▼─────────────────────┐
              │  EXPLANATION — LLM boundary #2                           │
              │  structured result → plain-language narration in the     │
              │  user's language. Receives ONLY the computed result.     │
              │  Do-not-translate glossary enforced. Cannot add facts.   │
              └────────────────────────────────────┬─────────────────────┘
                                                   │
   ┌───────────────────────────────────────────────▼────────────────────────────┐
   │  Recommendation card · EMI schedule · ranked partner map · checklist ·     │
   │  pre-filled PDF packet · provenance badges on every figure                │
   └────────────────────────────────────────────────────────────────────────────┘
```

**Why this shape.** A jury officer from the sponsoring corporation knows their own scheme rules and rate card. If a language model emits the loan ceiling or the EMI, it will eventually emit a plausible wrong one, and that is an unrecoverable demo failure. With this architecture you get to say: *"the model physically cannot invent a scheme or a rupee figure — it can only narrate rows and numbers the rules engine produced."* That sentence is worth more than any feature.

---

## 3. Tech stack (pinned)

Chosen for a team that is mostly new to this: **one language end to end**, maximum copy-pasteable examples, no infrastructure you have to operate.

| Layer | Choice | Why this, not the alternative |
|---|---|---|
| Framework | **Next.js 15 (App Router) + TypeScript** | One repo, one deploy, one language for UI and API. Largest volume of examples and the stack AI codegen handles most reliably. |
| Styling | **Tailwind CSS + shadcn/ui** | Components you own and can read, no design system to learn. Accessible defaults matter for this user base. |
| Database | **PostgreSQL on Supabase** (free tier) | Hosted, no ops. Neon is an equally fine swap. |
| ORM | **Prisma** | Friendliest errors and docs for beginners. Migrations are a single command. |
| Geo | **Haversine in TypeScript. No PostGIS.** | You have ~150 partners. Distance over 150 rows in plain JS is sub-millisecond. PostGIS is a real dependency that buys you nothing at this scale. Upgrade only if the registry passes ~50k rows. |
| Maps | **MapLibre GL JS + OpenStreetMap raster tiles** | Free, no API key, no billing card, no key leaking in a public repo. Google Maps has better India POI data — swap only if you hit a real limitation. |
| Geocoding | **Nominatim, run once offline at seed time** | Never geocode during a request or a demo. Geocode the partner list once, commit the lat/lng, done. |
| LLM | **Google Gemini (Flash tier)** via `@google/generative-ai` | Free tier, strong on Indian languages. Accessed through one adapter module so the provider is swappable. |
| LLM safety | **Structured output + Zod validation** | Gemini `responseSchema` for extraction, then Zod-parse the result. Reject and fall back to the form on any validation failure. |
| i18n | **next-intl** with JSON message catalogs | Static UI strings are human-written, not machine-translated at runtime. |
| Voice (optional) | **Web Speech API**, then **Bhashini / ULCA** if time allows | Web Speech is free and zero-setup. Bhashini is the Government of India's own language stack — using it is a meaningful signal to a government jury. |
| PDF | **@react-pdf/renderer** | TypeScript-native, no headless browser to deploy. |
| Testing | **Vitest** | Non-negotiable for the calculator and rules engine. See §9. |
| Auth | **None for beneficiaries. Admin-only login** for the partner-health upload | Do not burn days on auth. It scores nothing here. |
| Hosting | **Vercel** + Supabase | Both free tier. Plus a `docker-compose` local path for the offline demo build. |

**Do not add:** Redux (server components + URL state is enough), GraphQL, a microservice split, Kubernetes, Kafka, a vector database (you have three schemes, not a corpus), or blockchain. Each of these is a week you don't have and a question you can't answer.

### Note on "web only"

Respecting your call — build web only. Two cheap hedges, because this PS's users are rural beneficiaries on phones: design mobile-first at 360px width from day one (free if you start there, expensive to retrofit), and know that adding a PWA manifest plus a service worker later is roughly an hour's work if a mentor asks for something installable. Not doing it now; just don't paint yourself into a desktop-only layout.

---

## 4. Repo structure

```
rinsetu/
├─ CLAUDE.md                     ← project constitution; read by the codegen agent
├─ VERIFY.md                     ← running list of every unverified figure. Nothing ships at verified:false
├─ README.md
├─ prisma/
│  ├─ schema.prisma
│  └─ seed.ts
├─ data/
│  ├─ schemes.seed.json          ← scheme master, provenance-tagged
│  ├─ partners.seed.json         ← channel partner registry, geocoded
│  ├─ partner-health.sim.json    ← SIMULATED. Loudly labelled.
│  ├─ documents.seed.json        ← checklist master, scheme × partner type
│  └─ personas.fixtures.json     ← 40 test applicants = unit tests + demo script
├─ src/
│  ├─ core/                      ← ★ THE HEART. Pure functions. Zero imports from ui/ or llm/
│  │  ├─ types.ts                   ApplicantProfile, SchemeSpec, RecommendationResult
│  │  ├─ eligibility/
│  │  │  ├─ predicates.ts           one function per rule, returns a ReasonCode
│  │  │  ├─ engine.ts               runs predicates, aggregates verdicts
│  │  │  └─ remediation.ts          failed predicate → minimum qualifying change
│  │  ├─ finance/
│  │  │  ├─ loan.ts                 eligible cost → subsidy → margin → loan
│  │  │  ├─ emi.ts                  EMI + moratorium treatments + schedule
│  │  │  └─ rounding.ts             one rounding policy, applied everywhere
│  │  ├─ partners/
│  │  │  ├─ distance.ts             haversine
│  │  │  ├─ health.ts               transparent composite score
│  │  │  └─ match.ts                filter then rank
│  │  └─ documents/resolve.ts
│  ├─ llm/                       ← the ONLY two files allowed to call Gemini
│  │  ├─ client.ts                  provider adapter + DEMO_MODE fixture cache
│  │  ├─ extract.ts                 boundary #1: text → ApplicantProfile
│  │  └─ explain.ts                 boundary #2: result → prose
│  ├─ app/                       ← routes
│  │  ├─ (public)/…
│  │  ├─ admin/health-upload/…
│  │  └─ api/…
│  ├─ components/
│  ├─ messages/                  ← en.json, hi.json, …
│  └─ lib/
└─ tests/
   ├─ finance.golden.test.ts     ← hand-computed EMI values
   ├─ eligibility.branches.test.ts
   └─ personas.snapshot.test.ts
```

The single most important line in that tree: **`src/core/` must not import from `src/llm/` or `src/app/`.** Enforce it with an ESLint boundary rule. If the core stays pure, it stays testable, and if it stays testable you can defend every number on stage.

---

## 5. Data model

```
Scheme            id, code, name, name_i18n, type(MICRO|TERM|EDUCATION),
                  max_unit_cost, max_loan, min_loan, loan_pct_cap,
                  margin_pct, subsidy_pct, subsidy_cap, subsidy_timing(FRONT|BACK),
                  interest_rules[], moratorium_months_min/max,
                  moratorium_interest_treatment(CAPITALISED|SERVICED|WAIVED),
                  tenure_months_max, eligible_purposes[],
                  predicates[], allowed_partner_types[],
                  source_url, source_date, verified

InterestRule      scheme_id, applies_when{gender?, loan_band?, purpose?}, annual_rate_pct
                  ← rates vary by slab/category; never a single scalar on Scheme

Partner           id, name, type(SCA|PSB|RRB|NBFC_MFI), state, district, address,
                  lat, lng, contact_phone, contact_email,
                  handles_scheme_types[], min_ticket, max_ticket,
                  languages[], jurisdiction_states[],
                  source, verified

PartnerHealth     partner_id, as_of, funds_sanctioned, funds_utilised,
                  overdue_amount, npa_pct, avg_processing_days,
                  capacity_flag, data_origin(MIS_UPLOAD|SIMULATED)   ← always rendered

DocumentReq       scheme_id, partner_type, doc_code, name_i18n,
                  mandatory, where_to_obtain_i18n, notes

Application       id, profile_json, scheme_id, partner_id, computed_json,
                  packet_pdf_url, status, created_at
```

Two details that matter more than they look:

`InterestRule` as a separate table, not a `rate` column on `Scheme`. The PS contradicts itself on rates (background says 6.5–8%, deliverable 2 says 6.5–15%), which tells you rates are banded by scheme and probably by category or gender. A scalar column will force you to hardcode a lie.

`data_origin` on `PartnerHealth`, non-nullable. Every UI surface that consumes health data reads this field and renders a badge. Make it structurally impossible to display a simulated figure without the label.

---

## 6. Dataset plan

This is where teams lose. Own it in week one.

| # | Dataset | Rows | Source | How | Risk |
|---|---|---|---|---|---|
| 1 | **Scheme master** | 3–6 | Official scheme guidelines from the sponsoring corporation's site | Manual transcription, two people independently, then diff | **Low volume, high stakes.** Every number gets `source_url` + `source_date` + `verified` |
| 2 | **Channel partner registry** | ~100–150 | Corporation's state-wise SCA list; bank/RRB branches from OpenStreetMap Overpass (`amenity=bank`) | Assemble semi-manually, geocode once via Nominatim, commit lat/lng | Clean SCA list is realistic; exhaustive bank coverage is not. Label `source` per row |
| 3 | **Partner health** | = #2 | **Does not exist publicly** | Schema + admin CSV upload + labelled simulated seed | The honest-framing risk. See §7 |
| 4 | **District boundaries** | ~750 | Open district GeoJSON (e.g. datameet) | Simplify geometry aggressively for web payload | Large files; simplify or you'll ship 20MB |
| 5 | **Document checklist** | ~40 | Derived from guidelines in #1 | Transcribe with the schemes | Verify with the schemes |
| 6 | **i18n catalogs** | ~300 keys × N | Written by your team's native speakers | Human-written, reviewed | Quality over count. Four good languages beat twelve broken ones |
| 7 | **Persona fixtures** | 40 | Written by you | Cover every branch and every boundary | These *are* your tests and your demo script |

### Persona fixtures — write these before you write features

Forty applicants that hit every branch: income exactly at the cap and one rupee over; project cost at the Micro/Term boundary; education in India vs abroad; missing caste certificate; missing income proof; a purpose not in `eligible_purposes`; a district with no eligible partner; a loan above every partner's `max_ticket`; a woman applicant if rates are gendered; an applicant eligible for multiple schemes simultaneously.

They pay for themselves three times: they are your unit tests, they seed your demo, and they are the answer when a judge says "what if someone…" — you say "persona 23, let me show you," and you run it live.

### Data honesty policy

1. No number enters the codebase without `source_url` and `source_date`.
2. Anything unverified is `verified: false` and listed in `VERIFY.md`. The build prints a warning listing them.
3. `verified: false` figures render with a dotted underline and a tooltip in the UI.
4. Simulated data renders an amber "SIMULATED" chip, always, everywhere.
5. Nothing goes on a demo slide at `verified: false`.

Turn the weakness into a visible integrity feature. Judges from a lending body have seen a hundred demos with confident fake numbers. Provenance badges will read as unusual maturity.

---

## 7. The partner-health problem — the honest framing

You cannot get real per-partner NPA and fund-utilisation data. It is internal MIS, and publishing which state agency carries bad NPAs is sensitive. Plan:

**Build it as a pluggable feed.** Define the schema. Ship an admin screen that accepts a CSV/XLSX matching that schema. Seed with clearly-labelled simulated values. Write one paragraph of documentation specifying exactly which MIS export would populate it in production.

**Say it first, in the demo, unprompted.** Around the 2-minute mark: *"Partner health here is simulated — this field is designed to be fed from your own MIS, and this is the exact upload path and schema it expects."* Said before anyone asks, that is competence. Said after you're caught, it's a collapse.

**Make the score transparent, not clever.** A weighted composite whose weights are visible in the UI, with the contribution of each factor shown on hover:

```
health = w₁·fund_availability + w₂·(1 − npa_norm) + w₃·(1 − overdue_norm) + w₄·speed_norm
```

Resist the temptation to make this a model. There is no training data, and a learned score you cannot explain is strictly worse here than four weights you can defend.

**Separate hard filters from soft ranking.** Capability, ticket size and jurisdiction are hard filters — a partner that doesn't handle education loans must never appear for an education loan, at any distance. Distance and health are soft ranking. Let the user toggle "nearest" vs "fastest-moving" and show both orderings; it demonstrates you understood that these are different objectives.

---

## 8. Two specs to get exactly right

### 8.1 The financial calculator

Compute in this order. Do not reorder — each step feeds the next.

```
1. eligible_cost   = min(project_cost, scheme.max_unit_cost)
2. subsidy         = min(scheme.subsidy_pct × eligible_cost, scheme.subsidy_cap)
3. own_contribution= scheme.margin_pct × eligible_cost
4. gross_loan      = eligible_cost − own_contribution − (subsidy if subsidy_timing == FRONT else 0)
5. loan            = min(gross_loan, scheme.max_loan, scheme.loan_pct_cap × eligible_cost)
6. rate            = resolve InterestRule for {loan band, purpose, applicant attrs}
7. emi + schedule  = amortise(loan, rate, tenure, moratorium, treatment)
```

Standard EMI, with `r` = monthly rate = annual_pct / 12 / 100 and `n` = repayment months:

```
EMI = P · r · (1+r)ⁿ / ((1+r)ⁿ − 1)          and for r = 0:  EMI = P / n
```

**Moratorium is where you will get it wrong.** There are three conventions and they give materially different EMIs. Which one applies is a property of the scheme and must come from the guideline, which is why `moratorium_interest_treatment` is a field and not an assumption:

- `CAPITALISED` — interest accrues during the moratorium and is added to principal. Amortise `P' = P·(1+r)^m` over `n` months.
- `SERVICED` — borrower pays interest monthly during the moratorium, no principal. Amortise the original `P` over `n`; moratorium payments are `P·r` each.
- `WAIVED` — interest neither charged nor capitalised during the moratorium (occurs in subsidised schemes). Amortise `P` over `n`.

Also confirm from the guideline, and encode as fields rather than guessing: whether `subsidy_timing` is front-end (reduces the loan, and therefore the EMI) or back-end (adjusted at closure, EMI unchanged); whether tenure is inclusive or exclusive of the moratorium; and the rounding convention. Pick one rounding policy, put it in `rounding.ts`, and use it everywhere — inconsistent rounding across screens looks like a bug even when the math is right.

**Golden tests.** Hand-compute six EMIs on paper, including one of each moratorium treatment, and assert them to the rupee. If someone later "simplifies" the amortisation, these tests catch it.

### 8.2 The eligibility engine and path-to-eligibility

No rules DSL, no rules framework. One predicate per rule, in plain TypeScript:

```ts
type Verdict = {
  code: string;            // 'INCOME_ABOVE_CAP'
  passed: boolean;
  actual: number | string | boolean;
  required: number | string | boolean;
  messageKey: string;      // i18n key, never a hardcoded sentence
};
```

A scheme is eligible when every predicate passes. Keep the failures — they are the feature. For each failure, `remediation.ts` maps the code to the minimum qualifying change: numeric predicates yield a delta ("family income exceeds the cap by ₹X"), boolean predicates yield an action ("obtain a caste certificate from your Tehsildar"), categorical predicates yield the nearest valid alternative.

Then the output isn't a single recommendation but a ranked verdict table across all schemes, each row either "eligible, here's the loan and EMI" or "not eligible because X, and here is what would change it." That is Differentiator A, and it falls out of the architecture almost for free.

One hard rule: predicates return **codes**, never sentences. Sentences live in i18n catalogs. Otherwise multilingual support later means rewriting your business logic.

---

## 9. Testing strategy

Not optional, and not only for correctness — "our eligibility logic has N passing tests" is a claim very few SIH teams can make, and it lands with a jury that cares about money.

| Suite | Covers | Bar |
|---|---|---|
| `finance.golden` | Hand-computed EMIs, all three moratorium treatments, r=0, boundary loan amounts | Exact to the rupee |
| `eligibility.branches` | Every predicate, pass and fail; every reason code emitted at least once | 100% of reason codes |
| `personas.snapshot` | All 40 fixtures end-to-end through the core | Snapshot-stable |
| `partners.match` | Hard filters never leak; a partner that can't handle a category never appears | Zero leakage |
| `llm.contract` | Extraction output always Zod-validates or cleanly falls back to the form | No unhandled schema failure |

Add one CI check that fails the build if `src/core/` imports anything from `src/llm/` or `src/app/`.

---

## 10. Build phases

Day counts assume a six-person team at student pace. **Logic before UI** — most teams build a beautiful interface over wrong arithmetic and lose to the team whose numbers survive scrutiny.

| Phase | Work | Days | Gate to pass before moving on |
|---|---|---:|---|
| **0** | **Verification spike.** Identify the sponsoring corporation. Obtain official guidelines. Transcribe the scheme master twice, independently, and diff. Confirm partner-list obtainability. Choose languages. | 2 | Scheme master committed with sources. **If guidelines are unobtainable, stop and reconsider the PS — do not code around it.** · **Status: partially done but now 48 unverified (was 55) and 5 schemes — 5 schemes from https://nsfdc.nic.in/scheme 09.09.2026 (MICRO 1.40L/1.25L 6.5%, TERM 50L/45L 8%, EDU 40L 6.5%, AMY 1.40L 15% NBFC-MFI, UNY 5L 13% Coop) transcribed as `official_guideline` (caps/loan%25/rate/tenure/moratorium duration + tenure_includes_moratorium); 48 unverified (was 55) remain (`margin_pct`/`subsidy`/`moratorium_interest_treatment` still placeholder TODO(verify)), 11 open questions, 5/5 `verified:false` pending compendium.** |
| **1** | Skeleton: Next.js, Prisma schema, Supabase, seed scripts, Vercel deploy, CI. | 2 | `npm run seed` populates a live DB; a blank page is deployed · **✓ done — `6737439` + connected 2026-09-05 (Supabase pooler 6543, `20260905144514_init` applied, `npm run seed` idempotent; Vercel not yet deployed).** |
| **2** | **The heart.** Calculator + eligibility engine + remediation, headless, with golden and branch tests. No UI at all. | 4 | All 41 personas produce correct results from a CLI script · **✓ done + hardened 2026-09-10 — 41 personas (P41 tailoring 90k multi-eligible MICRO+AMY proving F2), 237 tests (11 files), `npm run personas` prints 41 rows, A3 format pinned, `verified` derived, DB parity loader.** |
| **3** | Intake (guided form first, LLM free-text second) + recommendation UI incl. the verdict table. | 4 | End-to-end in English; form path works with the LLM disabled · **✓ done + LLM 2026-09-06 — guided form (`/apply` GET→`/result`, till tehsil, 36 states + every district, MH 36×7–16 tehsils) + `FreeTextIntake.tsx:1` (`POST /api/extract` `gemini-3.6-flash` `name`/`tehsil`/`village`, fills form + stays on `/apply` + missing nudge, `429` retry) + verdict table `4a8eea7`; `LLM` extract/explain now 3 routes (`/api/extract`/`/api/extract-documents`/`/api/explain`) + `DocumentUpload`/`LoanConfirmation`.** |
| **4** | Partner registry, geocoding, MapLibre map, hard filters, health score, dual ranking. | 3 | Zero capability leakage; simulated chips visible · **✓ done 2026-09-05–06 — hard filters + haversine + health scoring + dual ranking + `PartnerMap.tsx:1` (MapLibre `6.7.0` OSM, eligible-only) + `ApplyForm` cascade `state→district→tehsil` (36×7–16, `village` removed per request, auto-detect `tehsil→district→state`, all valid choices).** |
| **5** | **Differentiator A** — path-to-eligibility surfaced properly in the UI. | 2 | Every failure shows a concrete, actionable next step · **✓ baseline done — `remediation.ts` + `VerdictList` show reason + next step for every failure/INDETERMINATE.** |
| **6** | **Differentiator B** — document checklist + pre-filled PDF packet + partner notification. | 3 | A real PDF downloads with correct computed figures · **✓ done 2026-09-05–06 — `ChecklistPanel` + `packet.tsx` (`PacketDocument`) + `/api/packet` + `result` download + `LoanConfirmation`/`DocumentUpload` (required only for confirmed loan, `extractFromDocuments` multimodal `requiredDocCodes`), `npm run build` 11 routes.** |
| **7** | Multilingual: catalogs, LLM explanation in target language, do-not-translate glossary. | 3 | Full flow in every shipped language; no scheme name or amount ever translated · **✓ done 2026-09-05–06 — `next-intl` `hi.json`/`mr.json` (265 keys, accurate via Gemini-class LLM, `hi` 2 left `mr` 0, brand `RinSetu` lock, tab stays `en`) + `LocaleSwitcher` (globe `h-7 w-7` → dropdown) + `layout`/`result`/`apply`/`personas`/`packet` + `ApplyForm` (till tehsil) locale-aware, `form` `tehsil`/`village` + `name` included.** |
| **8** | Admin health upload, provenance badges everywhere, accessibility, mobile-first pass, empty/error states. | 3 | Lighthouse accessibility ≥ 90; works at 360px · **✓ done 2026-09-07 — `/admin/health-upload` CSV→`MIS_UPLOAD` (`src/lib/admin-auth.ts:1` + `health-csv.ts:1` + 5 `api/admin/*`, `DataOriginBadge`) + `DatasetBanner` + `SIMULATED` chips everywhere, 360px ledger, template download, preview → apply, `DB unreachable` guard.** |
| **9** | **Demo hardening.** `DEMO_MODE` fixture cache, pre-cached map tiles, local DB fallback, script, three rehearsals. | 3 | **Full demo runs with wifi physically off** · **✓ done 2026-09-07 — `DEMO_MODE` fixture cache (`data/llm.fixtures.json:1` 7 fixtures, `src/llm/extract.ts:119` lowercased keys + `__fallback__`, `src/llm/explain.ts:49` deterministic), `public/manifest.json:1`, `DatasetBanner` `DEMO MODE` stamp, `PartnerMap` offline fallback (no `tile.openstreetmap.org` fetch), `tests/dataset-db.parity.test.ts:38` 2s probe + `DB unreachable, skipping parity check` (236+1 offline), `DEMO_MODE=true npm run dev` rehearsed.** |
| | **Total** | **29** | ≈ 5–6 weeks at a student pace |

### If you only have ~10 days

Cut to: Phase 0 (1) → 1 (1) → 2 (3) → 3 (2) → 4 (1.5) → 5 (1) → 9 (0.5).

Ship English only, guided form only with LLM free-text as a bonus, checklist as a static list with no PDF, no admin upload. Keep Phase 2 at full length — it is the only phase you must not compress — and keep at least half a day of Phase 9, because an offline-proof demo beats a richer app that dies on venue wifi.

Drop, in this order, if you're still over: PDF packet, then voice, then languages beyond Hindi and English, then the admin upload screen. Never drop tests, provenance badges, or the offline demo mode.

### Six-person split

| Role | Owns |
|---|---|
| Core logic ×2 | `src/core/` and all tests. The most important seats. |
| Frontend ×2 | Routes, components, accessibility, mobile layout |
| Data + geo ×1 | All seven datasets, geocoding, map, `VERIFY.md` |
| Content + demo ×1 | i18n catalogs, personas, PDF template, demo script, rehearsals |

The data seat is the one teams forget to staff, and it's on the critical path from day one.

---

## 11. Demo script (4 minutes)

Rehearse until it's muscle memory. Timings are cues, not targets.

| Time | Beat |
|---|---|
| 0:00 | One sentence of problem, one number. "Applications are routed through 100+ channel partners, and applicants don't know which scheme fits or which partner handles it — so files get misrouted and disbursement slips." |
| 0:20 | **Voice intake, in Hindi.** "I want to start a tailoring unit, it will cost about ninety thousand rupees." Show the extracted structured profile appearing on screen — this makes the LLM boundary visible. |
| 0:50 | Recommendation: the scheme, with the *why*. Then scroll to the verdict table and show the schemes they **don't** qualify for, each with a reason and a path. This is your moment — pause here. |
| 1:30 | EMI schedule with the moratorium visibly modelled. Point at the amortisation table. "This comes from the scheme guideline, not from a model." |
| 2:00 | Map: eligible partners only, ranked. Toggle nearest vs fastest-moving. **Say the simulated-data line here, unprompted.** |
| 2:30 | Document checklist → generate the pre-filled packet → open the actual PDF. "This is why the file arrives correct the first time." |
| 3:00 | The integrity slide: provenance badges, N passing tests, and the line — *"the model cannot invent a scheme or a rupee figure; it only narrates what the rules engine computed."* |
| 3:20 | What production needs: one MIS feed for partner health. That's the entire gap. |
| 3:40 | Buffer. Something will go wrong; this is where you absorb it. |

Have persona fixtures bound to number keys so any "what if…" question is answered by running it live rather than explaining.

---

## 12. Risk register

| Risk | Impact | Mitigation |
|---|---|---|
| Scheme figures wrong or stale | **Fatal** — a jury officer knows their own rate card | Phase 0 gate; two independent transcriptions; `verified` flag; nothing on a slide unverified |
| Judge challenges simulated NPA data | High | Disclose unprompted at 2:00; show the upload schema; never present it as real |
| Venue wifi fails | High | `DEMO_MODE` fixture cache, pre-cached tiles, local DB. Rehearse with wifi off |
| Moratorium math wrong | High | Three explicit treatments as a scheme field; golden tests to the rupee |
| LLM invents a scheme or a number | **Fatal** | Architecturally prevented; explanation layer receives only computed results; ESLint boundary rule |
| "How is this different from the existing portal?" | Medium | Rehearsed answer, §13 |
| Partner registry can't be assembled cleanly | Medium | Real SCA list + OSM bank branches, per-row `source` labels; degrade to fewer states rather than fake rows |
| Machine-translated regulatory language misleads | Medium | Do-not-translate glossary; human-written catalogs; never translate scheme names or amounts |
| Scope creep on the word "Router" | Medium | Stated out of scope in §1 and in the pitch |
| Several finalist teams ship the required three deliverables | **The most likely way you lose** | Differentiators A and B are committed scope, not stretch goals |

---

## 13. Rehearse this answer

> **"How is this different from myScheme or the existing portal?"**

Existing discovery portals list schemes across every ministry and stop at a description page. They do not compute whether *you* are eligible, they do not tell you why you were rejected or what would change it, they do not calculate your loan net of subsidy and margin money or your EMI under a moratorium, they do not know which of 100+ channel partners actually handles your loan category in your district, and they do not produce a submission-ready packet. RinSetu is deliberately narrow — one credit ecosystem, end to end, from a spoken sentence to a complete file at the right partner's desk.

Depth in one vertical, not breadth across all of them. Say it in that order.

---

## 14. Immediate next actions

1. Confirm the sponsoring corporation and download the official scheme guidelines. **Nothing else starts until this exists.**
2. Two people transcribe the scheme master independently into `data/schemes.seed.json`; diff and reconcile. Open `VERIFY.md`.
3. Decide your languages based on who on the team is a native speaker. Two well-done beats six machine-translated.
4. Write the 40 personas. Yes, before any code.
5. Staff the data + geo seat explicitly.
6. Create the repo with `CLAUDE.md` at the root, then run the Phase 2 kickoff prompt.

One process note: work with the codegen agent **phase by phase**, and read the tests it writes. A tested wrong assumption is more dangerous than untested code, because it looks like proof. The tests in `finance.golden.test.ts` in particular must come from your own paper arithmetic, not from the model's.

---

## Appendix A — worked example of the three moratorium treatments

**These figures are hypothetical**, chosen only to show that the formulas behave and to give you a shape to check your implementation against. Replace with real guideline values before writing your actual golden tests.

Loan ₹1,00,000 · 8% per annum · 60 repayment months · 6-month moratorium · monthly rate `r = 8/12/100 = 0.006667`

| Treatment | EMI | Total outflow | Paid during moratorium |
|---|---:|---:|---:|
| `CAPITALISED` | ₹2,110.11 | ₹1,26,606.53 | ₹0 |
| `SERVICED` | ₹2,027.64 | ₹1,25,658.37 | ₹666.67 per month |
| `WAIVED` | ₹2,027.64 | ₹1,21,658.37 | ₹0 |

Three invariants your implementation must satisfy, and which make good assertions in their own right:

1. `CAPITALISED` EMI is strictly higher than the other two, because principal grew during the moratorium.
2. `SERVICED` and `WAIVED` produce the **same EMI** but different total outflow — the difference is exactly `P·r·m`, the interest served during the moratorium. If your code makes these EMIs differ, the bug is in the amortisation base.
3. At `r = 0`, EMI is exactly `P/n` with no division-by-zero. ₹60,000 over 60 months is ₹1,000.

That second invariant is the one implementations usually get wrong, so assert it explicitly.
