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

### A3. The age band's invisible format coupling

**Where:** [src/core/eligibility/predicates.ts](src/core/eligibility/predicates.ts) writes
the age window as a text string like `"18-60"`;
[src/core/eligibility/remediation.ts:90](src/core/eligibility/remediation.ts:90) parses
that string apart again to say "you are 3 years over the limit".

Two files agreeing on a text format, with **nothing pinning the format down.** Change how
the band is written and the "here is what you could do about it" message silently
degrades. No crash, no failing test.

If you touch either side, add a test that fixes the format. Right now there isn't one.

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

---

## Part B — Caught, only by a snapshot that can be regenerated away

This category deserves its own section, because the failure *looks* like the safety net
working when it is not.

Some tests work by recording the exact output for all 40 test applicants and comparing
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

### B3. Anything touching the recommendation tie-breaks

The engine chooses between qualifying schemes by largest share of project cost, then lower
interest rate, then scheme code alphabetically — that last one purely so the answer is
repeatable. Changes here move which scheme gets recommended, and again show up only as a
snapshot diff.

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

### One important exception in that table

The mark saying whether a **scheme as a whole** is verified is the one honesty value that
is *copied from the data file* rather than worked out fresh from its source — see
[src/lib/dataset.ts:356](src/lib/dataset.ts:356) and
[src/lib/dataset.ts:387](src/lib/dataset.ts:387). It is guarded by a test, not by the
machinery itself.

Every other provenance mark is structurally impossible to forge. That one is not.
Deriving it in the loader instead would be a genuine improvement — worth doing
deliberately, with a test.

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
  saying "230 passing" long after something has broken. Do not treat it as current, and
  never edit it to look green.

---

## The one command that answers "did I break it?"

```bash
npm run check
```

Green means: the code compiles, the style rules pass, the engine has not reached into
parts of the app it is forbidden to touch, the unverified-figures list is current, and all
230 tests pass.

Three things it does **not** mean:

1. **It cannot catch Part A.** Those failures pass every check by construction.
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
