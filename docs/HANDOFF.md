# HANDOFF.md — notes for the next model working on RinSetu

**Read this before you change anything under `src/core/` or `src/app/`/`src/components/`.**

[PROGRESS.md](PROGRESS.md) tells you *where the project stands* (now Phase 3–6
baseline, `bd12a83` on `main`, 237/237 green (11 files), DB parity `src/lib/dataset-db.ts:1`,
core hardened 2026-09-05, `npm run build` compiles, `README.md` rewritten 2026-08-31).
This file tells you *how not to break it*. It is written for a model picking this up cold, and it concentrates on the three areas where I found and fixed subtle correctness bugs: the **EMI engine**, the **eligibility predicates**, and **partner matching** — plus, since `4a8eea7`, the **UI invariants** that keep the ledger honest (§6–7), and since 2026-09-05 the **DB parity** and **format pinning** (§5–6).

The person you are working for does not write code. They cannot catch a wrong number by
reading a diff. That is why the tests, the provenance machinery and the generated
`VERIFY.md` exist — they are the review that the user cannot personally perform. Treat a
failing check as information, never as an obstacle.

---

## 0. The single most important rule

**Never invent a number.**

Not an interest rate, a cost ceiling, a margin percentage, a subsidy percentage or cap, a
moratorium length, a tenure, or an income limit. Not even a "reasonable" one. Not even
temporarily. Not even in a test.

The project's whole value proposition is that its figures are defensible. A plausible
invented figure is worse than a blank, because a blank is honest and a plausible figure
gets screenshotted and put on a slide.

If you need a value that does not exist:

1. Leave it `null` in `data/schemes.seed.json`.
2. Let the engine return `{ computable: false, missing: [...] }`. That is the designed
   behaviour, not a failure.
3. Run `npm run verify:report` so `VERIFY.md` lists it.
4. Say so explicitly in your reply to the user.

**A specific trap.** At the bottom of
[tests/finance.golden.test.ts:297](tests/finance.golden.test.ts:297) there is a
`describe.todo(...)` block with a long comment. It looks like an unfinished test you
should helpfully complete. **Do not complete it.** It is deliberately empty because
filling it in requires real scheme parameters that nobody has yet. The comment says so.
Completing it from plausibility is the single worst thing you could do to this codebase.

---

## 1. How to check yourself

One command:

```bash
npm run check
```

It runs typecheck → lint → the architecture boundary check → the `VERIFY.md` freshness
check → the tests. When I stopped, it exited 0 with **11 files and 237 tests
passing** (1 skipped without `DATABASE_URL`). If your change drops that number, you deleted a test. If it raises the number, good. Previous gate was 9 files/230 tests; 2026-09-05 added `tests/eligibility.age-format.test.ts` (6, A3) + `tests/dataset-db.parity.test.ts` (1, DB parity).

If `npm run typecheck` fails on missing Prisma types, `npm install` now runs `prisma generate` via `postinstall` (`package.json:19`) — or run `npx prisma generate` once manually. The generated client is not committed. `.env` is gitignored and holds the Supabase pooler URL (connected 2026-09-05, parity verified `src/lib/dataset-db.ts:1`); `prisma.config.ts` keeps `generate` offline-capable.

### The self-check that catches EMI mistakes fastest

`P = ₹1,00,000`, `8%` p.a., `60` repayment months, `6`-month moratorium. These are the
test's own chosen inputs (not scheme parameters), and every figure below is an arithmetic
consequence of the published EMI formula:

| treatment | exact EMI | rounded EMI | exact total outflow |
| --- | --- | --- | --- |
| CAPITALISED | 2110.11 | 2110 | 1,26,606.53 |
| SERVICED | 2027.64 | 2027 | 1,25,658.37 |
| WAIVED | 2027.64 | 2027 | 1,21,658.37 |

Three things you can verify by hand in ten seconds:

- SERVICED and WAIVED have the **same EMI**. If yours differ, you amortised the wrong
  principal.
- SERVICED outflow − WAIVED outflow = `125658.37 − 121658.37` = **4000** = `P·r·m`
  = `100000 × (0.08/12) × 6`. Exactly.
- CAPITALISED EMI is **strictly the highest**. If it isn't, the capitalisation factor is
  wrong or not applied.

---

## 2. The EMI engine — [src/core/finance/](src/core/finance/)

Files, in the order data flows through them:
[rules.ts](src/core/finance/rules.ts) → [terms.ts](src/core/finance/terms.ts) →
[loan.ts](src/core/finance/loan.ts) → [emi.ts](src/core/finance/emi.ts), with
[rounding.ts](src/core/finance/rounding.ts) used by all of them.

### 2.1 The three moratorium treatments — the known trap

`moratorium_interest_treatment` is `CAPITALISED | SERVICED | WAIVED`. All three are
implemented. **Which one applies is a per-scheme field read from the guideline. Never
infer it, never default it, never assume the common case.**

The only place they diverge is
[`amortisationBase`](src/core/finance/emi.ts:77) — deliberately one small exported
function, so that if a treatment is ever wrong it is wrong in exactly one place:

| treatment | principal amortised | paid during moratorium | moratorium interest |
| --- | --- | --- | --- |
| `CAPITALISED` | `P·(1+r)^m` | nothing | `P·((1+r)^m − 1)` |
| `SERVICED` | `P` | `P·r` monthly | `P·r·m` |
| `WAIVED` | `P` | nothing | `0` |

**Correct looks like:** SERVICED and WAIVED produce byte-identical EMIs (the test asserts
`toBe`, not `toBeCloseTo` — that is the assertion that catches amortising the wrong base);
CAPITALISED is strictly greater whenever `r > 0` and `m > 0`; and at `r = 0` all three give
`EMI = P/n` with no division by zero.

The `switch` statements in `amortisationBase` and `moratoriumInterestExact` end with a
`const unreachable: never = treatment` assignment. That is intentional — it makes adding a
fourth treatment a **compile error** rather than a silent fallthrough. Do not replace it
with a `default: return principal`.

### 2.2 The rounding policy, and the two places it looks inconsistent

The policy is in [rounding.ts](src/core/finance/rounding.ts): compute unrounded, round
money at the boundary, **never round rates**, half-up (not banker's) because the golden
tests are hand-computed on paper.

Two places deviate from "round only at the end". Both are deliberate and documented. **A
weaker model reading only `rounding.ts` will think they are bugs. They are not.**

**(a) [loan.ts:81](src/core/finance/loan.ts:81) rounds each money step and feeds the rounded
value into the next step.** Reason, from the comment: these are figures a user reads and
adds up on screen. A subsidy column that does not visibly subtract reads as a bug even
when the arithmetic is right. Only `loan` flows into the amortisation, and a sanctioned
loan is a whole rupee anyway. Leave it.

**(b) The amortisation carries an unrounded balance internally while displaying a rounded
one.** Look at [emi.ts:184](src/core/finance/emi.ts:184) onward:

- `outstanding` starts from the **unrounded** `base` and is carried forward unrounded
  (`outstanding = opening - principalPortion`).
- Each row *displays* `opening_balance: roundRupee(opening)`, and
  `closing_balance = roundRupee(opening) − principalPortion`, so **every row visibly
  subtracts**.
- Each row's `interest` is rounded; `principal` is the remainder of the rounded EMI, so
  it is a whole rupee.
- The **final instalment absorbs the residual**: `principalPortion = roundRupee(opening)`,
  which makes the last `closing_balance` exactly `0` and makes
  `totals.principal_repaid` exactly `roundRupee(amortised_principal)`.

Both of those last two identities are asserted by tests. They hold *because* the balance
is carried unrounded. If you "simplify" this by carrying the rounded balance forward, the
schedule will drift and both assertions break.

**A visible seam you must not "fix" casually.** The moratorium loop tracks its own
`balance` (compounding *rounded* monthly interest, for a readable ledger), while the
repayment phase restarts from the *unrounded* `base`. So in principle the last moratorium
row's `closing_balance` can differ by a rupee or two from the first repayment row's
`opening_balance`. That is documented at [emi.ts:182](src/core/finance/emi.ts:182)
("so a capitalised balance does not inherit the rounding drift of the moratorium rows").
If the UI needs a continuous-looking ledger, solve it in the UI or raise it with the user —
changing which principal is amortised changes the EMI and every total downstream, and
would need fresh hand-computed golden values. That is not a quick fix.

### 2.3 `total_interest` is not the sum of the interest column

`totals.total_interest = total_outflow − roundRupee(principal)` — everything paid above the
sanctioned principal.

It is **deliberately not** the sum of the `interest` column. Under `CAPITALISED` the
moratorium interest is *added to the balance* rather than paid, so summing that column
would double-count it. The test at
[finance.golden.test.ts:217](tests/finance.golden.test.ts:217) spells this out. If you
"tidy" this into a column sum, CAPITALISED totals become wrong and the test will tell you.

Likewise, `moratorium_interest_serviced` and `moratorium_interest_capitalised` are two
separate fields and exactly one of them is non-zero for any given treatment (both are zero
for WAIVED). Don't collapse them into one.

### 2.4 `computeLoan` — the pipeline order is fixed

```
1. eligible_cost    = min(project_cost, max_unit_cost)
2. subsidy          = min(subsidy_pct × eligible_cost, subsidy_cap)
3. own_contribution = margin_pct × eligible_cost
4. gross_loan       = eligible_cost − own_contribution − (subsidy if FRONT)
5. loan             = min(gross_loan, max_loan, loan_pct_cap × eligible_cost)
6. rate             = resolve the InterestRule for {loan band, purpose, gender}
7. emi + schedule   = amortise(...)
```

Do not reorder. Each step consumes the previous one's output. Note step 4: **only a
`FRONT`-timed subsidy reduces the loan.** A `BACK` subsidy is adjusted at closure and
leaves the EMI unchanged. These are not interchangeable and the field is per-scheme.

**Gather-then-fail.** All the `missing.push(...)` calls happen *before* any arithmetic, in
one pass, so the user sees every gap at once rather than fixing them one at a time. Keep
that shape.

**Two `??` defaults that look like invented numbers but are not:**

```ts
const subsidyCap = scheme.subsidy_cap ?? 0;
const subsidyTiming = scheme.subsidy_timing ?? 'BACK';
```

These are only reachable when `subsidy_pct` is `0`, because the block just above adds
`subsidy_cap` and `subsidy_timing` to `missing` whenever `subsidy_pct > 0`. With no
subsidy, neither value can affect any figure. So this is not a default standing in for an
unknown guideline — it is dead-but-type-required code.

Two opposite mistakes to avoid: don't "fix" it by demanding those fields unconditionally
(that blocks a scheme on a figure that cannot change the answer), and **don't copy this
`??` pattern anywhere a default could actually reach the arithmetic.**

**`binding_constraint` reports why the loan was capped.** The candidate array order
(`GROSS`, `MAX_LOAN`, `LOAN_PCT_CAP`) is meaningful: the reducer takes strictly-less, so a
tie resolves to the **earliest** candidate, which reports `GROSS` — the more informative
answer. Reordering that array silently changes what the UI tells the applicant.

### 2.5 `resolveTerms` — the inclusive/exclusive tenure question

`tenure_includes_moratorium` is a **tri-state boolean**: `true`, `false`, or `null`
meaning *nobody has read the guideline yet*. The two readings of "maximum tenure" differ by
up to a year of instalments on the same loan, so `null` makes the whole computation not
computable. Do not default it to either value.

`repaymentMonths < 1` returns `missing: ['derived.repayment_months_below_one']`. That is a
*contradictory* input rather than an absent one, routed down the same "why is there no
number" path on purpose. Don't turn it into a thrown error.

Note the preference order for the moratorium: what the applicant asked for → the scheme's
UI pre-fill (`moratorium_months_default`) → the scheme's minimum, then clamped into
`[min, max]`. **`moratorium_months_default` is a form pre-fill, never a scheme rule.** It
is the one scheme field that is allowed to come from a non-guideline source without
poisoning anything, because it only decides what a dropdown shows first.

### 2.6 Rate and ceiling resolution — [rules.ts](src/core/finance/rules.ts)

Rates are a **table of conditions**, not a column. Matching rule: a rule applies when
every condition it *states* is satisfied; a `null` condition is **not a condition** (it
matches anything). Among applicable rules, the most specific wins, where specificity is
the *count of stated conditions*. Ties go to the earlier rule, so **file order in the JSON
is a deliberate tie-break** — do not sort or reformat the rule arrays.

`matched: false` means no rule in the table covered this loan. That is a **data gap, not a
zero rate**, and `computeLoan` turns it into `missing:
['scheme.interest_rules[no rule matched this loan band]']`. Never treat an unmatched rate
as `0`.

`resolveCostCeiling` overrides **per field**: a purpose rule that sets `max_unit_cost` and
leaves `max_loan` null falls back to the scheme's `max_loan`. Don't make it all-or-nothing.

---

## 3. Eligibility predicates — [src/core/eligibility/](src/core/eligibility/)

### 3.1 Three outcomes, not two

```
passed: true,  evaluable: true    the rule is satisfied
passed: false, evaluable: true    the rule is broken, and we can say by how much
passed: false, evaluable: false   we could not decide, and `missing` says why
```

The third state is the point of the whole file. If a scheme's age band has not been
transcribed, telling an applicant they are ineligible is a **lie**. `INDETERMINATE` is an
honest answer.

**Do not collapse `evaluable: false` into a failure.** Every consumer branches on
`evaluable` first. Note that unevaluable verdicts carry `passed: false` — so `if
(!verdict.passed)` includes them. Code that means "actually broken" must check
`verdict.evaluable && !verdict.passed`. This is the easiest mistake to make in this
codebase, and it is silent.

### 3.2 Status precedence: broken outranks unevaluable

In [engine.ts](src/core/eligibility/engine.ts:56):

```
anyBroken       → NOT_ELIGIBLE
else anyUnevaluable → INDETERMINATE
else                → ELIGIBLE
```

**Correct looks like:** a known-over-cap income yields `NOT_ELIGIBLE` even when the age
band is missing. A real answer does not become uncertain just because something *else* is
untranscribed. Don't reverse this.

### 3.3 The null-check order inside each predicate is load-bearing

Every predicate checks the **scheme/global gap first**, then the **applicant gap**. For
example [`incomeWithinCap`](src/core/eligibility/predicates.ts:77) checks
`global.annual_family_income_cap == null` before `applicant.annual_family_income == null`.

This is not stylistic. [remediation.ts:34](src/core/eligibility/remediation.ts:34) branches on
whether any `missing` path starts with `applicant.`:

- an `applicant.*` gap → `PROVIDE_DATA` ("tell us this")
- otherwise → `AWAIT_GUIDELINE` ("we are waiting on the guideline")

So when *both* are missing, checking the scheme side first means the applicant is **not**
asked for data that could not help them anyway. Reorder these checks and you start asking
beneficiaries for information that changes nothing.

### 3.4 Per-predicate specifics that are easy to get wrong

- **`categoryIsSc`**: `category === 'UNKNOWN'` is **unevaluable, not a failure**. And
  `UNKNOWN` is the Zod *default* — an applicant who simply hasn't answered gets
  `INDETERMINATE`, never `NOT_ELIGIBLE`. Getting this wrong would tell people they are
  ineligible for a scheme reserved for their own category because a form field was blank.
- **`casteCertAvailable` / `incomeProofAvailable`**: always `evaluable: true`. A document
  that is not in `documents_available` is a **known false**, not an unknown. `actual` is a
  boolean here, unlike the numeric predicates.
- **`projectCostAboveMicroFloor`**: `min_project_cost == null` → unevaluable. **Not zero.**
  A zero floor would silently make every tiny project eligible for the term loan. This is
  half of finding F1 in `VERIFY.md`.
- **`ageWithinRange`**: reports *both* `global.age_min` and `global.age_max` when both are
  missing, and formats `required` as the string `"min-max"`.
  **`remediation.ts` parses that string back apart** at
  [remediation.ts:90](src/core/eligibility/remediation.ts:90). It is a real coupling: if
  you change the `required` format, you must change the remediation, and the type system
  will not warn you. There is no test that pins the format — if you touch it, add one.
- **`purposeEligible` and `courseEligible` are currently identical implementations.** Do
  **not** deduplicate them. They are named by different schemes, carry different message
  keys, and produce different remediations; `COURSE_ELIGIBLE` will diverge when
  course-level rules are transcribed. Merging them would be a refactor that quietly
  removes a seam the data depends on.
- **`admissionConfirmed`**: reads `applicant.education?.admission_confirmed`; `null` or an
  absent `education` object → unevaluable.

### 3.5 The registry throws on purpose

`evaluateScheme` throws if a scheme's `predicates` array names a code that is not in
`PREDICATE_REGISTRY`. That is a data/code mismatch and failing loudly is correct — a
silently skipped rule means an applicant is approved against a rule nobody evaluated.
Don't turn it into a `continue`.

Adding a predicate is: one function + one registry entry + **three message keys**
(`.pass`, `.fail`, `.unknown`) + a remediation entry in `BY_CODE`. Miss the message keys
and `translate()` throws at render time; miss the `BY_CODE` entry and `remediate()` throws
on the first failure.

### 3.6 Reason codes, never sentences

Every predicate returns a `messageKey` like `predicate.AGE_WITHIN_RANGE.fail`. **A
hardcoded English sentence anywhere under `src/core/` is a bug** — it makes multilingual
support a rewrite of business logic. `translate()` in
[src/messages/index.ts](src/messages/index.ts) deliberately **throws** on a missing key
rather than rendering the key, because a screen showing
`predicate.AGE_WITHIN_RANGE.fail` at a demo is worse than a stack trace in development.
Add keys to [src/messages/en.json](src/messages/en.json); the coverage test checks both
directions.

---

## 4. Partner matching — [src/core/partners/](src/core/partners/)

### 4.1 Hard filters, then soft ranking. Never blended.

**HARD** (in [`hardFilterReasons`](src/core/partners/match.ts:51)) — fail any of these and
the partner must never appear for this scheme **at any distance, however healthy**:

1. `DOES_NOT_HANDLE_SCHEME_TYPE` — partner doesn't handle this scheme's type
2. `PARTNER_TYPE_NOT_ALLOWED_BY_SCHEME` — the scheme doesn't permit this class of partner
3. `LOAN_BELOW_MIN_TICKET` / `LOAN_ABOVE_MAX_TICKET`
4. `OUTSIDE_JURISDICTION`

**SOFT** — distance and health. These **only reorder an already-valid set**. If you ever
find yourself computing `0.6 × distance + 0.4 × health`, stop: that is precisely the
design this file rejects, because "nearest" and "fastest-moving" are different objectives
and one blended number hides the trade-off from the applicant. Two orderings are returned
(`ranked_by_distance`, `ranked_by_health`) and the UI shows both.

### 4.2 An unknown is not a failure

This is the subtlety most likely to be broken by a well-meaning edit:

- **Ticket range is only filtered when `loan != null`.** With no loan figure we cannot
  judge ticket fit, so we do not exclude on it.
- **Jurisdiction is only filtered when `applicant.state != null`.**

Tighten either into an unconditional exclusion and you will empty the partner list for
every applicant who hasn't finished the form.

### 4.3 All reasons, not the first one

`hardFilterReasons` collects **every** failure rather than short-circuiting, because "too
small **and** out of state" is more useful to show than whichever check happened to run
first. Excluded partners are returned in `excluded` **with their reasons** — same
philosophy as failing eligibility verdicts. "Why isn't my own bank on this list?" is a
question a beneficiary will actually ask. Do not filter `excluded` away to shorten a
response.

### 4.4 Sort details that are easy to get backwards

- **Unknown distance sorts LAST**, not first
  ([match.ts:142](src/core/partners/match.ts:142)). Never imply nearness we have not
  measured.
- **Null health sorts last** via a `-1` sentinel, so a partner with a genuine score of
  `0` still outranks one with no data.
- Both sorts rely on **JS sort stability** so equal keys keep registry order and the
  snapshot tests stay reproducible. Don't swap in a comparator that returns a non-zero
  value for equal keys.

### 4.5 `loan_exceeds_all_tickets` is narrower than it looks

It is `true` only when **every** partner has a **non-null** `max_ticket` and the loan
exceeds all of them. One partner with an unstated ceiling makes it `false` — because an
unstated ceiling is unknown, not exceeded. It is reported separately from `excluded`
because it is a different message: not "these partners were wrong for you" but "no partner
in the registry writes a file this large", which is a capacity gap worth naming.

### 4.6 Health scoring — [health.ts](src/core/partners/health.ts)

A transparent weighted composite, **not a model**:

```
health = w_fund·fund_availability + w_npa·(1 − npa_norm)
       + w_overdue·(1 − overdue_norm) + w_speed·speed_norm
```

then multiplied by a capacity-flag multiplier and clamped to `[0, 1]`.

- Weights and normalisation bounds live in
  [data/health-scoring.json](data/health-scoring.json), **not** in the code.
- `assertWeightsSumToOne` runs at load, not at render. Weights that don't sum to 1 produce
  scores outside `[0,1]` and comparisons that look arbitrary — invisible by eyeballing a
  list, which is why it throws early.
- Every factor's `raw`, `normalised`, `weight`, `contribution` and `rationaleKey` are
  returned inside the score so the UI can show *why* one partner outranked another. Don't
  reduce the return value to a bare number.
- **`data_origin` travels with the score.** That is structural, not decorative: it is what
  makes it hard to render a simulated figure without its label. Every health row today is
  `SIMULATED` and every surface that shows one must say so.

### 4.7 Distance

Haversine in TypeScript, `EARTH_RADIUS_KM = 6371.0088`, rounded to one decimal. Do not
introduce PostGIS (~150 partners; the whole sweep is sub-millisecond). It is
**straight-line, not road distance** — the UI must say so rather than implying travel time
we haven't computed. `distanceKmOrNull` returns `null` when either point is unknown, never
a distance from a silently substituted district centroid. And per hard rule 9: **never
geocode at request time.** Coordinates are seeded and committed.

---

## 5. The honesty machinery — and the one weak spot in it

[src/lib/dataset.ts](src/lib/dataset.ts) is the only place JSON becomes typed objects. It
lives **outside** `src/core/` on purpose, so the core is provably correct independent of
the figures.

Three guarantees, all of which you can break with an innocent-looking edit:

1. **`verified` is derived, never copied.** `prov()` computes
   `verified: isCitable(source)`. Only `official_guideline` and `design_decision` are
   citable. A JSON file setting `"verified": true` has no effect.
2. **The overlay fills only genuine nulls.** [`resolveField`](src/lib/dataset.ts:96) — the
   seed wins whenever it has a value; the overlay can never overwrite a real figure. That
   direction of precedence is what keeps the seed the single source of truth. (This is why
   MICRO's `moratorium_interest_treatment` shows source `placeholder` rather than
   `demo_overlay` — the seed already has a non-null value there, so the overlay can't
   touch it. I got this wrong once while testing and it cost me two attempts.)
3. **`figures_authoritative` is false for two independent reasons** — any non-citable
   figure in play, *and* unconditionally whenever the overlay was used. Belt and braces, on
   purpose: reason (2) means a future change to `isCitable()` still cannot make an overlay
   dataset claim authority.

**The weak spot, fixed 2026-09-05.** Field-level provenance was derived, but the *scheme-level* and *global-level* `verified` booleans were **copied straight from the JSON** at `dataset.ts:356` and `dataset.ts:387`. Fixed to `verified: Object.values(provenance).every(e=>e.verified)` (`src/lib/dataset.ts:356`/`387` + `src/lib/dataset-db.ts:33`) — now derived via `isCitable()` like field-level. `tests/dataset.honesty.test.ts:110` still guards the JSON claim. `recommend()` exposes `scheme_verified` — now trustworthy, but still prefer `dataset.figures_authoritative` + per-field `provenance` map for UI decisions.

**New provenance surface:** `src/lib/dataset-db.ts:1` mirrors `src/lib/dataset.ts:1` for Prisma rows (reverse of `prisma/seed.ts:1`). `tests/dataset-db.parity.test.ts:1` proves JSON↔DB deep-equal; the two loaders must stay in lockstep.

### `VERIFY.md` is generated. Don't hand-edit it.

`npm run verify:report` rewrites it; `npm run check:verify` fails if it is stale (and is
part of `npm run check`). It carries **no timestamp**, on purpose, so `--check` is
meaningful rather than failing on every run.

[scripts/verify-report.ts](scripts/verify-report.ts) contains four **findings** (F1–F4),
each paired with a `check()` that re-verifies the claim against the live engine at
generation time. If a documented claim stops being true, the generator **exits 1 and
refuses to write the file** rather than emitting a document that says something false.

If you see that failure: **the correct response is to update `FINDINGS`, not to delete the
check.** The message tells you which finding broke. I verified this path works by
temporarily flipping a seed value.

---

## 6. The architecture boundary

`src/core/` must not import from `src/llm/`, `src/app/`, `src/components/`, Next, React, or
the filesystem. `npm run check:boundaries` enforces it in CI — still passing at `b9f34ba`.

Corollaries that trip people up:

- **The core never reads the clock.** `recommend()` takes `generatedAt` as a parameter.
  That is what makes persona snapshots byte-stable. Do not call `new Date()` in `src/core/`.
- **The core is synchronous.** No `async`, no `await`, no Prisma. The database is an *input*
  to the engine, never a participant in it.
- Data reaches the core as function arguments. If the core needs something it doesn't have,
  pass it in — don't import a loader.

### The UI boundary (new since `4a8eea7`)

`src/app/` and `src/components/` are **consumers** of `src/core/`, never the other
way around. Concrete rules the baseline follows — keep them:

- **No arithmetic in components.** `LoanFigures.tsx:1` states it explicitly: every rupee
  comes from `recommend()`/`computeLoan()`; the UI formats and labels only. If a number
  is not on `LoanComputation` or `SchemeSpec`, add it to the engine with a test — do
  not derive it in the UI.
- **GET, not client state.** `/apply` submits with `method="get"` to `/result`; the query
  string is the `ApplicantProfile` via `src/lib/applicant-params.ts` + Zod. This is
  why the flow works with JS disabled and why `/result?persona=P01` is shareable.
  Do not replace it with `useState`/`useEffect` form state.
- **Blanks mean unknown.** Every input can be left blank; blank → empty string →
  `null` → Zod default (`UNKNOWN`/`UNDISCLOSED`). Never add `required`.
- **Provenance is rendered where the figure is.** `FieldRow` takes an optional
  `provenance: FieldProvenance`; unverified → red stamp via `Provenance` in
  `src/components/ui.tsx:28`. Do not invent provenance in a page — it is derived
  in `src/lib/dataset.ts` via `isCitable()`.
- **All schemes, always.** `result/page.tsx:185` renders the recommended card open
  and every other `SchemeCard` collapsed with `StatusPill`. Collapsing is density,
  not filtering. Do not filter `NOT_ELIGIBLE`/`INDETERMINATE`.
- **Two orderings, never a blend.** `PartnerPanel.tsx:1` keeps `ranked_by_distance`
  and `ranked_by_health` separate; the baseline hides the distance column when no
  coordinates exist rather than synthesising a centroid (hard rule 1).

### The LLM boundary

The model is allowed in exactly two files, neither of which exists yet:

- `src/llm/extract.ts` — free text → `ApplicantProfile`, structured output, Zod-validated.
- `src/llm/explain.ts` — an **already-computed** `RecommendationResult` → prose.

`explain.ts` must not be given the authority or the data to introduce a fact. If you ever
find yourself asking a model which scheme applies, or what the EMI is, you have broken the
project. Everything must also work with the LLM disabled — the guided form is the
**primary** intake path, not a fallback. The baseline (`4a8eea7`) preserves this:
`/apply` → `/result` works with no LLM, no DB, no JS.

---

## 7. `recommend()` — [src/core/recommend.ts](src/core/recommend.ts)

The one entry point for the UI, the CLI and the tests. Order:

1. Evaluate eligibility for **all** schemes, keeping failures.
2. Compute figures **only for `ELIGIBLE` schemes.** A number on screen reads as an offer,
   and we do not quote an EMI for a scheme the applicant cannot have. If the UI wants an
   indicative figure on the path-to-eligibility panel, that is a **clearly-labelled UI
   affordance** to be built as one — not smuggled into the core by relaxing this line.
3. Match partners only once a loan exists (ticket range is a hard filter that needs the
   amount).
4. Resolve the **scheme-baseline** checklist with `partnerType: null`; the UI re-resolves
   against the chosen partner's type when the applicant picks one.

`RECOMMENDATION_POLICY` is **our stated heuristic, not a scheme rule** — largest share of
project cost, then lower rate, then scheme code for determinism. It is exported and named
precisely so the UI can render it next to the recommendation. It is deliberately *not*
"the largest loan": a bigger loan is not automatically a better outcome for a borrower.
`SchemeCard.tsx:107` renders its `messageKey` beside the recommended card.

`pickRecommended` falls back to the first `ELIGIBLE` scheme when no scheme has computable
figures — "which scheme applies" is still the honest answer to the question asked.

Note: no persona today can put two eligible schemes in front of this function (the seed's
three schemes are mutually exclusive — that is finding F2 in `VERIFY.md`), which is why
`pickRecommended` is exported and tested directly. Don't inline it.

### How the baseline calls it

- `src/app/result/page.tsx:179` — `recommend({ applicant, ...loadBundle(), generatedAt })`
  where `applicant` is either `loadPersonas().find(p=>p.id===personaId)` or
  `parseApplicantParams(query)` (Zod-validated; throws → "unreadable link" notice).
- `src/app/personas/page.tsx:93` — same call per row at render time, with one shared
  `generatedAt` so the page has no clock noise. No outcomes are stored.

If the UI needs something `recommend()` does not return, that is a core change with its
own tests, in its own commit — not a field added in the component.

---

## 8. Checklist before you say you're done

- [ ] `npm run check` exits 0, with **≥237 tests passing** (was 230 at `b9f34ba`, 237 at 2026-09-05 core-hardened).
- [ ] No new number in `src/core/` or in `data/*.json` that you cannot cite. If you added
      one, it is `null` or its provenance source is honest and `VERIFY.md` is regenerated.
- [ ] No hardcoded user-facing English in `src/core/` or in components — message keys only
      (`src/messages/en.json`; `translate()` throws on missing key).
- [ ] No arithmetic in `src/components/` or `src/app/` — only formatting of engine output.
- [ ] GET-based intake still works with JS disabled (`/apply` → `/result` query string).
- [ ] Every figure that has a `provenance` renders it; `DatasetBanner` is on every
      result/personas page and `figures_authoritative` is false.
- [ ] Any new core logic has tests **in the same change**, not "later".
- [ ] `evaluable` is checked before `passed` anywhere you branch on a verdict.
- [ ] Hard filters still run before soft ranking; nothing blends distance with health.
- [ ] You did not fill in the `describe.todo` block in `finance.golden.test.ts`.
- [ ] Anything you assumed is stated explicitly in your reply to the user.

## 9. When you are unsure

The user does not code and is relying on you to be honest rather than confident. So:

- **Ask** rather than assume, when the answer is a scheme parameter. "I need the margin
  percentage from the guideline" is a completely acceptable thing to say, and it is what
  the user expects. They have said they will supply hand-computed figures.
- **Report** every assumption, every figure you could not verify, and anything you skipped.
- **Don't quietly widen scope.** This project is built one phase at a time with a stop for
  review at each gate. Finishing the requested thing and stopping is correct behaviour.
- If a check fails and you cannot see why, say so and show the output. Do not disable the
  check, loosen a tolerance, or delete an assertion to get to green. Every one of those
  guards exists because it caught something.
