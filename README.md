# RinSetu

<<<<<<< HEAD
**Concessional credit for SC entrepreneurs, matched in plain language.**
=======
**AI-assisted concessional credit scheme matching and assessment platform : SIH 2026, SIH26092**
>>>>>>> 88a39068fc5d85b76c11ffeb846715f2f51126c6

Built for Smart India Hackathon 2026, problem statement SIH26092.

![Next.js 15](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Tests](https://img.shields.io/badge/tests-237%20passing-3c9d5d)
![Languages](https://img.shields.io/badge/languages-English%20%7C%20Hindi%20%7C%20Marathi-7c5cbf)

> **Live demo:** https://rin-setu-git-main-dewang-chirlekars-projects.vercel.app/
>
> The deployment currently sits behind Vercel Authentication. If the link asks you to sign in, that is deployment protection and not the application. Everything below also runs locally with `npm run dev`.

> **These figures are not an offer.** RinSetu is a hackathon prototype. Several scheme parameters are still placeholders waiting on official transcription, and partner health data is simulated. The interface labels every figure with where it came from. Nothing shown is a sanction. [VERIFY.md](VERIFY.md) lists every value we cannot yet defend with a published source.

## Why this exists

Concessional credit for Scheduled Caste beneficiaries is routed through a large network of Channel Partners. An applicant often knows the scheme name at best. They may not know whether they qualify, what the loan and EMI would actually be under that scheme's rules, or which partner in their district handles that category of loan. The result is predictable: files sent to the wrong office, documents that come back incomplete, and disbursement that slips by weeks.

Existing discovery portals list schemes and stop at a description page. They answer "what schemes exist". They do not answer "do I qualify, why not, and what would change it".

RinSetu is deliberately narrow. It covers one credit ecosystem from end to end, starting with a livelihood plan in plain language and ending with a complete application file at the right partner's desk.

## What it does

- **A verdict for every scheme, including the failures.** Each scheme is evaluated against the applicant, not just the recommended one. A rejection keeps its reason code and the smallest change that would make the applicant eligible, so a "no" becomes a next step.
- **Loan and EMI under the scheme's own rules.** Eligible project cost, subsidy, margin money, loan, interest rate and EMI, followed by the full amortisation schedule. All three moratorium interest treatments are implemented and tested.
- **Partner routing with hard filters.** Capability, ticket size and jurisdiction are filtered first. Only then do distance and partner health reorder an already-valid list, and the two rankings are shown separately because "nearest" and "fastest-moving" are not the same question.
- **A document checklist and a ready packet.** The checklist adapts to the scheme and the chosen partner type. The pre-filled PDF can be downloaded and carried to the office.
- **Saved applications that never change price.** A saved application is stored as a receipt. Reopening it shows the numbers exactly as they were computed that day, not a fresh quote against today's data.
- **Three languages.** English, हिन्दी and मराठी, with scheme names and rupee amounts deliberately left untranslated.
- **Plain-language intake, optional.** A short description of a business or education plan can pre-fill the guided form. The guided form is the primary path and works with no model and no network.
- **Partner health upload for administrators.** A CSV upload path accepts an MIS-style export and marks those rows as real uploads. Until then, the seeded health rows stay clearly labelled `SIMULATED`.
- **A demo that survives bad wifi.** The full flow runs with `DEMO_MODE=true`: model calls come from fixtures, and the map falls back to a ranked list without tiles.

## How it works

```
guided form  (/apply) ─┐
                       ├─→ ApplicantProfile (Zod-validated) ─→ deterministic core
free text ─→ LLM parse ┘                                          │
                                                                  ├─ eligibility verdicts (pass and fail)
                                                                  ├─ loan, EMI, amortisation
                                                                  ├─ partner matching and ranking
                                                                  └─ document checklist
                                                                          │
                                                          narration (LLM) + interface
```

Two rules shape the whole design.

1. **The language model never decides anything and never produces a number.** It appears in exactly two places. It can turn free text into a structured profile, and it can narrate a result that has already been computed. Eligibility, loan amounts, subsidy, margin, EMI, partner ranking and document lists are deterministic TypeScript in `src/core/`. The core cannot import the model layer, the app routes or the components, and CI enforces that boundary.
2. **Every figure carries provenance.** Each value is tagged with its source and whether it is citable. Values we cannot defend are listed in [VERIFY.md](VERIFY.md) and stamped in the interface. The list is generated from the data, so it cannot quietly fall behind it.

## Tech stack

Next.js 15 with the App Router, TypeScript in strict mode, Tailwind CSS, PostgreSQL on Supabase, Prisma, Vitest, MapLibre GL JS with OpenStreetMap tiles, `@react-pdf/renderer`, next-intl, Zod, and Google Gemini Flash behind a single adapter.

Distance is computed with the haversine formula in TypeScript. With roughly 150 partners there is no reason to run PostGIS.

## Run it locally

You need Node.js 20 or newer and npm.

```bash
git clone https://github.com/dewang-chirlekar/RinSetu.git
cd RinSetu
npm install
npm run dev
```

Open http://localhost:3000. `npm install` runs `prisma generate` for you.

The guided flow, the personas page and the PDF packet work without a database and without an API key. To try a specific result, open `/result?persona=P41`. Persona P41 is eligible for two schemes at once, so it shows the ranking policy at work.

Create a `.env` file when you want the optional services:

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Saving, listing and deleting applications; seeding; JSON to database parity check |
| `GEMINI_API_KEY` | Free-text extraction and narration |
| `ADMIN_PASSWORD` | Partner health CSV upload |
| `DEMO_MODE=true` | Serve model calls from fixtures and run the offline demo |

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the development server on port 3000 |
| `npm run build` | Production build |
| `npm run check` | Typecheck, lint, architecture boundary, VERIFY freshness and the full test suite |
| `npm run test` | Run the tests on their own |
| `npm run personas` | Run all 41 persona fixtures through the engine |
| `npm run personas P41` | Show one persona in full detail |
| `npm run seed` | Load `data/` into the configured database |
| `npm run verify:report` | Regenerate `VERIFY.md` from the data |

`npm run check` is the one command that answers "did I break it". At the time of writing it runs typecheck, lint, the core boundary check, the generated-file freshness check and 237 tests across 11 files.

## Project structure

```
rinsetu/
├─ src/core/          deterministic eligibility, finance, partner and document logic
├─ src/app/           routes: intake, result, personas, saved applications, admin, APIs
├─ src/components/    interface components
├─ src/llm/           the only files allowed to call the model
├─ src/lib/           dataset loaders, database access, PDF packet, helpers
├─ data/              schemes, partners, health, documents, personas, message data
├─ prisma/            schema, migrations and seed
├─ tests/             golden, branch, ranking, honesty and snapshot tests
└─ docs/              progress, roadmap, handoff and fragility notes
```

The most important line in that tree is the boundary around `src/core/`. It stays pure, synchronous and free of the database, Next.js and the model layer, which is why the numbers can be tested and defended.

## Documentation

The public README stays short on purpose. The engineering detail lives in `docs/`:

- [docs/PROGRESS.md](docs/PROGRESS.md) covers current state, what is built and what was deferred.
- [docs/ROADMAP.md](docs/ROADMAP.md) holds the phased build plan, architecture notes and the demo script.
- [docs/HANDOFF.md](docs/HANDOFF.md) explains how not to break the engine, the matching or the saved receipts.
- [docs/FRAGILE.md](docs/FRAGILE.md) lists the edits that break things quietly, and why.
- [docs/TEST-RECORD.md](docs/TEST-RECORD.md) records the test suite at the last verified gate.
- [VERIFY.md](VERIFY.md) lists every figure that is not yet backed by a published source.
- [CLAUDE.md](CLAUDE.md) is the project constitution: the two invariants and the non-negotiable rules.

## Disclaimer

RinSetu is a student prototype built for Smart India Hackathon 2026. It is not affiliated with NSFDC or any participating institution. It does not sanction credit and does not provide financial advice. Scheme parameters and partner health data are illustrative until they are transcribed from official guidelines. Please do not rely on these rupee figures for a real credit decision.
