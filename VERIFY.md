# VERIFY.md — every figure RinSetu cannot yet defend

<!--
  GENERATED FILE — do not edit by hand.
    regenerate:  npm run verify:report
    check in CI: npm run verify:report -- --check
  Built from data/*.json via unverifiedFigures() in src/lib/dataset.ts.
  No timestamp on purpose, so --check means something. Git records the dates.
-->

CLAUDE.md invariant 2: no numeric or regulatory value enters this codebase without a source. Where we do not have one, the value stays a placeholder, `verified` stays false, and the figure is listed here. This file is generated from the data, so it cannot fall behind it — the only way to shorten it is to transcribe a published guideline.

## Where things stand

- **48** unverified figures across **6** locations, with the demo overlay applied.
- **10** of those are values the demo overlay supplies purely so the engine can be exercised; the other **38** are seed placeholders or paraphrases of the problem statement.
- With the overlay off, **48** figures are unverified — the same slots. Turning the overlay off changes where a value comes from, never whether it can be defended.
- By source: `placeholder` 38 · `demo_overlay` 10.
- `figures_authoritative` is **false** (overlay applied: **true**).
- **5 of 5** schemes are unverified.
- Partner registry: **15** partners, all `fabricated`. Health data: **15** rows, all `SIMULATED`.

**Nothing in the loan, EMI, subsidy or rate columns of this application may be quoted.**

## How to read the source column

| source | citable on a slide? | meaning |
| --- | --- | --- |
| `official_guideline` | **yes** | Transcribed from a published scheme guideline, with a URL and a date. |
| `ps_text` | no | Taken from the wording of the problem statement, which is not a guideline. |
| `placeholder` | no | A shape-correct stand-in so the engine can be built. Not a figure. |
| `demo_overlay` | no | Supplied by data/schemes.demo-overlay.json purely to make the demo run. |
| `design_decision` | **yes** | Our own design choice, stated as ours — a weight, a policy, a UI threshold. |
| `common_practice` | no | What comparable schemes typically do. An assumption, not a rule. |
| `fabricated` | no | Invented by us for a fixture or a test. Never a scheme value. |
| `open_data` | no | From a public dataset that is not the scheme authority. |

## Global eligibility rules

These apply across all schemes: the income ceiling, the reserved category and the age window.

| field | value in play | source | note |
| --- | --- | --- | --- |
| `age_min` | 18 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `age_max` | 60 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |

## Scheme parameters

### MICRO — Micro Finance Scheme

`verified: false` · source_url: https://nsfdc.nic.in/scheme · source_date: 2026-09-09

| field | value in play | source | note |
| --- | --- | --- | --- |
| `cost_ceiling_rules` | [0 rule(s)] | `placeholder` | — |
| `min_loan` | 10000 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `min_project_cost` | 0 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `margin_pct` | 0.1 | `placeholder` | TODO(verify): Not explicitly labelled margin on scheme page. 90% loan implies 10% contribution but verify compendium before marking official_guideline. |
| `subsidy_pct` | 0 | `placeholder` | TODO(verify): No subsidy mentioned for MFS on scheme page — assumed 0, verify compendium. |
| `subsidy_cap` | 0 | `placeholder` | — |
| `subsidy_timing` | BACK | `placeholder` | Irrelevant when subsidy 0, but required by schema if subsidy>0. |
| `moratorium_months_default` | 6 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `moratorium_interest_treatment` | CAPITALISED | `placeholder` | TODO(verify): Not stated whether interest during 3-month moratorium is CAPITALISED/SERVICED/WAIVED. Critical — verify compendium, do not assume. Placeholder to keep demo computable. |

### TERM — Term Loan Scheme

`verified: false` · source_url: https://nsfdc.nic.in/scheme · source_date: 2026-09-09

| field | value in play | source | note |
| --- | --- | --- | --- |
| `cost_ceiling_rules` | [0 rule(s)] | `placeholder` | — |
| `margin_pct` | 0.1 | `placeholder` | TODO(verify): 90% loan implies 10% contribution but not explicitly labelled margin_pct. |
| `subsidy_pct` | 0 | `placeholder` | TODO(verify): No subsidy mentioned for TERM on scheme page. |
| `subsidy_cap` | 0 | `placeholder` | — |
| `subsidy_timing` | BACK | `placeholder` | — |
| `moratorium_months_default` | 6 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `moratorium_interest_treatment` | CAPITALISED | `placeholder` | TODO(verify): Not stated — CAPITALISED/SERVICED/WAIVED unknown. Placeholder to keep computable. |

### EDU — Educational Loan Scheme

`verified: false` · source_url: https://nsfdc.nic.in/scheme · source_date: 2026-09-09

| field | value in play | source | note |
| --- | --- | --- | --- |
| `cost_ceiling_rules` | [2 rule(s)] | `demo_overlay` | — |
| `min_loan` | 50000 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `min_project_cost` | 0 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `margin_pct` | 0 | `placeholder` | TODO(verify): No margin stated for ELS — assume 0 pending compendium. |
| `subsidy_pct` | 0 | `placeholder` | TODO(verify): No subsidy stated for ELS. Interest subsidy via MHRD during moratorium mentioned for NSTFDC variant but not NSFDC. |
| `subsidy_cap` | 0 | `placeholder` | — |
| `subsidy_timing` | BACK | `placeholder` | — |
| `moratorium_months_min` | 3 | `placeholder` | TODO(verify): EDU official moratorium is course period + 01 year / 6 months (variable) per https://nsfdc.nic.in/scheme §5 — fixed 3-month min is placeholder to keep demo computable, shape is wrong. Do not quote. |
| `moratorium_months_max` | 12 | `placeholder` | TODO(verify): Placeholder 12-month max — real is course-duration-based. |
| `moratorium_months_default` | 12 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `moratorium_interest_treatment` | WAIVED | `placeholder` | TODO(verify): Not stated for NSFDC ELS — placeholder WAIVED to keep demo computable, but do not assume. |
| `tenure_includes_moratorium` | false | `placeholder` | TODO(verify): Placeholder false — page distinguishes separately, but need compendium to confirm inclusive/exclusive. |

### AMY — Aajeevika Micro-Finance Yojana

`verified: false` · source_url: https://nsfdc.nic.in/scheme · source_date: 2026-09-09

| field | value in play | source | note |
| --- | --- | --- | --- |
| `cost_ceiling_rules` | [0 rule(s)] | `placeholder` | — |
| `min_loan` | null | `placeholder` | — |
| `min_project_cost` | null | `placeholder` | — |
| `margin_pct` | 0.1 | `placeholder` | TODO(verify): 90% implies 10% but not labelled margin. |
| `subsidy_pct` | 0 | `placeholder` | TODO(verify): No subsidy mentioned — assumed 0. |
| `subsidy_cap` | 0 | `placeholder` | — |
| `subsidy_timing` | BACK | `placeholder` | — |
| `moratorium_months_default` | null | `placeholder` | — |
| `moratorium_interest_treatment` | CAPITALISED | `placeholder` | TODO(verify): Not stated — placeholder CAPITALISED to keep computable. |

### UNY — Udyam Nidhi Yojana

`verified: false` · source_url: https://nsfdc.nic.in/scheme · source_date: 2026-09-09

| field | value in play | source | note |
| --- | --- | --- | --- |
| `cost_ceiling_rules` | [0 rule(s)] | `placeholder` | — |
| `min_loan` | null | `placeholder` | — |
| `min_project_cost` | null | `placeholder` | — |
| `margin_pct` | 0.1 | `placeholder` | TODO(verify): Not stated explicitly. |
| `subsidy_pct` | 0 | `placeholder` | TODO(verify): No subsidy mentioned. |
| `subsidy_cap` | 0 | `placeholder` | — |
| `subsidy_timing` | BACK | `placeholder` | — |
| `moratorium_months_default` | null | `placeholder` | — |
| `moratorium_interest_treatment` | CAPITALISED | `placeholder` | TODO(verify): Not stated — placeholder. |

## Partner registry and health data

The 15 channel partners in data/partners.seed.json are **fabricated**: plausible institution types, ticket ranges and jurisdictions attached to real city coordinates, so that distance and routing can be built and demonstrated. No branch listed is a real branch, and no ticket range is a real credit policy.

All 15 health rows in data/partner-health.sim.json carry `data_origin: "SIMULATED"`, which is non-nullable precisely so that no screen can render a health figure without saying where it came from. The four weights that combine into the composite score are our own design decision, documented in data/health-scoring.json with a rationale key each, and the UI shows the breakdown rather than only the number.

Replacing this with a real MIS feed changes `data_origin` to `MIS_UPLOAD` and nothing else — that is the whole reason the field exists.

## Open questions that must be answered before anything above can be verified

Transcribed from `open_questions_for_phase_0` in data/schemes.seed.json. These are questions about the schemes, not about the code.

1. Which corporation sponsors this PS? Resolved as NSFDC per https://nsfdc.nic.in/scheme and https://nsfdc.nic.in/eligibility-requirements — confirm with SIH nodal officer that PS SIH26092 expects NSFDC.
2. Is ₹1.40 lakh / ₹50 lakh the project cost ceiling or the loan ceiling? Resolved: MICRO max_unit_cost 1.40L / max_loan 1.25L, TERM max_unit_cost 50L / max_loan 45L, UNY 5L/4.5L, ELS 40L — per https://nsfdc.nic.in/scheme, but TERM 45L vs 50L still needs compendium confirmation.
3. Is there a subsidy component, and is it front-ended or back-ended? No subsidy mentioned on scheme page for these 5 — likely 0, but verify compendium (Central Sector subsidy scheme referenced in compendium excerpt).
4. What is the actual banded rate card, and does it vary by gender or applicant category? Partially resolved: rates are per-channel (SCA 6.5-8%, NBFC-MFI 15%, Coop 13%/15%) not by gender — verify compendium for gender/category bands.
5. Which moratorium interest treatment applies to each scheme? Still unresolved — page states duration only, not CAPITALISED/SERVICED/WAIVED. Placeholder set to keep demo computable, but remains TODO(verify).
6. Is the maximum tenure inclusive or exclusive of the moratorium? Resolved for 4 schemes as inclusive (wording includes moratorium) per https://nsfdc.nic.in/scheme — EDU remains ambiguous (tenure_includes_moratorium null).
7. What is the loan floor that separates MICRO from TERM? Resolved as ₹1.40 lakh unit cost boundary and ₹1.25 lakh loan boundary per §1/§2.
8. Which partner types are actually authorised to process each scheme category? Partially resolved: MFS/TERM via SCAs/CAs, AMY via NBFC-MFI, UNY via Cooperatives/SFBs — need exact SCA list.
9. Does the education scheme have separate ceilings for study in India vs abroad? NSFDC page shows single ₹40 lakh for both — suggests no split, but placeholder kept for verification.
10. Is the education moratorium a fixed month count or course-duration-plus-grace? Resolved as course-duration-based per §5 — fixed month fields are wrong shape for EDU, left null.
11. Can one applicant be eligible for more than one scheme at the same time? Now demonstrated as YES: P41 tailoring 90k is ELIGIBLE for both MICRO (6.5%) and AMY (15%) via shared tailoring purpose and same 1.40L ceiling — ranking picks MICRO per RECOMMENDATION_POLICY (largest share → lower rate).

## Structural findings

Consequences of the current parameters, not defects. Each one is re-checked against the engine every time this file is generated; if a claim stops being true the generator fails instead of writing it down.

### F1 — A manufacturing project costing exactly ₹1,40,000 qualifies for no scheme

Persona P06. MICRO rejects the purpose (manufacturing is not in its eligible_purposes) and TERM rejects the cost (₹1,40,000 is one rupee below its floor). This is a finding about the seed parameters, not a defect in the engine: with disjoint purpose lists and a floor set one rupee above the micro ceiling, an applicant can fall between the two schemes. Either the real guidelines overlap at this boundary or the boundary genuinely excludes this applicant, and we cannot tell which until open question 7 is answered. Whichever it is, the engine reports it honestly today: two rejections, each with its own reason code and remediation.

### F2 — One applicant (P41) is eligible for two schemes at once — the ranking policy is live

P41 tailoring 90k is ELIGIBLE for both MICRO (6.5% via SCA) and AMY (15% via NBFC-MFI) — they share PLACEHOLDER_tailoring and the same 1.40L/1.25L ceiling. The remaining 40 personas stay single-eligible to keep snapshots stable. Ranking in src/core/recommend.ts (RECOMMENDATION_POLICY: largest share → lower rate → code) now fires on real data via P41 and is visible in the UI (MICRO recommended, AMY ELIGIBLE collapsed). If more overlaps are added, review the policy copy in SchemeCard.tsx.

### F3 — The SERVICED moratorium treatment is not reachable from any scheme in the data

All three seed placeholders are CAPITALISED or WAIVED, and the demo overlay deliberately does not override the treatment — which treatment applies is open question 5, and guessing it changes the EMI. SERVICED is implemented and tested directly in tests/finance.golden.test.ts. This line exists so that nobody concludes from the persona output that only two treatments exist.

### F4 — The dataset cannot report itself as authoritative, in either load mode

figures_authoritative is derived, not stored: it is true only when every figure in play comes from a citable source AND no demo overlay is applied. Both conditions fail today, for two independent reasons, which is deliberate — this is the one flag that must not be capable of silently flipping.

## What "verified" will require

For each figure above: the published guideline it comes from, as a URL; the date of that document; and the value transcribed into data/schemes.seed.json with `source: "official_guideline"`. `verified` is then **derived** by isCitable() — there is no flag to set, and setting one in the JSON has no effect. When every figure in a scheme is citable, that scheme reports `verified: true`; when every scheme is and the demo overlay is off, `figures_authoritative` becomes true and the not-authoritative banner disappears on its own.

