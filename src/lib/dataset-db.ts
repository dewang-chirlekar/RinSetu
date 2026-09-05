/**
 * src/lib/dataset-db.ts
 *
 * The database mirror of src/lib/dataset.ts. Lives OUTSIDE src/core/ for the
 * same reason the JSON loader does: the core takes plain objects, so it is
 * correct independent of where they came from. This file is the boundary where
 * Postgres rows become typed objects.
 *
 * It is the exact reverse of prisma/seed.ts — seed writes the loader's output
 * into Postgres, this reads it back into the same SchemeSpec / Partner /
 * PartnerHealthRecord that src/lib/dataset.ts produces. The two must stay in
 * lockstep, which is why tests/dataset-db.parity.test.ts exists.
 *
 * Three guarantees, same as src/lib/dataset.ts:
 *
 *   1. `verified` is DERIVED from provenance via isCitable(), never read from a
 *      column (there is no such column — prisma/schema.prisma header rule 2).
 *   2. `figures_authoritative` is false whenever any provenance is non-citable
 *      OR any row carries `demo_overlay` — two independent reasons, belt and
 *      braces.
 *   3. No import from src/core/ reaches into Prisma and no import from src/core/
 *      reaches into this file. The boundary check enforces it.
 */

import { PrismaClient } from '@prisma/client';
import {
  isCitable,
  PROVENANCE_SOURCES,
  type CostCeilingRule,
  type DocumentDefinition,
  type DocumentRequirement,
  type FieldProvenance,
  type GlobalEligibility,
  type InterestRule,
  type Partner,
  type PartnerHealthRecord,
  type PartnerType,
  type ProvenanceSource,
  type SchemeDataset,
  type SchemeSpec,
  type SchemeType,
  type SocialCategory,
} from '@/core/types';
import { assertWeightsSumToOne, type HealthScoringConfig } from '@/core/partners/health';

import healthScoringJson from '../../data/health-scoring.json';

/* ------------------------------------------------------------------------- */
/* Provenance helpers — same derivation as src/lib/dataset.ts                */
/* ------------------------------------------------------------------------- */

function toSource(raw: string): ProvenanceSource {
  const found = PROVENANCE_SOURCES.find((c) => c === raw);
  if (!found) {
    throw new Error(`Unknown provenance source '${raw}' in database. Fix the row or add it to PROVENANCE_SOURCES.`);
  }
  return found;
}

function asProvenanceMap(value: unknown): Record<string, FieldProvenance> {
  const raw = value as Record<string, unknown>;
  const out: Record<string, FieldProvenance> = {};
  for (const [key, entry] of Object.entries(raw ?? {})) {
    const e = entry as { source: string; verified: boolean; note?: string | null };
    const source = toSource(e.source);
    out[key] = { source, verified: isCitable(source), note: e.note ?? null };
  }
  return out;
}

function asFieldProvenance(value: unknown): FieldProvenance {
  const e = value as { source: string; verified?: boolean; note?: string | null };
  const source = toSource(e.source);
  return { source, verified: isCitable(source), note: e.note ?? null };
}

/* ------------------------------------------------------------------------- */
/* Narrowing — Prisma enums are same strings as core, but Prisma generates
/* its own enum types, so we cast via string check rather than importing them. */
/* ------------------------------------------------------------------------- */

function asSchemeType(value: string): SchemeType {
  if (value === 'MICRO' || value === 'TERM' || value === 'EDUCATION') return value;
  throw new Error(`Unknown SchemeType '${value}' in database.`);
}

function asSocialCategory(value: string | null): SocialCategory | null {
  if (value == null) return null;
  if (value === 'SC' || value === 'ST' || value === 'OBC' || value === 'GENERAL' || value === 'UNKNOWN') return value as SocialCategory;
  throw new Error(`Unknown category_requirement '${value}' in database.`);
}

/* ------------------------------------------------------------------------- */
/* Row mappers                                                              */
/* ------------------------------------------------------------------------- */

type SchemeRow = {
  code: string;
  type: string;
  nameI18n: unknown;
  descriptionKey: string;
  maxUnitCost: number | null;
  maxLoan: number | null;
  minLoan: number | null;
  minProjectCost: number | null;
  loanPctCap: number | null;
  marginPct: number | null;
  subsidyPct: number | null;
  subsidyCap: number | null;
  subsidyTiming: string | null;
  moratoriumMonthsMin: number | null;
  moratoriumMonthsMax: number | null;
  moratoriumMonthsDefault: number | null;
  moratoriumTreatment: string | null;
  tenureMonthsMax: number | null;
  tenureIncludesMoratorium: boolean | null;
  eligiblePurposes: string[];
  allowedPartnerTypes: string[];
  predicates: string[];
  provenance: unknown;
  sourceUrl: string | null;
  sourceDate: string | null;
};

type InterestRow = {
  loanBandMin: number | null;
  loanBandMax: number | null;
  purpose: string | null;
  gender: string | null;
  annualRatePct: number | null;
  provenance: unknown;
  ordinal: number;
};

type CeilingRow = {
  purpose: string | null;
  maxUnitCost: number | null;
  maxLoan: number | null;
  provenance: unknown;
  ordinal: number;
};

function mapScheme(
  row: SchemeRow,
  interestRows: InterestRow[],
  ceilingRows: CeilingRow[],
): SchemeSpec {
  const provenance = asProvenanceMap(row.provenance);
  const verified = Object.values(provenance).every((e) => e.verified);

  const interest_rules: InterestRule[] = interestRows
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((r) => ({
      applies_when: {
        loan_band_min: r.loanBandMin,
        loan_band_max: r.loanBandMax,
        purpose: r.purpose,
        gender: r.gender as InterestRule['applies_when']['gender'],
      },
      annual_rate_pct: r.annualRatePct,
      provenance: asFieldProvenance(r.provenance),
    }));

  const cost_ceiling_rules: CostCeilingRule[] = ceilingRows
    .sort((a, b) => a.ordinal - b.ordinal)
    .map((r) => ({
      applies_when: { purpose: r.purpose },
      max_unit_cost: r.maxUnitCost,
      max_loan: r.maxLoan,
      provenance: asFieldProvenance(r.provenance),
    }));

  return {
    code: row.code,
    type: asSchemeType(row.type),
    name_i18n: row.nameI18n as Record<string, string>,
    description_key: row.descriptionKey,
    max_unit_cost: row.maxUnitCost,
    max_loan: row.maxLoan,
    min_loan: row.minLoan,
    min_project_cost: row.minProjectCost,
    loan_pct_cap: row.loanPctCap,
    margin_pct: row.marginPct,
    subsidy_pct: row.subsidyPct,
    subsidy_cap: row.subsidyCap,
    subsidy_timing: row.subsidyTiming as SchemeSpec['subsidy_timing'],
    moratorium_months_min: row.moratoriumMonthsMin,
    moratorium_months_max: row.moratoriumMonthsMax,
    moratorium_months_default: row.moratoriumMonthsDefault,
    moratorium_interest_treatment: row.moratoriumTreatment as SchemeSpec['moratorium_interest_treatment'],
    tenure_months_max: row.tenureMonthsMax,
    tenure_includes_moratorium: row.tenureIncludesMoratorium,
    eligible_purposes: row.eligiblePurposes,
    allowed_partner_types: row.allowedPartnerTypes as PartnerType[],
    predicates: row.predicates as SchemeSpec['predicates'],
    required_documents: [], // populated via DocumentReq join in loadDocumentsFromDb
    interest_rules,
    cost_ceiling_rules,
    provenance,
    source_url: row.sourceUrl,
    source_date: row.sourceDate,
    verified,
  };
}

/* ------------------------------------------------------------------------- */
/* Public loaders — async, caller supplies the PrismaClient                  */
/* ------------------------------------------------------------------------- */

export async function loadSchemeDatasetFromDb(db: PrismaClient): Promise<SchemeDataset> {
  const schemesRaw = await db.scheme.findMany({
    include: {
      interestRules: { orderBy: { ordinal: 'asc' } },
      costCeilingRules: { orderBy: { ordinal: 'asc' } },
    },
  });

  const globalRaw = await db.globalEligibility.findUnique({ where: { id: 1 } });
  if (!globalRaw) throw new Error('global_eligibility row missing (id=1). Run `npm run seed`.');

  const globalProvenance = asProvenanceMap(globalRaw.provenance);
  const global: GlobalEligibility = {
    annual_family_income_cap: globalRaw.annualFamilyIncomeCap,
    category_requirement: asSocialCategory(globalRaw.categoryRequirement),
    age_min: globalRaw.ageMin,
    age_max: globalRaw.ageMax,
    provenance: globalProvenance,
    verified: Object.values(globalProvenance).every((e) => e.verified),
  };

  const schemes: SchemeSpec[] = schemesRaw.map((row) =>
    mapScheme(
      row as unknown as SchemeRow,
      (row as unknown as { interestRules: InterestRow[] }).interestRules,
      (row as unknown as { costCeilingRules: CeilingRow[] }).costCeilingRules,
    ),
  );

  // Re-attach required_documents via DocumentReq (scheme -> doc_code list)
  const allReqs = await db.documentReq.findMany();
  const reqsByScheme = new Map<string, string[]>();
  for (const req of allReqs) {
    const list = reqsByScheme.get(req.schemeCode) ?? [];
    list.push(req.docCode);
    reqsByScheme.set(req.schemeCode, list);
  }
  for (const scheme of schemes) {
    scheme.required_documents = reqsByScheme.get(scheme.code) ?? [];
  }

  const allProvenance = [
    ...schemes.flatMap((s) => Object.values(s.provenance)),
    ...schemes.flatMap((s) => s.interest_rules.map((r) => r.provenance)),
    ...schemes.flatMap((s) => s.cost_ceiling_rules.map((r) => r.provenance)),
    ...Object.values(globalProvenance),
  ];
  const hasOverlay = allProvenance.some((p) => p.source === 'demo_overlay');
  const nonCitable = allProvenance.filter((p) => !p.verified);
  let figuresAuthoritative = nonCitable.length === 0;
  const notes: string[] = [];
  if (hasOverlay) {
    figuresAuthoritative = false;
    notes.push('dataset.note.demo_overlay_applied');
  }
  if (nonCitable.length > 0) notes.push('dataset.note.unverified_figures_present');
  const label = hasOverlay ? 'dataset.label.seed_plus_demo_overlay' : 'dataset.label.seed_only';

  return { schemes, global, label, figures_authoritative: figuresAuthoritative, overlay_applied: hasOverlay, notes };
}

export async function loadPartnersFromDb(db: PrismaClient): Promise<Partner[]> {
  const rows = await db.partner.findMany({ orderBy: { code: 'asc' } });
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    type: row.type as PartnerType,
    state: row.state,
    district: row.district,
    address: row.address,
    lat: row.lat,
    lng: row.lng,
    contact_phone: row.contactPhone,
    contact_email: row.contactEmail,
    handles_scheme_types: row.handlesSchemeTypes as Partner['handles_scheme_types'],
    min_ticket: row.minTicket,
    max_ticket: row.maxTicket,
    languages: row.languages,
    jurisdiction_states: row.jurisdictionStates,
    provenance: {
      source: row.provenanceSource as ProvenanceSource,
      verified: isCitable(row.provenanceSource as ProvenanceSource),
      note: row.provenanceNote ?? null,
    },
  }));
}

export async function loadHealthMapFromDb(db: PrismaClient): Promise<Map<string, PartnerHealthRecord>> {
  // Latest row per partner (as_of is ISO date string, lexical sort == chronological)
  const rows = await db.partnerHealth.findMany({ orderBy: [{ partnerCode: 'asc' }, { asOf: 'desc' }] });
  const map = new Map<string, PartnerHealthRecord>();
  for (const row of rows) {
    if (!map.has(row.partnerCode)) {
      map.set(row.partnerCode, {
        partner_code: row.partnerCode,
        as_of: row.asOf,
        funds_sanctioned: row.fundsSanctioned,
        funds_utilised: row.fundsUtilised,
        overdue_amount: row.overdueAmount,
        npa_pct: row.npaPct,
        avg_processing_days: row.avgProcessingDays,
        capacity_flag: row.capacityFlag as PartnerHealthRecord['capacity_flag'],
        data_origin: row.dataOrigin as PartnerHealthRecord['data_origin'],
      });
    }
  }
  return map;
}

export async function loadDocumentsFromDb(
  db: PrismaClient,
): Promise<{ definitions: DocumentDefinition[]; requirements: DocumentRequirement[] }> {
  const defs = await db.documentDef.findMany({ orderBy: { code: 'asc' } });
  const reqs = await db.documentReq.findMany({ orderBy: [{ schemeCode: 'asc' }, { docCode: 'asc' }] });

  const definitions: DocumentDefinition[] = defs.map((row) => ({
    code: row.code,
    name_key: row.nameKey,
    where_to_obtain_key: row.whereToObtainKey,
    provenance: {
      source: row.provenanceSource as ProvenanceSource,
      verified: isCitable(row.provenanceSource as ProvenanceSource),
      note: row.provenanceNote ?? null,
    },
  }));

  const requirements: DocumentRequirement[] = reqs.map((row) => ({
    scheme_code: row.schemeCode,
    partner_type: (row.partnerType ?? '*') as DocumentRequirement['partner_type'],
    doc_code: row.docCode,
    mandatory: row.mandatory,
    notes_key: row.notesKey,
  }));

  return { definitions, requirements };
}

export function loadHealthConfigFromDb(): HealthScoringConfig {
  // Not stored in Postgres — same JSON as the JSON loader, so parity holds.
  const config: HealthScoringConfig = {
    weights: healthScoringJson.weights,
    normalisation: healthScoringJson.normalisation,
    capacity_multipliers: healthScoringJson.capacity_multipliers,
    weight_rationale_keys: healthScoringJson.weight_rationale_keys,
  };
  assertWeightsSumToOne(config.weights);
  return config;
}

export interface DbBundle {
  dataset: SchemeDataset;
  partners: Partner[];
  health: Map<string, PartnerHealthRecord>;
  healthConfig: HealthScoringConfig;
  documentDefinitions: DocumentDefinition[];
  documentRequirements: DocumentRequirement[];
}

export async function loadBundleFromDb(db: PrismaClient): Promise<DbBundle> {
  const [dataset, partners, health, docs] = await Promise.all([
    loadSchemeDatasetFromDb(db),
    loadPartnersFromDb(db),
    loadHealthMapFromDb(db),
    loadDocumentsFromDb(db),
  ]);
  return {
    dataset,
    partners,
    health,
    healthConfig: loadHealthConfigFromDb(),
    documentDefinitions: docs.definitions,
    documentRequirements: docs.requirements,
  };
}
