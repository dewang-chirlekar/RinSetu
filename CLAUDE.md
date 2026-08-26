# CLAUDE.md — RinSetu project constitution

Read this file at the start of every session. It overrides convenience.

**Project:** RinSetu — SIH 2026, problem statement SIH26092. A platform that matches applicants to concessional credit schemes for SC beneficiaries, computes the loan and EMI under that scheme's guidelines, and routes them to the nearest capable Channel Partner with a complete pre-filled application packet.

**Team:** six students, mostly new to production web development. Prefer boring, well-documented, readable solutions over clever ones. If two approaches work, choose the one a beginner can debug at 2am.

---

## Two invariants — never violate these

### 1. The LLM never decides and never produces a number

The language model is allowed in exactly two places:

- `src/llm/extract.ts` — free text → `ApplicantProfile`, via structured output, then Zod-validated.
- `src/llm/explain.ts` — a *already-computed* `RecommendationResult` → plain-language prose.

Eligibility, loan amount, subsidy, margin money, EMI, amortisation, partner ranking and document lists are **deterministic TypeScript in `src/core/`**. `explain.ts` receives only the computed result and must not be given the authority or the data to introduce a fact. If you ever find yourself asking a model which scheme applies or what the EMI is, you have broken the project.

### 2. Every figure carries provenance

No numeric or regulatory value enters the codebase without `source_url`, `source_date` and `verified`. Unverified values are `verified: false` and must be appended to `VERIFY.md`. Simulated data carries `data_origin: "SIMULATED"` and every UI surface that reads it renders a visible label.

---

## Architectural boundary (CI-enforced)

`src/core/` must not import from `src/llm/`, `src/app/` or `src/components/`. It is pure, synchronous, dependency-light TypeScript. Keep it that way — its purity is why we can defend our numbers.

## Stack — pinned, do not substitute

Next.js 15 App Router · TypeScript strict · Tailwind + shadcn/ui · PostgreSQL on Supabase · Prisma · Vitest · MapLibre GL JS with OpenStreetMap tiles · `@google/generative-ai` (Gemini Flash) behind one adapter · next-intl · `@react-pdf/renderer` · Zod.

Distance is **haversine in TypeScript**. We have ~150 partners; do not introduce PostGIS.

Do not add: Redux, GraphQL, a vector database, Docker orchestration, a second backend language, or any auth beyond a single admin login for the health-data upload.

---

## Hard rules

1. **Never invent a scheme parameter.** Not a rate, ceiling, margin percentage, subsidy, moratorium length or tenure. If a value is unknown, use the placeholder in `data/schemes.seed.json`, leave `verified: false`, add a `TODO(verify)` comment, append a line to `VERIFY.md`, and tell me in your summary. Plausible-looking invented figures are the single worst outcome in this project.
2. **All scheme parameters live in data, never in code.** No magic numbers in `src/core/`. The engine must be correct independent of the figures, so real guideline values drop in without touching logic.
3. **Predicates return codes, not sentences.** Every user-facing string is an i18n key in `src/messages/`. A hardcoded English sentence in `src/core/` is a bug.
4. **Keep failures.** The eligibility engine returns verdicts for *all* schemes, passing and failing, each failure carrying a reason code and a remediation. The negative case is a headline feature, not an error path.
5. **Every feature works with the LLM disabled.** The guided form is the primary intake path; free-text is an enhancement. `DEMO_MODE=true` serves all LLM calls from a fixture cache.
6. **Hard filters before soft ranking.** A partner that does not handle a scheme category, or whose ticket range excludes the loan, must never appear for it at any distance. Distance and health only reorder an already-valid set.
7. **One rounding policy**, in `src/core/finance/rounding.ts`, applied everywhere.
8. **Tests accompany core logic in the same commit.** Not later.
9. **Never geocode at request time.** Geocoding happens once in a seed script; coordinates are committed.
10. **Mobile-first.** Every screen must be usable at 360px width. Target users are on low-end phones.

## Moratorium — the known trap

`Scheme.moratorium_interest_treatment` is one of `CAPITALISED` | `SERVICED` | `WAIVED`, and all three must be implemented:

- `CAPITALISED` — interest accrues and is added to principal; amortise `P·(1+r)^m` over `n`.
- `SERVICED` — interest paid monthly during moratorium, no principal; amortise `P` over `n`.
- `WAIVED` — no interest during moratorium; amortise `P` over `n`.

Never assume which applies. It is a per-scheme field sourced from the official guideline.

## Definition of done for any core change

Tests written and passing · no magic numbers · reason codes not sentences · `VERIFY.md` updated if any figure was assumed · works with `DEMO_MODE=true` · usable at 360px · `npm run lint` and `npm run typecheck` clean.

## How to work with me

Work **one phase at a time** and stop at the phase gate for review. At the end of each session, report: what you built, every assumption you made, every figure you could not verify, and what you recommend next. Flag disagreements with this document rather than silently working around it.
