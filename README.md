# RinSetu

**AI-assisted concessional credit scheme matching and assessment platform**

RinSetu is a web-based prototype for helping applicants understand which concessional-credit schemes they may qualify for, why they qualify or do not qualify, what the financial outcome looks like, which documents are required, and which channel partners may be suitable.

The project is being developed for **Smart India Hackathon 2026 — SIH26092**.

> **Illustrative figures — not an offer**
>
> The current prototype contains unverified/demo scheme figures and simulated partner-health data. These are explicitly marked in the application. Eligibility and financial calculations are performed deterministically from the loaded dataset; official figures must be verified against the relevant authority before real-world use.

---

## What RinSetu Does

RinSetu takes an applicant's information and evaluates it against the available scheme definitions.

It does not simply return a single "recommended" scheme.

Instead, it evaluates the available schemes and shows:

- Which schemes the applicant is eligible for
- Which schemes they are not eligible for
- Which schemes cannot yet be determined because information is missing
- Why a scheme failed
- What could change the eligibility outcome
- Loan, subsidy, margin and EMI calculations where computable
- Required documents
- Suitable channel partners

The central principle is:

> **The numbers have to be defensible.**

The deterministic engine, rather than an LLM, is responsible for eligibility and financial decisions.

---

## Current Prototype

The current application provides an end-to-end prototype:

```text
Applicant
    ↓
Guided intake
    ↓
ApplicantProfile
    ↓
Deterministic recommendation engine
    ↓
Complete scheme verdict
    ↓
Financial results
    ↓
Documents + partner recommendations
```
