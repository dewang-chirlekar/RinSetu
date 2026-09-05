/**
 * src/lib/dataset.ts
 *
 * The only place JSON becomes typed objects. Lives OUTSIDE src/core/ on purpose:
 * the core takes SchemeSpec[], Partner[] and the rest as arguments, so it is
 * provably correct independent of the figures. This file is the boundary where
 * untrusted data is validated and where provenance is derived.
 *
 * Three things it guarantees, and they are the honesty guarantees of the whole
 * project:
 *
 *   1. `verified` is DERIVED from the source via isCitable(), never copied from
 *      the JSON. A seed file cannot promote its own figures by setting a flag.
 *
 *   2. `figures_authoritative` is true only when every figure in play comes from
 *      a citable source. Today that is false for all three schemes, and it will
 *      stay false until the guidelines are transcribed. It cannot be forced.
 *
 *   3. Applying data/schemes.demo-overlay.json marks the dataset non-authoritative
 *      unconditionally, in addition to (2). Two independent reasons for the same
 *      answer, because this is the one thing that must not silently fail.
 */

import {
  RawHealthRowSchema,
  RawPartnerSchema,
  RawSchemeSchema,
  isCitable,
  ApplicantProfileSchema,
  MORATORIUM_TREATMENTS,
  PARTNER_TYPES,
  PROVENANCE_SOURCES,
  SOCIAL_CATEGORIES,
  SUBSIDY_TIMINGS,
  type ApplicantProfile,
  type CostCeilingRule,
  type DocumentDefinition,
  type DocumentRequirement,
  type FieldProvenance,
  type GlobalEligibility,
  type InterestRule,
  type MoratoriumTreatment,
  type Partner,
  type PartnerHealthRecord,
  type PartnerType,
  type ProvenanceSource,
  type SchemeDataset,
  type SchemeSpec,
  type SocialCategory,
  type SubsidyTiming,
} from '@/core/types';
import { assertWeightsSumToOne, type HealthScoringConfig } from '@/core/partners/health';

import schemesSeedJson from '../../data/schemes.seed.json';
import demoOverlayJson from '../../data/schemes.demo-overlay.json';
import partnersSeedJson from '../../data/partners.seed.json';
import healthSimJson from '../../data/partner-health.sim.json';
import healthScoringJson from '../../data/health-scoring.json';
import documentsSeedJson from '../../data/documents.seed.json';
import personasJson from '../../data/personas.fixtures.json';

/* ------------------------------------------------------------------------- */
/* Provenance plumbing                                                       */
/* ------------------------------------------------------------------------- */

function toSource(raw: string): ProvenanceSource {
  const found = PROVENANCE_SOURCES.find((candidate) => candidate === raw);
  if (!found) {
    // An unrecognised source string is a data error, not a shrug. Silently
    // mapping it to 'placeholder' would let a typo hide a real citation, and
    // mapping it to 'official_guideline' would be a fabricated citation.
    throw new Error(
      `Unknown provenance source '${raw}'. Add it to PROVENANCE_SOURCES in src/core/types.ts or fix the data file.`,
    );
  }
  return found;
}

/** `verified` is derived here and nowhere else. */
function prov(rawSource: string, note?: string | null): FieldProvenance {
  const source = toSource(rawSource);
  return { source, verified: isCitable(source), note: note ?? null };
}

interface RawValue<T> {
  value: T | null;
  source: string;
  note?: string;
}

/**
 * Resolve one field: the seed wins whenever it has a value; the overlay fills
 * only genuine nulls. The overlay can never overwrite a real figure — that
 * direction of precedence is what keeps the seed the single source of truth.
 */
function resolveField<T>(
  raw: RawValue<T>,
  overlayValue: T | null | undefined,
): { value: T | null; provenance: FieldProvenance; overlayUsed: boolean } {
  if (raw.value !== null && raw.value !== undefined) {
    return { value: raw.value, provenance: prov(raw.source, raw.note), overlayUsed: false };
  }
  if (overlayValue !== null && overlayValue !== undefined) {
    return {
      value: overlayValue,
      provenance: prov('demo_overlay', 'Filled by data/schemes.demo-overlay.json. Not a real figure.'),
      overlayUsed: true,
    };
  }
  return { value: null, provenance: prov(raw.source, raw.note), overlayUsed: false };
}

/* ------------------------------------------------------------------------- */
/* Narrowing helpers for the string-typed enum fields in the seed             */
/* ------------------------------------------------------------------------- */

function asSubsidyTiming(value: string | null): SubsidyTiming | null {
  if (value === null) return null;
  const found = SUBSIDY_TIMINGS.find((candidate) => candidate === value);
  if (!found) throw new Error(`Invalid subsidy_timing '${value}' in data/schemes.seed.json.`);
  return found;
}

function asMoratoriumTreatment(value: string | null): MoratoriumTreatment | null {
  if (value === null) return null;
  const found = MORATORIUM_TREATMENTS.find((candidate) => candidate === value);
  if (!found) {
    throw new Error(`Invalid moratorium_interest_treatment '${value}' in data/schemes.seed.json.`);
  }
  return found;
}

function asPartnerTypes(values: string[]): PartnerType[] {
  return values.map((value) => {
    const found = PARTNER_TYPES.find((candidate) => candidate === value);
    if (!found) throw new Error(`Invalid partner type '${value}' in data/schemes.seed.json.`);
    return found;
  });
}

function asSocialCategory(value: string | null): SocialCategory | null {
  if (value === null) return null;
  const found = SOCIAL_CATEGORIES.find((candidate) => candidate === value);
  if (!found) throw new Error(`Invalid category_requirement '${value}' in data/schemes.seed.json.`);
  return found;
}

/* ------------------------------------------------------------------------- */
/* Overlay shape                                                             */
/* ------------------------------------------------------------------------- */

interface OverlayRule {
  applies_when: Record<string, unknown>;
  annual_rate_pct?: number | null;
  max_unit_cost?: number | null;
  max_loan?: number | null;
}

interface OverlayScheme {
  max_unit_cost?: number;
  max_loan?: number;
  min_loan?: number;
  min_project_cost?: number;
  loan_pct_cap?: number;
  margin_pct?: number;
  subsidy_pct?: number;
  subsidy_cap?: number;
  subsidy_timing?: string;
  moratorium_months_min?: number;
  moratorium_months_max?: number;
  moratorium_months_default?: number;
  moratorium_interest_treatment?: string;
  tenure_months_max?: number;
  tenure_includes_moratorium?: boolean;
  interest_rules?: OverlayRule[];
  cost_ceiling_rules?: OverlayRule[];
}

const OVERLAY_SCHEMES = demoOverlayJson.schemes as unknown as Record<string, OverlayScheme>;
const OVERLAY_GLOBAL = demoOverlayJson.global_eligibility as {
  age_min?: number;
  age_max?: number;
  annual_family_income_cap?: number;
  category_requirement?: string;
};

/* ------------------------------------------------------------------------- */
/* Schemes                                                                   */
/* ------------------------------------------------------------------------- */

export interface LoadSchemeOptions {
  /**
   * Apply data/schemes.demo-overlay.json to fill null parameters.
   *
   * Default true, because with it off the engine can compute nothing and every
   * screen shows "not computable" — which is honest but untestable. Turning it
   * off is the right thing to do the moment real figures land, and
   * tests/dataset.honesty.test.ts asserts both modes.
   */
  applyOverlay?: boolean;
}

function convertInterestRules(
  raw: { applies_when: Record<string, unknown>; annual_rate_pct: number | null; source: string; note?: string }[],
  overlay: OverlayRule[] | undefined,
): { rules: InterestRule[]; overlayUsed: boolean } {
  const seedHasNoRates = raw.length === 0 || raw.every((rule) => rule.annual_rate_pct === null);

  if (seedHasNoRates && overlay && overlay.length > 0) {
    return {
      rules: overlay.map((rule) => ({
        applies_when: rule.applies_when as InterestRule['applies_when'],
        annual_rate_pct: rule.annual_rate_pct ?? null,
        provenance: prov('demo_overlay', 'Arbitrary rate band from the demo overlay.'),
      })),
      overlayUsed: true,
    };
  }

  return {
    rules: raw.map((rule) => ({
      applies_when: rule.applies_when as InterestRule['applies_when'],
      annual_rate_pct: rule.annual_rate_pct,
      provenance: prov(rule.source, rule.note),
    })),
    overlayUsed: false,
  };
}

function convertCeilingRules(
  raw: {
    applies_when: Record<string, unknown>;
    max_unit_cost: number | null;
    max_loan: number | null;
    source: string;
    note?: string;
  }[],
  overlay: OverlayRule[] | undefined,
): { rules: CostCeilingRule[]; overlayUsed: boolean } {
  const seedHasNoValues =
    raw.length === 0 || raw.every((rule) => rule.max_unit_cost === null && rule.max_loan === null);

  if (seedHasNoValues && overlay && overlay.length > 0) {
    return {
      rules: overlay.map((rule) => ({
        applies_when: rule.applies_when as CostCeilingRule['applies_when'],
        max_unit_cost: rule.max_unit_cost ?? null,
        max_loan: rule.max_loan ?? null,
        provenance: prov('demo_overlay', 'Arbitrary purpose ceiling from the demo overlay.'),
      })),
      overlayUsed: true,
    };
  }

  return {
    rules: raw.map((rule) => ({
      applies_when: rule.applies_when as CostCeilingRule['applies_when'],
      max_unit_cost: rule.max_unit_cost,
      max_loan: rule.max_loan,
      provenance: prov(rule.source, rule.note),
    })),
    overlayUsed: false,
  };
}

export function loadSchemeDataset(options: LoadSchemeOptions = {}): SchemeDataset {
  const applyOverlay = options.applyOverlay ?? true;

  let overlayUsedAnywhere = false;
  const notes: string[] = [];

  const schemes: SchemeSpec[] = schemesSeedJson.schemes.map((rawInput) => {
    const raw = RawSchemeSchema.parse(rawInput);
    const overlay = applyOverlay ? (OVERLAY_SCHEMES[raw.code] ?? {}) : {};
    const provenance: Record<string, FieldProvenance> = {};

    function field<T>(name: string, source: RawValue<T>, overlayValue: T | null | undefined): T | null {
      const resolved = resolveField(source, overlayValue);
      provenance[name] = resolved.provenance;
      if (resolved.overlayUsed) overlayUsedAnywhere = true;
      return resolved.value;
    }

    const interest = convertInterestRules(raw.interest_rules, overlay.interest_rules);
    const ceilings = convertCeilingRules(raw.cost_ceiling_rules, overlay.cost_ceiling_rules);
    if (interest.overlayUsed || ceilings.overlayUsed) overlayUsedAnywhere = true;

    provenance.interest_rules = interest.overlayUsed
      ? prov('demo_overlay')
      : prov(raw.interest_rules[0]?.source ?? 'placeholder');
    provenance.cost_ceiling_rules = ceilings.overlayUsed
      ? prov('demo_overlay')
      : prov(raw.cost_ceiling_rules[0]?.source ?? 'placeholder');

    return {
      code: raw.code,
      type: raw.type,
      name_i18n: raw.name_i18n,
      description_key: raw.description_key,

      max_unit_cost: field('max_unit_cost', raw.max_unit_cost, overlay.max_unit_cost),
      max_loan: field('max_loan', raw.max_loan, overlay.max_loan),
      min_loan: field('min_loan', raw.min_loan, overlay.min_loan),
      min_project_cost: field('min_project_cost', raw.min_project_cost, overlay.min_project_cost),
      loan_pct_cap: field('loan_pct_cap', raw.loan_pct_cap, overlay.loan_pct_cap),
      margin_pct: field('margin_pct', raw.margin_pct, overlay.margin_pct),
      subsidy_pct: field('subsidy_pct', raw.subsidy_pct, overlay.subsidy_pct),
      subsidy_cap: field('subsidy_cap', raw.subsidy_cap, overlay.subsidy_cap),
      subsidy_timing: asSubsidyTiming(
        field('subsidy_timing', raw.subsidy_timing, overlay.subsidy_timing),
      ),

      moratorium_months_min: field(
        'moratorium_months_min',
        raw.moratorium_months_min,
        overlay.moratorium_months_min,
      ),
      moratorium_months_max: field(
        'moratorium_months_max',
        raw.moratorium_months_max,
        overlay.moratorium_months_max,
      ),
      // Not in the seed at all: a pre-fill default is a UI convenience, not a
      // guideline parameter, so it exists only where a dataset supplies one.
      moratorium_months_default: field(
        'moratorium_months_default',
        { value: null, source: 'placeholder' },
        overlay.moratorium_months_default,
      ),
      moratorium_interest_treatment: asMoratoriumTreatment(
        field(
          'moratorium_interest_treatment',
          raw.moratorium_interest_treatment,
          overlay.moratorium_interest_treatment,
        ),
      ),

      tenure_months_max: field('tenure_months_max', raw.tenure_months_max, overlay.tenure_months_max),
      tenure_includes_moratorium: field(
        'tenure_includes_moratorium',
        raw.tenure_includes_moratorium,
        overlay.tenure_includes_moratorium,
      ),

      eligible_purposes: raw.eligible_purposes.value,
      allowed_partner_types: asPartnerTypes(raw.allowed_partner_types.value),
      predicates: raw.predicates,
      required_documents: raw.required_documents,

      interest_rules: interest.rules,
      cost_ceiling_rules: ceilings.rules,

      provenance,
      source_url: raw.source_url,
      source_date: raw.source_date,
      verified: Object.values(provenance).every((entry) => entry.verified),
    };
  });

  const rawGlobal = schemesSeedJson.global_eligibility;
  const globalProvenance: Record<string, FieldProvenance> = {};

  function globalField<T>(name: string, source: RawValue<T>, overlayValue: T | null | undefined): T | null {
    const resolved = resolveField(source, overlayValue);
    globalProvenance[name] = resolved.provenance;
    if (resolved.overlayUsed) overlayUsedAnywhere = true;
    return resolved.value;
  }

  const overlayGlobal = applyOverlay ? OVERLAY_GLOBAL : {};
  const global: GlobalEligibility = {
    annual_family_income_cap: globalField(
      'annual_family_income_cap',
      rawGlobal.annual_family_income_cap as RawValue<number>,
      overlayGlobal.annual_family_income_cap,
    ),
    category_requirement: asSocialCategory(
      globalField(
        'category_requirement',
        rawGlobal.category_requirement as RawValue<string>,
        overlayGlobal.category_requirement,
      ),
    ),
    age_min: globalField('age_min', rawGlobal.age_min as RawValue<number>, overlayGlobal.age_min),
    age_max: globalField('age_max', rawGlobal.age_max as RawValue<number>, overlayGlobal.age_max),
    provenance: globalProvenance,
    verified: Object.values(globalProvenance).every((entry) => entry.verified),
  };

  // Authoritative only if EVERY figure in play is citable. Derived, so it cannot
  // drift out of step with the data.
  const allProvenance = [
    ...schemes.flatMap((scheme) => Object.values(scheme.provenance)),
    ...Object.values(globalProvenance),
  ];
  const nonCitable = allProvenance.filter((entry) => !entry.verified);
  let figuresAuthoritative = nonCitable.length === 0;

  if (overlayUsedAnywhere) {
    // Belt and braces. (1) demo_overlay is not citable so the check above already
    // caught it; (2) this line means a future change to isCitable() still cannot
    // make an overlay dataset claim authority.
    figuresAuthoritative = false;
    notes.push('dataset.note.demo_overlay_applied');
  }
  if (nonCitable.length > 0) {
    notes.push('dataset.note.unverified_figures_present');
  }

  const label = overlayUsedAnywhere ? 'dataset.label.seed_plus_demo_overlay' : 'dataset.label.seed_only';

  return {
    schemes,
    global,
    label,
    figures_authoritative: figuresAuthoritative,
    overlay_applied: overlayUsedAnywhere,
    notes,
  };
}

/* ------------------------------------------------------------------------- */
/* Partners, health, documents                                               */
/* ------------------------------------------------------------------------- */

export function loadPartners(): Partner[] {
  return partnersSeedJson.partners.map((rawInput) => {
    const raw = RawPartnerSchema.parse(rawInput);
    return {
      code: raw.code,
      name: raw.name,
      type: raw.type,
      state: raw.state,
      district: raw.district,
      address: raw.address,
      lat: raw.lat,
      lng: raw.lng,
      contact_phone: raw.contact_phone,
      contact_email: raw.contact_email,
      handles_scheme_types: raw.handles_scheme_types,
      min_ticket: raw.min_ticket,
      max_ticket: raw.max_ticket,
      languages: raw.languages,
      jurisdiction_states: raw.jurisdiction_states,
      provenance: prov(raw.source, raw.data_origin ?? null),
    };
  });
}

/**
 * Keyed by partner code. `as_of` comes from the file header and is stamped onto
 * every row, so a health figure can never be rendered without the date it
 * describes.
 */
export function loadHealthMap(): Map<string, PartnerHealthRecord> {
  const asOf = healthSimJson.as_of;
  const map = new Map<string, PartnerHealthRecord>();
  for (const rawInput of healthSimJson.rows) {
    const raw = RawHealthRowSchema.parse(rawInput);
    map.set(raw.partner_code, { ...raw, as_of: asOf });
  }
  return map;
}

export function loadHealthConfig(): HealthScoringConfig {
  const config: HealthScoringConfig = {
    weights: healthScoringJson.weights,
    normalisation: healthScoringJson.normalisation,
    capacity_multipliers: healthScoringJson.capacity_multipliers,
    weight_rationale_keys: healthScoringJson.weight_rationale_keys,
  };
  // Fail at load, not at render: weights that do not sum to 1 distort every
  // ranking in a way nobody would notice by looking at a list.
  assertWeightsSumToOne(config.weights);
  return config;
}

export function loadDocuments(): {
  definitions: DocumentDefinition[];
  requirements: DocumentRequirement[];
} {
  const definitions: DocumentDefinition[] = documentsSeedJson.documents.map((raw) => ({
    code: raw.code,
    name_key: raw.name_key,
    where_to_obtain_key: raw.where_to_obtain_key,
    provenance: prov(raw.source),
  }));

  const requirements: DocumentRequirement[] = documentsSeedJson.requirements.map((raw) => {
    const partnerType =
      raw.partner_type === '*'
        ? ('*' as const)
        : (PARTNER_TYPES.find((candidate) => candidate === raw.partner_type) ??
          (() => {
            throw new Error(
              `Invalid partner_type '${raw.partner_type}' in data/documents.seed.json requirements.`,
            );
          })());
    return {
      scheme_code: raw.scheme_code,
      partner_type: partnerType,
      doc_code: raw.doc_code,
      mandatory: raw.mandatory,
      notes_key: raw.notes_key,
    };
  });

  return { definitions, requirements };
}

/* ------------------------------------------------------------------------- */
/* Personas                                                                  */
/* ------------------------------------------------------------------------- */

export interface Persona {
  id: string;
  label: string;
  tests: string[];
  applicant: ApplicantProfile;
}

export function loadPersonas(): Persona[] {
  return personasJson.personas.map((raw) => ({
    id: raw.id,
    label: raw.label,
    tests: raw.tests,
    // Zod fills the defaults (gender, category, documents_available, language)
    // and rejects anything the form itself would reject, so a bad fixture fails
    // at load rather than producing a mysteriously empty verdict list.
    applicant: ApplicantProfileSchema.parse({ ...raw.applicant, id: raw.id }),
  }));
}

/* ------------------------------------------------------------------------- */
/* One call for everything a request needs                                   */
/* ------------------------------------------------------------------------- */

export interface Bundle {
  dataset: SchemeDataset;
  partners: Partner[];
  health: Map<string, PartnerHealthRecord>;
  healthConfig: HealthScoringConfig;
  documentDefinitions: DocumentDefinition[];
  documentRequirements: DocumentRequirement[];
}

export function loadBundle(options: LoadSchemeOptions = {}): Bundle {
  const documents = loadDocuments();
  return {
    dataset: loadSchemeDataset(options),
    partners: loadPartners(),
    health: loadHealthMap(),
    healthConfig: loadHealthConfig(),
    documentDefinitions: documents.definitions,
    documentRequirements: documents.requirements,
  };
}

/* ------------------------------------------------------------------------- */
/* VERIFY.md support                                                         */
/* ------------------------------------------------------------------------- */

export interface UnverifiedFigure {
  where: string;
  field: string;
  value: string;
  source: ProvenanceSource;
  note: string | null;
}

/**
 * Every figure currently in play that a judge must not be shown as fact.
 * scripts/verify-report.ts turns this into VERIFY.md, so the document cannot
 * drift away from the data.
 */
export function unverifiedFigures(options: LoadSchemeOptions = {}): UnverifiedFigure[] {
  const dataset = loadSchemeDataset(options);
  const out: UnverifiedFigure[] = [];

  for (const [field, entry] of Object.entries(dataset.global.provenance)) {
    if (entry.verified) continue;
    const value = (dataset.global as unknown as Record<string, unknown>)[field];
    out.push({
      where: 'global_eligibility',
      field,
      value: String(value),
      source: entry.source,
      note: entry.note ?? null,
    });
  }

  for (const scheme of dataset.schemes) {
    for (const [field, entry] of Object.entries(scheme.provenance)) {
      if (entry.verified) continue;
      const value = (scheme as unknown as Record<string, unknown>)[field];
      out.push({
        where: `scheme:${scheme.code}`,
        field,
        value: Array.isArray(value) ? `[${value.length} rule(s)]` : String(value),
        source: entry.source,
        note: entry.note ?? null,
      });
    }
  }

  return out;
}
