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

- **55** unverified figures across **4** locations, with the demo overlay applied.
- **32** of those are values the demo overlay supplies purely so the engine can be exercised; the other **23** are seed placeholders or paraphrases of the problem statement.
- With the overlay off, **55** figures are unverified — the same slots. Turning the overlay off changes where a value comes from, never whether it can be defended.
- By source: `demo_overlay` 32 · `ps_text` 15 · `placeholder` 8.
- `figures_authoritative` is **false** (overlay applied: **true**).
- **3 of 3** schemes are unverified.
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
| `annual_family_income_cap` | 500000 | `ps_text` | PS states 'annual family income of up to ₹5.00 Lakhs'. Income ceilings on schemes like these have been revised more than once, so confirm the figure AND its effective date against the current guideline. |
| `category_requirement` | SC | `ps_text` | — |
| `age_min` | 18 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `age_max` | 60 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |

## Scheme parameters

### MICRO — Micro Finance Scheme

`verified: false` · source_url: **none** · source_date: **none**

| field | value in play | source | note |
| --- | --- | --- | --- |
| `interest_rules` | [1 rule(s)] | `demo_overlay` | — |
| `cost_ceiling_rules` | [0 rule(s)] | `placeholder` | — |
| `max_unit_cost` | 140000 | `ps_text` | PS states micro projects 'up to ₹1.40 lakh'. Confirm whether this is the unit cost ceiling or the loan ceiling — they are different things. |
| `max_loan` | 140000 | `ps_text` | Likely lower than max_unit_cost once margin money is applied. VERIFY. |
| `min_loan` | 10000 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `min_project_cost` | 0 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `loan_pct_cap` | 0.9 | `ps_text` | PS states assistance covers 'up to 90% of project or education costs'. |
| `margin_pct` | 0.05 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `subsidy_pct` | 0.1 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `subsidy_cap` | 10000 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `subsidy_timing` | FRONT | `placeholder` | FRONT reduces the loan and therefore the EMI; BACK is adjusted at closure and leaves the EMI unchanged. Getting this wrong changes every number on screen. |
| `moratorium_months_min` | 3 | `ps_text` | — |
| `moratorium_months_max` | 12 | `ps_text` | — |
| `moratorium_months_default` | 6 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `moratorium_interest_treatment` | CAPITALISED | `placeholder` | One of CAPITALISED \| SERVICED \| WAIVED. This is the single most consequential unverified field in the file. |
| `tenure_months_max` | 60 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `tenure_includes_moratorium` | false | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |

### TERM — Term Loan Scheme

`verified: false` · source_url: **none** · source_date: **none**

| field | value in play | source | note |
| --- | --- | --- | --- |
| `interest_rules` | [3 rule(s)] | `demo_overlay` | — |
| `cost_ceiling_rules` | [0 rule(s)] | `placeholder` | — |
| `max_unit_cost` | 5000000 | `ps_text` | PS states larger projects 'up to ₹50.00 lakh'. |
| `max_loan` | 5000000 | `ps_text` | VERIFY whether ₹50 lakh is the project ceiling or the loan ceiling. |
| `min_loan` | 100000 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `min_project_cost` | 140001 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `loan_pct_cap` | 0.9 | `ps_text` | — |
| `margin_pct` | 0.1 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `subsidy_pct` | 0 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `subsidy_cap` | 0 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `subsidy_timing` | FRONT | `placeholder` | — |
| `moratorium_months_min` | 3 | `ps_text` | — |
| `moratorium_months_max` | 12 | `ps_text` | — |
| `moratorium_months_default` | 6 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `moratorium_interest_treatment` | CAPITALISED | `placeholder` | — |
| `tenure_months_max` | 84 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `tenure_includes_moratorium` | false | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |

### EDU — Educational Loan Scheme

`verified: false` · source_url: **none** · source_date: **none**

| field | value in play | source | note |
| --- | --- | --- | --- |
| `interest_rules` | [2 rule(s)] | `demo_overlay` | — |
| `cost_ceiling_rules` | [2 rule(s)] | `demo_overlay` | — |
| `max_unit_cost` | 1000000 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `max_loan` | 1000000 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `min_loan` | 50000 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `min_project_cost` | 0 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `loan_pct_cap` | 0.9 | `ps_text` | — |
| `margin_pct` | 0 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `subsidy_pct` | 0 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `subsidy_cap` | 0 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `subsidy_timing` | BACK | `placeholder` | — |
| `moratorium_months_min` | 3 | `ps_text` | Education loans commonly tie the moratorium to course duration plus a grace period rather than a fixed month count. If so, this field needs a different shape — flag it rather than forcing it. |
| `moratorium_months_max` | 12 | `ps_text` | — |
| `moratorium_months_default` | 12 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `moratorium_interest_treatment` | WAIVED | `placeholder` | Subsidised education schemes sometimes waive interest during study. Do not assume — verify. |
| `tenure_months_max` | 120 | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |
| `tenure_includes_moratorium` | false | `demo_overlay` | Filled by data/schemes.demo-overlay.json. Not a real figure. |

## Partner registry and health data

The 15 channel partners in data/partners.seed.json are **fabricated**: plausible institution types, ticket ranges and jurisdictions attached to real city coordinates, so that distance and routing can be built and demonstrated. No branch listed is a real branch, and no ticket range is a real credit policy.

All 15 health rows in data/partner-health.sim.json carry `data_origin: "SIMULATED"`, which is non-nullable precisely so that no screen can render a health figure without saying where it came from. The four weights that combine into the composite score are our own design decision, documented in data/health-scoring.json with a rationale key each, and the UI shows the breakdown rather than only the number.

Replacing this with a real MIS feed changes `data_origin` to `MIS_UPLOAD` and nothing else — that is the whole reason the field exists.

## Open questions that must be answered before anything above can be verified

Transcribed from `open_questions_for_phase_0` in data/schemes.seed.json. These are questions about the schemes, not about the code.

1. Which corporation sponsors this PS? The description matches a national SC finance and development corporation but never names it. Everything downstream depends on knowing whose guidelines are authoritative.
2. Is ₹1.40 lakh / ₹50 lakh the project cost ceiling or the loan ceiling?
3. Is there a subsidy component, and is it front-ended or back-ended?
4. What is the actual banded rate card, and does it vary by gender or applicant category?
5. Which moratorium interest treatment applies to each scheme?
6. Is the maximum tenure inclusive or exclusive of the moratorium?
7. What is the loan floor that separates MICRO from TERM?
8. Which partner types are actually authorised to process each scheme category? This is the backbone of the routing feature.
9. Does the education scheme have separate ceilings for study in India vs abroad?
10. Is the education moratorium a fixed month count or course-duration-plus-grace? If the latter, moratorium_months_* is the wrong shape and must become a formula field.
11. Can one applicant be eligible for more than one scheme at the same time? In this seed they cannot — the purpose lists are disjoint and the cost predicates mutually exclusive — so the engine's multi-scheme ranking never fires on real data. If the published guidelines do overlap, RECOMMENDATION_POLICY in src/core/recommend.ts becomes user-visible and needs review; see the known_gaps note in data/personas.fixtures.json.

## Structural findings

Consequences of the current parameters, not defects. Each one is re-checked against the engine every time this file is generated; if a claim stops being true the generator fails instead of writing it down.

### F1 — A manufacturing project costing exactly ₹1,40,000 qualifies for no scheme

Persona P06. MICRO rejects the purpose (manufacturing is not in its eligible_purposes) and TERM rejects the cost (₹1,40,000 is one rupee below its floor). This is a finding about the seed parameters, not a defect in the engine: with disjoint purpose lists and a floor set one rupee above the micro ceiling, an applicant can fall between the two schemes. Either the real guidelines overlap at this boundary or the boundary genuinely excludes this applicant, and we cannot tell which until open question 7 is answered. Whichever it is, the engine reports it honestly today: two rejections, each with its own reason code and remediation.

### F2 — No applicant can be eligible for two schemes at once

The seed gives MICRO, TERM and EDU disjoint eligible_purposes, and the cost predicates (PROJECT_COST_WITHIN_UNIT_COST versus PROJECT_COST_ABOVE_MICRO_FLOOR) are mutually exclusive. So the ranking rule in src/core/recommend.ts (RECOMMENDATION_POLICY) never fires on real data and is covered by a direct unit test instead of a persona. If the published guidelines do overlap, that policy becomes visible to applicants and needs review before it ships. Open question 11.

### F3 — The SERVICED moratorium treatment is not reachable from any scheme in the data

All three seed placeholders are CAPITALISED or WAIVED, and the demo overlay deliberately does not override the treatment — which treatment applies is open question 5, and guessing it changes the EMI. SERVICED is implemented and tested directly in tests/finance.golden.test.ts. This line exists so that nobody concludes from the persona output that only two treatments exist.

### F4 — The dataset cannot report itself as authoritative, in either load mode

figures_authoritative is derived, not stored: it is true only when every figure in play comes from a citable source AND no demo overlay is applied. Both conditions fail today, for two independent reasons, which is deliberate — this is the one flag that must not be capable of silently flipping.

## What "verified" will require

For each figure above: the published guideline it comes from, as a URL; the date of that document; and the value transcribed into data/schemes.seed.json with `source: "official_guideline"`. `verified` is then **derived** by isCitable() — there is no flag to set, and setting one in the JSON has no effect. When every figure in a scheme is citable, that scheme reports `verified: true`; when every scheme is and the demo overlay is off, `figures_authoritative` becomes true and the not-authoritative banner disappears on its own.

