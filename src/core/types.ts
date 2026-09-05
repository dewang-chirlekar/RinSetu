/**
 * src/core/types.ts
 *
 * The vocabulary of the deterministic core, plus Zod schemas for everything
 * that crosses a trust boundary (LLM extraction, seed JSON, HTTP request bodies).
 *
 * This file — and everything else under src/core/ — must not import from
 * src/llm/, src/app/ or src/components/. See scripts/check-boundaries.mjs.
 *
 * Two conventions used throughout:
 *
 *   1. `null` means UNKNOWN, never zero. A null scheme parameter makes a
 *      computation NOT COMPUTABLE and the engine reports which parameter was
 *      missing. Nothing in here substitutes a default for a missing guideline
 *      value.
 *
 *   2. Nothing returns an English sentence. Predicates and remediations return
 *      codes plus an i18n `messageKey`. See src/messages/.
 */

import { z } from 'zod';

/* ------------------------------------------------------------------------- */
/* Enumerations                                                              */
/* ------------------------------------------------------------------------- */

export const SCHEME_TYPES = ['MICRO', 'TERM', 'EDUCATION'] as const;
export type SchemeType = (typeof SCHEME_TYPES)[number];

export const PARTNER_TYPES = ['SCA', 'PSB', 'RRB', 'NBFC_MFI'] as const;
export type PartnerType = (typeof PARTNER_TYPES)[number];

export const SUBSIDY_TIMINGS = ['FRONT', 'BACK'] as const;
export type SubsidyTiming = (typeof SUBSIDY_TIMINGS)[number];

/**
 * The known trap. See CLAUDE.md — all three must be implemented and the
 * treatment is a per-scheme field sourced from the guideline, never a default.
 */
export const MORATORIUM_TREATMENTS = ['CAPITALISED', 'SERVICED', 'WAIVED'] as const;
export type MoratoriumTreatment = (typeof MORATORIUM_TREATMENTS)[number];

export const SOCIAL_CATEGORIES = ['SC', 'ST', 'OBC', 'GENERAL', 'UNKNOWN'] as const;
export type SocialCategory = (typeof SOCIAL_CATEGORIES)[number];

export const GENDERS = ['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED'] as const;
export type Gender = (typeof GENDERS)[number];

export const INTENTS = ['LIVELIHOOD', 'EDUCATION', 'UNKNOWN'] as const;
export type Intent = (typeof INTENTS)[number];

export const STUDY_LOCATIONS = ['INDIA', 'ABROAD'] as const;
export type StudyLocation = (typeof STUDY_LOCATIONS)[number];

/** Non-nullable on PartnerHealth by design — see data/partner-health.sim.json. */
export const DATA_ORIGINS = ['MIS_UPLOAD', 'SIMULATED'] as const;
export type DataOrigin = (typeof DATA_ORIGINS)[number];

export const CAPACITY_FLAGS = ['OPEN', 'CONSTRAINED', 'CLOSED'] as const;
export type CapacityFlag = (typeof CAPACITY_FLAGS)[number];

/* ------------------------------------------------------------------------- */
/* Provenance — invariant #2 of CLAUDE.md                                    */
/* ------------------------------------------------------------------------- */

export const PROVENANCE_SOURCES = [
  /** Transcribed from the sponsoring corporation's published guideline. The only publicly citable source. */
  'official_guideline',
  /** Stated in the SIH26092 problem statement. Indicative; the PS contradicts itself on rates. */
  'ps_text',
  /** No basis at all. Exists to make the schema concrete. */
  'placeholder',
  /** Supplied by data/schemes.demo-overlay.json purely so the engine is exercisable. */
  'demo_overlay',
  /** Our own stated design decision, e.g. the health-score weights. Defensible but not a guideline figure. */
  'design_decision',
  /** General Indian administrative practice, varies by state, not transcribed. */
  'common_practice',
  /** Invented rows for development, e.g. the interim partner registry. */
  'fabricated',
  /** Public open data, e.g. OpenStreetMap. */
  'open_data',
] as const;
export type ProvenanceSource = (typeof PROVENANCE_SOURCES)[number];

export interface FieldProvenance {
  source: ProvenanceSource;
  /** True only for sources a judge could be shown. Derived, never hand-set. See isCitable(). */
  verified: boolean;
  note?: string | null;
}

/** The two sources whose figures may appear on a slide. Everything else is caveated in the UI. */
export function isCitable(source: ProvenanceSource): boolean {
  return source === 'official_guideline' || source === 'design_decision';
}

export type Provenanced<T> = { value: T } & FieldProvenance;

/* ------------------------------------------------------------------------- */
/* Scheme specification                                                      */
/* ------------------------------------------------------------------------- */

export interface InterestRule {
  applies_when: {
    loan_band_min?: number | null;
    loan_band_max?: number | null;
    purpose?: string | null;
    gender?: Gender | null;
  };
  annual_rate_pct: number | null;
  provenance: FieldProvenance;
}

export interface CostCeilingRule {
  applies_when: { purpose?: string | null };
  max_unit_cost: number | null;
  max_loan: number | null;
  provenance: FieldProvenance;
}

/**
 * A scheme's parameters as the engine sees them: plain values, with a parallel
 * provenance map so the UI can badge every figure it renders.
 *
 * Every numeric field is nullable on purpose. The engine must be correct
 * independent of the figures — that is what lets real guideline values drop in
 * without touching logic (CLAUDE.md hard rule 2).
 */
export interface SchemeSpec {
  code: string;
  type: SchemeType;
  name_i18n: Record<string, string>;
  description_key: string;

  max_unit_cost: number | null;
  max_loan: number | null;
  min_loan: number | null;
  min_project_cost: number | null;
  loan_pct_cap: number | null;
  margin_pct: number | null;
  subsidy_pct: number | null;
  subsidy_cap: number | null;
  subsidy_timing: SubsidyTiming | null;

  moratorium_months_min: number | null;
  moratorium_months_max: number | null;
  /** UI pre-fill only, not a scheme rule. The applicant chooses within [min, max]. */
  moratorium_months_default: number | null;
  moratorium_interest_treatment: MoratoriumTreatment | null;

  tenure_months_max: number | null;
  /** ROADMAP §8.1 open question. Null means the engine refuses to derive repayment months. */
  tenure_includes_moratorium: boolean | null;

  eligible_purposes: string[];
  allowed_partner_types: PartnerType[];
  predicates: PredicateCode[];
  required_documents: string[];

  interest_rules: InterestRule[];
  cost_ceiling_rules: CostCeilingRule[];

  /** Keyed by field name, e.g. provenance.margin_pct. */
  provenance: Record<string, FieldProvenance>;
  source_url: string | null;
  source_date: string | null;
  verified: boolean;
}

export interface GlobalEligibility {
  annual_family_income_cap: number | null;
  category_requirement: SocialCategory | null;
  age_min: number | null;
  age_max: number | null;
  provenance: Record<string, FieldProvenance>;
  verified: boolean;
}

export interface SchemeDataset {
  schemes: SchemeSpec[];
  global: GlobalEligibility;
  /** Human-readable label rendered in the UI banner, e.g. 'seed + DEMO OVERLAY'. */
  label: string;
  /** False whenever any figure in play is not citable. Can never be forced true. */
  figures_authoritative: boolean;
  overlay_applied: boolean;
  notes: string[];
}

/* ------------------------------------------------------------------------- */
/* Applicant profile — the output of LLM boundary #1                         */
/* ------------------------------------------------------------------------- */

export const ApplicantEducationSchema = z.object({
  admission_confirmed: z.boolean().nullable(),
  study_location: z.enum(STUDY_LOCATIONS).nullable(),
  course_name: z.string().nullable().optional(),
  course_duration_months: z.number().int().positive().nullable().optional(),
});
export type ApplicantEducation = z.infer<typeof ApplicantEducationSchema>;

export const ApplicantProfileSchema = z.object({
  id: z.string().optional(),
  name: z.string().nullable().optional(),
  age: z.number().int().min(0).max(120).nullable(),
  gender: z.enum(GENDERS).default('UNDISCLOSED'),
  category: z.enum(SOCIAL_CATEGORIES).default('UNKNOWN'),
  annual_family_income: z.number().min(0).nullable(),
  state: z.string().nullable(),
  district: z.string().nullable(),
  tehsil: z.string().nullable().optional(),
  village: z.string().nullable().optional(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  intent: z.enum(INTENTS).default('UNKNOWN'),
  /** A purpose code from a scheme's eligible_purposes, never free text. */
  purpose: z.string().nullable(),
  project_cost: z.number().min(0).nullable(),
  own_funds_available: z.number().min(0).nullable().optional(),
  education: ApplicantEducationSchema.nullable().optional(),
  documents_available: z.array(z.string()).default([]),
  preferred_language: z.string().default('en'),
  requested_tenure_months: z.number().int().positive().nullable().optional(),
  requested_moratorium_months: z.number().int().min(0).nullable().optional(),
  notes: z.string().nullable().optional(),
});
export type ApplicantProfile = z.infer<typeof ApplicantProfileSchema>;

/* ------------------------------------------------------------------------- */
/* Eligibility                                                               */
/* ------------------------------------------------------------------------- */

export const PREDICATE_CODES = [
  'INCOME_WITHIN_CAP',
  'CATEGORY_SC',
  'CASTE_CERT_AVAILABLE',
  'INCOME_PROOF_AVAILABLE',
  'AGE_WITHIN_RANGE',
  'PROJECT_COST_WITHIN_UNIT_COST',
  'PROJECT_COST_ABOVE_MICRO_FLOOR',
  'PURPOSE_ELIGIBLE',
  'ADMISSION_CONFIRMED',
  'COURSE_ELIGIBLE',
] as const;
export type PredicateCode = (typeof PREDICATE_CODES)[number];

/**
 * `evaluable: false` is the honest third state: we could not decide because a
 * scheme parameter or an applicant field was missing. Collapsing it into
 * `passed: false` would tell an applicant they are ineligible when in truth we
 * do not know — which is exactly the failure mode this project exists to avoid.
 */
export interface Verdict {
  code: PredicateCode;
  passed: boolean;
  evaluable: boolean;
  actual: number | string | boolean | null;
  required: number | string | boolean | string[] | null;
  messageKey: string;
  /** Dotted paths of the data that was absent, e.g. ['scheme.margin_pct']. */
  missing?: string[];
}

export const SCHEME_STATUSES = ['ELIGIBLE', 'NOT_ELIGIBLE', 'INDETERMINATE'] as const;
export type SchemeStatus = (typeof SCHEME_STATUSES)[number];

export const REMEDIATION_KINDS = [
  'REDUCE_NUMERIC',
  'INCREASE_NUMERIC',
  'OBTAIN_DOCUMENT',
  'CHANGE_CATEGORICAL',
  'PROVIDE_DATA',
  /** Nothing the applicant can do — we are waiting on a guideline value. */
  'AWAIT_GUIDELINE',
  'NOT_REMEDIABLE',
] as const;
export type RemediationKind = (typeof REMEDIATION_KINDS)[number];

export interface Remediation {
  code: PredicateCode;
  kind: RemediationKind;
  messageKey: string;
  /** Signed amount of change needed, in rupees or years, for numeric predicates. */
  delta?: number;
  target?: number | string | boolean | null;
  alternatives?: string[];
}

/* ------------------------------------------------------------------------- */
/* Finance                                                                   */
/* ------------------------------------------------------------------------- */

export type SchedulePhase = 'MORATORIUM' | 'REPAYMENT';

export interface ScheduleRow {
  month: number;
  phase: SchedulePhase;
  opening_balance: number;
  payment: number;
  interest: number;
  principal: number;
  closing_balance: number;
}

export interface AmortisationTotals {
  /** Interest paid during the moratorium. Non-zero only for SERVICED. */
  moratorium_interest_serviced: number;
  /** Interest added to principal during the moratorium. Non-zero only for CAPITALISED. */
  moratorium_interest_capitalised: number;
  principal_repaid: number;
  interest_during_repayment: number;
  total_interest: number;
  total_outflow: number;
}

/**
 * Unrounded companion to AmortisationTotals.
 *
 * `totals` sums the rounded schedule rows — that is what the user sees and it
 * always adds up. `exact` is the same quantities straight from the formula, and
 * it is what the golden tests assert, so a rounding change can never silently
 * mask an arithmetic change.
 */
export interface AmortisationExact {
  emi: number;
  /** P·((1+r)^m − 1) for CAPITALISED, P·r·m for SERVICED, 0 for WAIVED. */
  moratorium_interest: number;
  total_outflow: number;
  total_interest: number;
}

export interface AmortisationResult {
  principal: number;
  /** P' — equals principal except under CAPITALISED, where it is P·(1+r)^m. */
  amortised_principal: number;
  monthly_rate: number;
  annual_rate_pct: number;
  moratorium_months: number;
  repayment_months: number;
  treatment: MoratoriumTreatment;
  /** Rounded per src/core/finance/rounding.ts. This is the figure shown to the user. */
  emi: number;
  /** Unrounded, kept so tests can assert the formula to the paisa. */
  emi_exact: number;
  moratorium_monthly_payment: number;
  rows: ScheduleRow[];
  totals: AmortisationTotals;
  exact: AmortisationExact;
}

/** Which of the three caps actually determined the loan. Explainability, and cheap. */
export const BINDING_CONSTRAINTS = ['GROSS', 'MAX_LOAN', 'LOAN_PCT_CAP'] as const;
export type BindingConstraint = (typeof BINDING_CONSTRAINTS)[number];

export interface LoanFigures {
  computable: true;
  project_cost: number;
  /** min(project_cost, max_unit_cost) — step 1 of ROADMAP §8.1. */
  eligible_cost: number;
  max_unit_cost_applied: number;
  cost_ceiling_source: 'SCHEME' | 'PURPOSE_RULE';
  subsidy: number;
  subsidy_timing: SubsidyTiming;
  margin_pct: number;
  own_contribution: number;
  gross_loan: number;
  loan: number;
  binding_constraint: BindingConstraint;
  /** True when the computed loan falls below the scheme's own min_loan. */
  loan_below_min: boolean;
  min_loan: number | null;
  annual_rate_pct: number;
  rate_provenance: FieldProvenance;
  moratorium_months: number;
  repayment_months: number;
  tenure_months_total: number;
  schedule: AmortisationResult;
}

export interface LoanNotComputable {
  computable: false;
  /** Dotted paths of every parameter needed and absent. This drives VERIFY.md. */
  missing: string[];
}

export type LoanComputation = LoanFigures | LoanNotComputable;

/* ------------------------------------------------------------------------- */
/* Partners                                                                  */
/* ------------------------------------------------------------------------- */

export interface Partner {
  code: string;
  name: string;
  type: PartnerType;
  state: string;
  district: string;
  address: string;
  lat: number;
  lng: number;
  contact_phone: string | null;
  contact_email: string | null;
  handles_scheme_types: SchemeType[];
  min_ticket: number | null;
  max_ticket: number | null;
  languages: string[];
  jurisdiction_states: string[];
  provenance: FieldProvenance;
}

export interface PartnerHealthRecord {
  partner_code: string;
  as_of: string;
  funds_sanctioned: number;
  funds_utilised: number;
  overdue_amount: number;
  npa_pct: number;
  avg_processing_days: number;
  capacity_flag: CapacityFlag;
  /** Non-nullable. Every UI surface that reads a health figure reads this too. */
  data_origin: DataOrigin;
}

export interface HealthFactor {
  key: 'fund_availability' | 'npa' | 'overdue' | 'speed';
  raw: number;
  normalised: number;
  weight: number;
  contribution: number;
  rationaleKey: string;
}

export interface HealthScore {
  /** 0..1 after the capacity multiplier. */
  score: number;
  /** 0..1 before the capacity multiplier. */
  raw_score: number;
  capacity_flag: CapacityFlag;
  capacity_multiplier: number;
  factors: HealthFactor[];
  data_origin: DataOrigin;
  as_of: string;
}

export const PARTNER_FILTER_CODES = [
  'DOES_NOT_HANDLE_SCHEME_TYPE',
  'PARTNER_TYPE_NOT_ALLOWED_BY_SCHEME',
  'LOAN_BELOW_MIN_TICKET',
  'LOAN_ABOVE_MAX_TICKET',
  'OUTSIDE_JURISDICTION',
] as const;
export type PartnerFilterCode = (typeof PARTNER_FILTER_CODES)[number];

export interface PartnerExclusionReason {
  code: PartnerFilterCode;
  messageKey: string;
  actual: number | string | null;
  required: number | string | string[] | null;
}

export interface PartnerMatch {
  partner: Partner;
  /** Null when the applicant's coordinates are unknown. Never guessed. */
  distance_km: number | null;
  health: HealthScore | null;
}

export interface PartnerExclusion {
  partner: Partner;
  reasons: PartnerExclusionReason[];
}

export interface PartnerMatchResult {
  /** Survivors of the hard filters, in no particular order. */
  eligible: PartnerMatch[];
  /** Kept, like failing verdicts, because "why is my bank not listed" is a real question. */
  excluded: PartnerExclusion[];
  ranked_by_distance: PartnerMatch[];
  ranked_by_health: PartnerMatch[];
  /** True when the loan is above every partner's max_ticket in the registry. */
  loan_exceeds_all_tickets: boolean;
}

/* ------------------------------------------------------------------------- */
/* Documents                                                                 */
/* ------------------------------------------------------------------------- */

export interface DocumentDefinition {
  code: string;
  name_key: string;
  where_to_obtain_key: string;
  provenance: FieldProvenance;
}

export interface DocumentRequirement {
  scheme_code: string;
  /** '*' means the requirement holds whichever partner class processes the file. */
  partner_type: PartnerType | '*';
  doc_code: string;
  mandatory: boolean;
  notes_key: string | null;
}

export interface ChecklistItem {
  doc_code: string;
  name_key: string;
  where_to_obtain_key: string;
  notes_key: string | null;
  mandatory: boolean;
  status: 'HAVE' | 'MISSING';
  required_by: 'SCHEME' | 'PARTNER_TYPE' | 'BOTH';
  provenance: FieldProvenance;
}

export interface DocumentChecklist {
  scheme_code: string;
  partner_type: PartnerType | null;
  items: ChecklistItem[];
  mandatory_total: number;
  mandatory_missing: number;
  ready: boolean;
}

/* ------------------------------------------------------------------------- */
/* The engine's output                                                       */
/* ------------------------------------------------------------------------- */

export interface SchemeRecommendation {
  scheme_code: string;
  scheme_type: SchemeType;
  scheme_name_i18n: Record<string, string>;
  description_key: string;
  status: SchemeStatus;
  verdicts: Verdict[];
  /** One per failing or unevaluable verdict. Differentiator A. */
  remediations: Remediation[];
  /** Computed only when status is ELIGIBLE. Null otherwise — we never quote an EMI for a scheme you cannot have. */
  computation: LoanComputation | null;
  partners: PartnerMatchResult | null;
  checklist: DocumentChecklist | null;
  scheme_verified: boolean;
}

export interface DatasetLabel {
  label: string;
  figures_authoritative: boolean;
  overlay_applied: boolean;
  notes: string[];
}

export interface RecommendationResult {
  applicant: ApplicantProfile;
  dataset: DatasetLabel;
  /** Every scheme, passing and failing. CLAUDE.md hard rule 4. */
  schemes: SchemeRecommendation[];
  recommended_scheme_code: string | null;
  /** Supplied by the caller. The core never reads the clock. */
  generated_at: string;
}

/* ------------------------------------------------------------------------- */
/* Zod schemas for the seed files                                            */
/* ------------------------------------------------------------------------- */

const provenancedNumber = z.object({
  value: z.number().nullable(),
  source: z.string(),
  note: z.string().optional(),
});

const provenancedString = z.object({
  value: z.string().nullable(),
  source: z.string(),
  note: z.string().optional(),
});

const provenancedStringArray = z.object({
  value: z.array(z.string()),
  source: z.string(),
  note: z.string().optional(),
});

const provenancedBoolean = z.object({
  value: z.boolean().nullable(),
  source: z.string(),
  note: z.string().optional(),
});

export const RawSchemeSchema = z.object({
  code: z.string(),
  type: z.enum(SCHEME_TYPES),
  name_i18n: z.record(z.string(), z.string()),
  description_key: z.string(),
  max_unit_cost: provenancedNumber,
  max_loan: provenancedNumber,
  min_loan: provenancedNumber,
  min_project_cost: provenancedNumber,
  loan_pct_cap: provenancedNumber,
  margin_pct: provenancedNumber,
  subsidy_pct: provenancedNumber,
  subsidy_cap: provenancedNumber,
  subsidy_timing: provenancedString,
  moratorium_months_min: provenancedNumber,
  moratorium_months_max: provenancedNumber,
  moratorium_interest_treatment: provenancedString,
  tenure_months_max: provenancedNumber,
  tenure_includes_moratorium: provenancedBoolean,
  eligible_purposes: provenancedStringArray,
  allowed_partner_types: provenancedStringArray,
  predicates: z.array(z.enum(PREDICATE_CODES)),
  required_documents: z.array(z.string()),
  interest_rules: z.array(
    z.object({
      applies_when: z.record(z.string(), z.unknown()),
      annual_rate_pct: z.number().nullable(),
      source: z.string(),
      note: z.string().optional(),
    }),
  ),
  cost_ceiling_rules: z.array(
    z.object({
      applies_when: z.record(z.string(), z.unknown()),
      max_unit_cost: z.number().nullable(),
      max_loan: z.number().nullable(),
      source: z.string(),
      note: z.string().optional(),
    }),
  ),
  source_url: z.string().nullable(),
  source_date: z.string().nullable(),
  verified: z.boolean(),
});

export const RawPartnerSchema = z.object({
  code: z.string(),
  name: z.string(),
  type: z.enum(PARTNER_TYPES),
  state: z.string(),
  district: z.string(),
  address: z.string(),
  lat: z.number(),
  lng: z.number(),
  contact_phone: z.string().nullable(),
  contact_email: z.string().nullable(),
  handles_scheme_types: z.array(z.enum(SCHEME_TYPES)),
  min_ticket: z.number().nullable(),
  max_ticket: z.number().nullable(),
  languages: z.array(z.string()),
  jurisdiction_states: z.array(z.string()),
  geocode_source: z.string().optional(),
  data_origin: z.string().optional(),
  source: z.string(),
  verified: z.boolean(),
});

export const RawHealthRowSchema = z.object({
  partner_code: z.string(),
  funds_sanctioned: z.number(),
  funds_utilised: z.number(),
  overdue_amount: z.number(),
  npa_pct: z.number(),
  avg_processing_days: z.number(),
  capacity_flag: z.enum(CAPACITY_FLAGS),
  /** Deliberately required with no default. A health row without an origin must not parse. */
  data_origin: z.enum(DATA_ORIGINS),
});
