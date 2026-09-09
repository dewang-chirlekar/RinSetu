# FRAGILE.md — what breaks quietly, and why

Companion to [HANDOFF.md](HANDOFF.md). That file explains how the code works; this one
lists the specific places where an edit made without understanding the reason behind the
code will cause damage.

It is organised by the only thing that really matters in practice: **whether anything
would tell you it broke.** A subtle bug that fails loudly is an inconvenience. A subtle
bug that passes every check is the one that puts a wrong rupee figure in front of a real
borrower.

Four parts:

- **[Part A](#part-a--silent-nothing-will-catch-these)** — silent. Nothing catches these. Highest risk.
- **[Part B](#part-b--caught-only-by-a-snapshot-that-can-be-regenerated-away)** — caught, but only by a snapshot that can be regenerated away. Deceptive.
- **[Part C](#part-c--caught-loudly-the-safety-net-works-here)** — caught loudly. The safety net works.
- **[Part D](#part-d--what-a-non-programmer-can-break-without-writing-code)** — what a non-programmer can break by editing data files.

---

## Part A — Silent. Nothing will catch these.

No test fails. No error appears. The screen just shows something wrong or misleading.

### A1. Filling in the empty test block at the bottom of the golden tests

**Where:** [tests/finance.golden.test.ts:297](tests/finance.golden.test.ts:297)

There is a deliberately empty placeholder block (`describe.todo`) that reads like an
unfinished job. Anyone who "helpfully completes" it would be writing invented scheme
figures **into the tests themselves** — and the suite would go green.

At that point the safety net is asserting that made-up numbers are correct, and every
future run confirms the fiction. Nothing downstream catches it. It cannot be caught,
because the tests *are* the thing that catches everything else.

**This is the single worst thing that could happen to this codebase.** The block must stay
empty until real published scheme parameters exist.

### A2. Merging the two identical-looking eligibility rules

**Where:** `purposeEligible` and `courseEligible` in
[src/core/eligibility/predicates.ts](src/core/eligibility/predicates.ts)

Their bodies are currently identical, so they look like copy-paste waiting to be tidied
up. They are not. They are named by different schemes, carry different message keys and
different remediations, and the education one will diverge as soon as course-level rules
are transcribed.

If both names are pointed at one function, **every existing test still passes.** Both
codes are still registered, still evaluated, still pass and fail across the persona set.
The seam simply vanishes, and resurfaces months later as a baffling bug when somebody
tries to add course rules.

### A3. The age band's invisible format coupling — fixed 2026-09-05

**Where:** [src/core/eligibility/predicates.ts](src/core/eligibility/predicates.ts) writes
the age window as a text string like `"18-60"`;
[src/core/eligibility/remediation.ts:90](src/core/eligibility/remediation.ts:90) parses
that string apart again to say "you are 3 years over the limit".

Two files agreeing on a text format, with **nothing pinning the format down.** Change how
the band is written and the "here is what you could do about it" message silently
degrades. No crash, no failing test.

Fixed: `tests/eligibility.age-format.test.ts:1` (6 tests) pins `required` as `^\d+-\d+$` (no spaces), checks `too_young`/`too_old` deltas via `remediation.ts:94` parse, and different bounds. If either side changes format, this fails loudly (`Part C` now covers it). See `docs/PROGRESS.md` 2026-09-05 core hardening.

### A4. Deleting the "unreachable" lines that look like dead code

**Where:** the end of each branch in `amortisationBase` and `moratoriumInterestExact`,
[src/core/finance/emi.ts:77](src/core/finance/emi.ts:77) onward

Each grace-period branch ends with a line assigning to something called `unreachable`. It
looks like leftover debris and does nothing at all when the code runs.

Its actual job: if anyone ever adds a **fourth** grace-period treatment, that line makes
the project refuse to build until the new case has been handled everywhere. Remove it and
a fourth treatment silently falls through to whatever the last branch happened to do —
which is exactly the "guessed the wrong treatment" failure this whole project exists to
prevent.

Deleting it breaks nothing today. That is precisely what makes it easy to delete.

### A5. Reordering the interest-rate table in the data file

**Where:** `interest_rules` in [data/schemes.seed.json](data/schemes.seed.json)

Rates are stored as a list of conditional rows ("for loans between X and Y, the rate is
Z"). When two rows both apply and state the same number of conditions, **the row earlier
in the file wins.**

So the order of lines in that file is not cosmetic — it is a rule. Reformatting the file,
sorting it "nicely", or letting an editor tidy it can change the interest rate a real
applicant is quoted.

Partly caught, but in a deceptive way — see [B1](#b1-the-rate-table-ordering-a5-revisited).

### A6. The two `??` fallbacks in the loan pipeline

**Where:** [src/core/finance/loan.ts](src/core/finance/loan.ts)

Two lines read like invented defaults — the subsidy cap falls back to zero, the subsidy
timing falls back to `BACK`. They are safe **only** because a check a few lines above
already refuses to compute whenever a subsidy actually exists. With no subsidy, neither
value can influence any figure.

The risk is not those two lines. It is somebody seeing the pattern and copying it
somewhere the guard does not exist — at which point a missing guideline figure silently
becomes a real default, and the project's central promise is broken by a two-character
edit.

Two opposite mistakes to avoid: do not "fix" it by demanding those fields
unconditionally (that blocks a scheme on a figure that cannot change the answer), and do
not reuse the pattern anywhere a fallback could actually reach the arithmetic.

### A7. Purpose flat list vs `optgroup` — changing purpose codes breaks UI deduping silently

**Where:** `eligible_purposes` in [data/schemes.seed.json](data/schemes.seed.json) and `src/components/ApplyForm.tsx` purpose flat deduping

Eligibility is `category C` only — purpose is not grouped by scheme. Since 2026-09-10 `ApplyForm` renders `purpose` as a **flat deduped list** (no `optgroup`), deduped via `Set` across all schemes. MICRO and AMY now share `PLACEHOLDER_tailoring` intentionally so P41 can be ELIGIBLE for both — deduping hides the duplicate, but `purposeEligible` still checks per-scheme. If you change a purpose code, add a new code that duplicates an existing label, or re-introduce `optgroup`/per-scheme grouping, the dropdown can silently hide or duplicate an option and P41 stops proving F2. No test fails if you duplicate a code because deduping masks it; the snapshot only notices if the persona count changes. Keep purpose codes canonical (one code = one activity), dedupe in the UI, and don't filter purposes by `intent` or scheme type.

### A8. Location cascade strict disabling — removing the guard breaks 360px and hints

**Where:** `src/components/ApplyForm.tsx:176` `districtsForState` / `src/components/ApplyForm.tsx:182` `tehsilsForDistrict` and `ApplyForm.tsx:454`/`469` `disabled` + `hint`

Since 2026-09-10 `district` is **disabled until `state`** and `tehsil` until `district` when JS is on (`jsEnabled` guard); with JS off all options show (graceful degradation). This is load-bearing for 360px: showing every district/tehsil in one `<select>` overflows the viewport and hides the `"select state first"` / `"select district first"` (`district_need_state` / `tehsil_need_district`) hint that prevents a wrong-jurisdiction submission. If you restore the old behaviour (show all districts when no state), the partner jurisdiction filter later does the right thing, so **no test fails** — the form just becomes unusable on a small phone and an applicant can pick a tehsil that doesn't belong to the chosen district (auto-detect in `handleTehsilChange` then silently corrects `state`). Don't remove the `jsEnabled && !selectedState` guard or the `disabled` prop, and keep the hints.

---

## Part B — Caught, only by a snapshot that can be regenerated away

This category deserves its own section, because the failure *looks* like the safety net
working when it is not.

Some tests work by recording the exact output for all **41** test applicants (was 40 before P41) and comparing
future runs against that record. Change engine behaviour and they fail — good. But the
"fix" a careless editor reaches for is to **regenerate the recorded output**, which makes
the failure disappear without anyone examining what changed. Green again, behaviour
silently different.

### B1. The rate-table ordering (A5, revisited)

A reorder changes the recorded output, so `tests/personas.snapshot.test.ts` fails. But it
surfaces as an unexplained diff inside a large table, not as "you changed an interest
rate". Regenerate the snapshot and it is gone.

### B2. The check order inside each eligibility rule

Every rule checks *"is the guideline missing?"* **before** *"is the applicant's data
missing?"*. That order decides what the person is actually told:

- **"we are waiting on the guideline"** — nothing you can do
- **"please tell us your income"** — something you can do

When both are missing, checking the guideline side first means we do not ask somebody for
information that could not have helped them anyway. Swap the order and the messages
change for real users. The snapshot notices; it just looks like noise.

### B3. Anything touching the recommendation tie-breaks — now live via P41 (F2)

The engine chooses between qualifying schemes by largest share of project cost, then lower
interest rate, then scheme code alphabetically — that last one purely so the answer is
repeatable. **Since 2026-09-10 this is no longer hypothetical:** P41 tailoring 90k is ELIGIBLE for both MICRO (6.5% via SCA) and AMY (15% via NBFC-MFI) and the ranking picks MICRO; `result/page.tsx:185` shows MICRO open + AMY ELIGIBLE collapsed. Changes here now move which scheme P41 recommends, and still show up only as a `tests/personas.snapshot.test.ts` diff (P41 row flips). Regenerating the snapshot hides the change — explain why the output changed before touching the recorded file.

### B4. F2 — multi-scheme eligibility is now live (was unreachable)

**Where:** `data/schemes.seed.json` `eligible_purposes` overlap (`PLACEHOLDER_tailoring` in MICRO + AMY) + `data/personas.fixtures.json` P41 + `src/core/recommend.ts` `RECOMMENDATION_POLICY`

Previously no persona could be ELIGIBLE for two schemes — the purpose lists were disjoint and `recommend()` ranking never fired on real data (finding F2 in `VERIFY.md` said "they cannot"). Since 2026-09-10 **F2 is live via P41** (tailoring 90k, `intent: other`, Nagpur): both MICRO and AMY ELIGIBLE, `RECOMMENDATION_POLICY` picks MICRO (largest share tied → lower rate wins). `SchemeCard` keeps the recommended scheme open and other ELIGIBLE cards collapsed. If you break the overlap (rename a purpose code, change a ceiling, remove `PLACEHOLDER_tailoring` from one scheme) P41 goes single-eligible and the ranking looks dead again; the snapshot fails but with a P41-only diff that's easy to regenerate away. Don't treat ranking as dead code — it's exercised, and `SchemeCard.tsx:107` policy copy must stay in sync.

### The rule that protects you

> If a snapshot test fails, explain **why the output changed** before touching the
> recorded file. "I regenerated the snapshot" is not a fix.

---

## Part C — Caught loudly. The safety net works here.

These are listed because they are subtle enough to *look* risky, and it is worth knowing
which ones do not need worrying about. In each case a test fails by name.

| Fragile thing | What catches it |
| --- | --- |
| Making the grace-period treatments behave alike | *"SERVICED and WAIVED share an EMI and differ in outflow by exactly P·r·m"* and *"CAPITALISED EMI is strictly higher than the other two"* |
| "Simplifying" the repayment loop to carry a rounded balance forward | *"closes at exactly zero"* and *"repays exactly the amortised principal"* |
| Changing total interest to a plain sum of the interest column (double-counts under CAPITALISED) | *"accounts for the moratorium in exactly one of the two moratorium totals"* |
| Switching to standard banker's rounding | *"is half-up, not banker's"* |
| Treating "no rate row matched" as a 0% rate | *"refuses to price when no rule matches the loan band"* |
| Collapsing "we don't know" into "not eligible" | *"is INDETERMINATE when something is unknown and nothing is broken"* |
| Letting an unknown outrank a genuine failure | *"is NOT_ELIGIBLE when a rule is broken, even if others are unknown"* |
| Excluding banks when the loan amount or the applicant's state is unknown | *"applies every filter except the ticket range when the loan is not computable"* |
| Sorting unknown distances first instead of last | *"orders by ascending distance, with unknown distances last"* |
| Letting demo stand-in values overwrite real transcribed figures | *"leaves every non-null seed value exactly as the seed states it"* |
| Making placeholder figures look official | *"would only go true if every single figure became citable"* and *"ignores a verified:true that a JSON file tries to assert for itself"* |
| Reading the clock inside the engine | *"takes its timestamp from the caller and never reads the clock"* |
| Making a missing text key render silently instead of erroring | *"throws on a key that does not exist, rather than rendering the key"* |
| Breaking JSON↔DB parity while offline | *"DB unreachable, skipping parity check"* — 2s probe + `ctx.skip()` so `npm run check` stays green with wifi off (was `describe.skipIf(!hasDb)` only, which failed when `DATABASE_URL` was set but DB unreachable) |

### Former exceptions — now fixed 2026-09-05–07

The mark saying whether a **scheme as a whole** is verified *was* copied from the data file — see `src/lib/dataset.ts:356` and `dataset.ts:387`. It was guarded by a test, not by the machinery itself. Every other provenance mark was structurally impossible to forge; that one was not. Fixed: `src/lib/dataset.ts:356`/`387` and `src/lib/dataset-db.ts:33` now derive `verified: Object.values(provenance).every(isCitable)` like field-level `prov()` (`src/core/types.ts:94`). `tests/dataset.honesty.test.ts:110` still guards the JSON claim.

The DB parity test *was* `describe.skipIf(!hasDb)` — green when `DATABASE_URL` unset, red when it was set but the DB was unreachable (wifi off). That is exactly the Phase 9 gate (`docs/ROADMAP.md:368` "full demo runs with wifi physically off"). Fixed 2026-09-07: `tests/dataset-db.parity.test.ts:38` now `isDbUnreachableError()` + 2s `connectionTimeoutMillis` probe + `console.warn('DB unreachable, skipping parity check')` → `ctx.skip()`, so offline is `11 files, 236 passed | 1 skipped` instead of a failure. See `docs/PROGRESS.md` 2026-09-07 parity offline-fix.

---

## Part D — What a non-programmer can break without writing code

The most likely next job is one that needs no programming at all: typing real guideline
figures into the data files as they are found. That is the intended workflow. Here is
where it bites.

### D1. Fields are not bare numbers

A figure in [data/schemes.seed.json](data/schemes.seed.json) is **not**
`"margin_pct": 0.1`. It is a small block holding the value **plus** where it came from and
a note.

Replace the whole block with just a number and the project refuses to load, with a
confusing error about expecting an object rather than a string. This trap caught me twice
while testing, so it will almost certainly catch you.

> **Change the value inside the block. Do not replace the block.**

### D2. Changing a figure without changing its source

Type in a real rate from a real circular but leave the source saying `placeholder`, and
the system keeps treating it as untrustworthy — it stays on the unverified list and the
"these figures are not authoritative" banner stays up.

The reverse is worse: marking something as coming from an official guideline when it did
not is the one claim the machinery cannot detect for you at the scheme level (see the
exception at the end of Part C).

> Update the value, the source, **and** the source URL and date together. Then run
> `npm run verify:report` so the tracking list matches reality.

### D3. Writing `"verified": true` by hand

It does nothing. Trustworthiness is worked out from the source instead, precisely so that
nobody can flip a switch the night before a demo. What it *will* do is fail a test that
objects to a file making a claim it is not entitled to make. Harmless, but the failure
looks alarming out of context.

### D4. Editing the demo overlay and expecting a figure to change

The stand-in values fill only slots the real file left **blank**. If a figure already has
a value, editing the overlay does nothing whatsoever.

This one caught me too — two attempts wondering why a change had no effect, before
remembering the precedence is deliberate. It is what stops demo stand-ins from ever
overwriting a real transcribed figure.

### D5. Adjusting the bank health weights

In [data/health-scoring.json](data/health-scoring.json) the four weights must add up to
exactly 1. Change one from 0.3 to 0.4 and the project **stops with a clear error** rather
than quietly producing distorted rankings.

Safe to attempt — just adjust the others to compensate.

### D6. Reordering or reformatting any data file

Covered in [A5](#a5-reordering-the-interest-rate-table-in-the-data-file) and
[B1](#b1-the-rate-table-ordering-a5-revisited). Repeated here because it is the kind of
thing an editor or an auto-formatter does without being asked.

### D7. Editing the generated files by hand

- **`VERIFY.md`** is produced by a command and checked for freshness. Hand-editing it
  makes the check fail.
- **`TEST-RECORD.md`** is a snapshot of one moment, not a live readout. It will keep
  saying "237 passing" long after something has broken (updated 2026-09-05). Do not treat it as current, and
  never edit it to look green.

---

## The one command that answers "did I break it?"

```bash
npm run check
```

Green means: the code compiles, the style rules pass, the engine has not reached into
parts of the app it is forbidden to touch, the unverified-figures list is current, and all
237 tests pass (11 files, wifi on: 237 passed, wifi off: 236 passed | 1 skipped `DB unreachable, skipping parity check`).

Three things it does **not** mean:

1. **It cannot catch Part A.** Those failures pass every check by construction — now reduced by A3 pin (`tests/eligibility.age-format.test.ts`) and former verified-copy exception (fixed 2026-09-05).
2. **A regenerated snapshot looks identical to a genuine pass.** If somebody reports "I
   fixed the failing test", the right question is *"what changed in the output, and why was
   that correct?"*
3. **Green says the arithmetic is right, not that the figures are real.** Most scheme
   numbers are still placeholders. The engine is correct; the inputs are pending. Those are
   separate things, and `VERIFY.md` is the honest record of the second one.

## The short version

The arithmetic and the eligibility logic are well defended — Part C is long for a reason.

What is thinly defended is **judgement**: the places where something looks redundant,
inconsistent, or unfinished and is in fact load-bearing. Every one of those spots carries
a comment in the code explaining itself, rather than trusting the next reader to infer it.
Read the comment before changing the line.
