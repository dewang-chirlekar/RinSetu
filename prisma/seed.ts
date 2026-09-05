/**
 * prisma/seed.ts
 *
 *   npm run seed                    write the scheme master as the seed states it
 *   npm run seed -- --with-overlay  also write the demo overlay's stand-in figures
 *
 * Loads data/*.json through src/lib/dataset.ts — the same loader the engine uses,
 * so the rows in Postgres are the objects the engine has been tested against
 * rather than a second, hand-transcribed interpretation of the same JSON.
 *
 * Two decisions worth knowing before you run it.
 *
 * The demo overlay is off by default. The overlay exists so the engine can be
 * exercised end to end while most guideline figures are still unknown, and its
 * values are stamped `demo_overlay`. Writing it into the scheme master by default
 * would make the database look complete, and a database that looks complete is
 * how an invented margin percentage ends up on a slide. Pass --with-overlay
 * knowingly, for a demo environment.
 *
 * `verified` is not written, because there is no such column. It is derived from
 * the provenance source by isCitable() every time the data is read — see the
 * header of prisma/schema.prisma. The only way to make a figure verified is to
 * transcribe a published guideline into data/schemes.seed.json.
 *
 * The script is idempotent: rows are upserted by natural key, and the two rule
 * tables (which have no natural key) are deleted per scheme and rewritten.
 */

import 'dotenv/config';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, type Prisma } from '@prisma/client';
import {
  loadDocuments,
  loadHealthMap,
  loadPartners,
  loadSchemeDataset,
} from '../src/lib/dataset';
import type { PartnerType, SchemeType } from '../src/core/types';
import { translate } from '../src/messages';

/**
 * Prisma 7 requires a driver adapter — `new PrismaClient()` with no arguments
 * throws at construction. Built inside main(), after the DATABASE_URL check, so
 * that a missing connection string produces the one-line explanation below rather
 * than a Prisma stack trace about adapters.
 *
 * Supabase pooler uses a self-signed chain that Node 24 + pg v8 rejects when
 * sslmode=require is treated as verify-full. Creating the pool with
 * rejectUnauthorized:false keeps the TLS encryption but skips chain verification,
 * which is the documented workaround for Supabase + @prisma/adapter-pg.
 */
function connect(connectionString: string): PrismaClient {
  // Strip sslmode from the URL — pg's query-string sslmode=require is now treated as
  // verify-full and would still reject Supabase's chain even though we explicitly
  // allow it via ssl.rejectUnauthorized. Keep TLS but skip chain verification.
  const clean = connectionString.replace(/[?&]sslmode=[^&]*/g, '').replace(/[?&]$/, '').replace(/\?$/, '');
  const pool = new pg.Pool({
    connectionString: clean,
    ssl: { rejectUnauthorized: false },
  });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

const applyOverlay = process.argv.slice(2).includes('--with-overlay');

/**
 * Prisma's InputJsonValue requires an index signature. FieldProvenance
 * deliberately has none — it is a closed shape, and that closedness is what stops
 * a stray field being written into a provenance record. These values came out of
 * a JSON file and are structurally JSON already, so this widens the type without
 * touching the data.
 */
function json(value: object): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}

/**
 * The seed carries the literal string 'TODO' where a source URL belongs. Storing
 * that verbatim would leave a column that looks like a citation and is not one.
 */
function citationOrNull(value: string | null): string | null {
  if (value === null) return null;
  const trimmed = value.trim();
  if (trimmed === '' || trimmed === 'TODO' || trimmed.startsWith('TODO(')) return null;
  return trimmed;
}

/** Prisma's SchemeType enum spells the education scheme EDUCATION, as does the core. */
function schemeType(value: SchemeType) {
  return value;
}

async function seedGlobalEligibility(db: PrismaClient, dataset: ReturnType<typeof loadSchemeDataset>) {
  const { global } = dataset;
  await db.globalEligibility.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      annualFamilyIncomeCap: global.annual_family_income_cap,
      categoryRequirement: global.category_requirement,
      ageMin: global.age_min,
      ageMax: global.age_max,
      provenance: json(global.provenance),
    },
    update: {
      annualFamilyIncomeCap: global.annual_family_income_cap,
      categoryRequirement: global.category_requirement,
      ageMin: global.age_min,
      ageMax: global.age_max,
      provenance: json(global.provenance),
    },
  });
}

async function seedSchemes(db: PrismaClient, dataset: ReturnType<typeof loadSchemeDataset>) {
  for (const scheme of dataset.schemes) {
    const fields = {
      type: schemeType(scheme.type),
      nameI18n: json(scheme.name_i18n),
      descriptionKey: scheme.description_key,

      maxUnitCost: scheme.max_unit_cost,
      maxLoan: scheme.max_loan,
      minLoan: scheme.min_loan,
      minProjectCost: scheme.min_project_cost,

      loanPctCap: scheme.loan_pct_cap,
      marginPct: scheme.margin_pct,
      subsidyPct: scheme.subsidy_pct,
      subsidyCap: scheme.subsidy_cap,
      subsidyTiming: scheme.subsidy_timing,

      moratoriumMonthsMin: scheme.moratorium_months_min,
      moratoriumMonthsMax: scheme.moratorium_months_max,
      moratoriumMonthsDefault: scheme.moratorium_months_default,
      moratoriumTreatment: scheme.moratorium_interest_treatment,

      tenureMonthsMax: scheme.tenure_months_max,
      tenureIncludesMoratorium: scheme.tenure_includes_moratorium,

      eligiblePurposes: scheme.eligible_purposes,
      allowedPartnerTypes: scheme.allowed_partner_types,
      predicates: scheme.predicates,

      provenance: json(scheme.provenance),
      sourceUrl: citationOrNull(scheme.source_url),
      sourceDate: citationOrNull(scheme.source_date),
    };

    await db.scheme.upsert({
      where: { code: scheme.code },
      create: { code: scheme.code, ...fields },
      update: fields,
    });

    // No natural key on either rule table — a rate band is identified by its
    // conditions, and those are exactly what an edit changes. Replacing the set
    // is the only way to keep a re-run from accumulating stale bands.
    await db.interestRule.deleteMany({ where: { schemeCode: scheme.code } });
    await db.interestRule.createMany({
      data: scheme.interest_rules.map((rule, ordinal) => ({
        schemeCode: scheme.code,
        loanBandMin: rule.applies_when.loan_band_min ?? null,
        loanBandMax: rule.applies_when.loan_band_max ?? null,
        purpose: rule.applies_when.purpose ?? null,
        gender: rule.applies_when.gender ?? null,
        annualRatePct: rule.annual_rate_pct,
        provenance: json(rule.provenance),
        ordinal,
      })),
    });

    await db.costCeilingRule.deleteMany({ where: { schemeCode: scheme.code } });
    await db.costCeilingRule.createMany({
      data: scheme.cost_ceiling_rules.map((rule, ordinal) => ({
        schemeCode: scheme.code,
        purpose: rule.applies_when.purpose ?? null,
        maxUnitCost: rule.max_unit_cost,
        maxLoan: rule.max_loan,
        provenance: json(rule.provenance),
        ordinal,
      })),
    });
  }
}

async function seedPartners(db: PrismaClient) {
  const partners = loadPartners();
  for (const partner of partners) {
    const fields = {
      name: partner.name,
      type: partner.type,
      state: partner.state,
      district: partner.district,
      address: partner.address,
      lat: partner.lat,
      lng: partner.lng,
      contactPhone: partner.contact_phone,
      contactEmail: partner.contact_email,
      handlesSchemeTypes: partner.handles_scheme_types,
      minTicket: partner.min_ticket,
      maxTicket: partner.max_ticket,
      languages: partner.languages,
      jurisdictionStates: partner.jurisdiction_states,
      provenanceSource: partner.provenance.source,
      provenanceNote: partner.provenance.note ?? null,
    };
    await db.partner.upsert({
      where: { code: partner.code },
      create: { code: partner.code, ...fields },
      update: fields,
    });
  }
  return partners.length;
}

async function seedHealth(db: PrismaClient) {
  const health = loadHealthMap();
  for (const row of health.values()) {
    // Unique on (partnerCode, asOf), so re-running corrects a mistyped figure for
    // a reporting date without erasing the history of other dates.
    await db.partnerHealth.upsert({
      where: { partnerCode_asOf: { partnerCode: row.partner_code, asOf: row.as_of } },
      create: {
        partnerCode: row.partner_code,
        asOf: row.as_of,
        fundsSanctioned: row.funds_sanctioned,
        fundsUtilised: row.funds_utilised,
        overdueAmount: row.overdue_amount,
        npaPct: row.npa_pct,
        avgProcessingDays: row.avg_processing_days,
        capacityFlag: row.capacity_flag,
        dataOrigin: row.data_origin,
      },
      update: {
        fundsSanctioned: row.funds_sanctioned,
        fundsUtilised: row.funds_utilised,
        overdueAmount: row.overdue_amount,
        npaPct: row.npa_pct,
        avgProcessingDays: row.avg_processing_days,
        capacityFlag: row.capacity_flag,
        dataOrigin: row.data_origin,
      },
    });
  }
  return health.size;
}

async function seedDocuments(db: PrismaClient) {
  const { definitions, requirements } = loadDocuments();

  for (const definition of definitions) {
    const fields = {
      nameKey: definition.name_key,
      whereToObtainKey: definition.where_to_obtain_key,
      provenanceSource: definition.provenance.source,
      provenanceNote: definition.provenance.note ?? null,
    };
    await db.documentDef.upsert({
      where: { code: definition.code },
      create: { code: definition.code, ...fields },
      update: fields,
    });
  }

  // Rewritten rather than upserted, for two reasons. Prisma will not target a
  // compound unique containing a nullable column, and in Postgres such a
  // constraint would not prevent duplicates anyway — two NULLs are distinct, so
  // repeated upserts of the '*' rows would silently accumulate. Replacing the set
  // is both idempotent and honest about that.
  await db.documentReq.deleteMany({});
  await db.documentReq.createMany({
    data: requirements.map((requirement) => ({
      schemeCode: requirement.scheme_code,
      docCode: requirement.doc_code,
      // '*' becomes null: a requirement that holds for every partner class is the
      // absence of a narrowing condition, not a partner type called '*'.
      partnerType:
        requirement.partner_type === '*' ? null : (requirement.partner_type as PartnerType),
      mandatory: requirement.mandatory,
      notesKey: requirement.notes_key,
    })),
  });

  return { definitions: definitions.length, requirements: requirements.length };
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error(
      'DATABASE_URL is not set. Point it at the Supabase Postgres instance and run\n' +
        '`npx prisma migrate dev` before seeding. Nothing was written.',
    );
    process.exit(1);
  }

  const db = connect(connectionString);
  try {
    await seed(db);
  } finally {
    await db.$disconnect();
  }
}

async function seed(db: PrismaClient) {
  const dataset = loadSchemeDataset({ applyOverlay });

  // dataset.label is a message key, not a sentence (hard rule 3), so it goes
  // through translate() here exactly as it does in scripts/personas.ts.
  console.log(`Seeding from: ${translate(dataset.label)}`);
  if (applyOverlay) {
    console.log(
      'WARNING: --with-overlay writes the demo overlay figures into the scheme\n' +
        '         master. They are stamped `demo_overlay` and are not real scheme\n' +
        '         parameters. Do not point a public demo at this database without\n' +
        "         the UI's not-authoritative banner enabled.",
    );
  }

  await seedGlobalEligibility(db, dataset);
  await seedSchemes(db, dataset);
  const partnerCount = await seedPartners(db);
  const healthCount = await seedHealth(db);
  const documents = await seedDocuments(db);

  const interestRules = dataset.schemes.reduce(
    (total, scheme) => total + scheme.interest_rules.length,
    0,
  );
  const ceilingRules = dataset.schemes.reduce(
    (total, scheme) => total + scheme.cost_ceiling_rules.length,
    0,
  );

  console.log(
    [
      '',
      `  schemes             ${dataset.schemes.length}`,
      `  interest rules      ${interestRules}`,
      `  cost ceiling rules  ${ceilingRules}`,
      `  partners            ${partnerCount}`,
      `  health rows         ${healthCount}  (all SIMULATED)`,
      `  document defs       ${documents.definitions}`,
      `  document reqs       ${documents.requirements}`,
      '',
      `  figures_authoritative: ${dataset.figures_authoritative}`,
      '',
    ].join('\n'),
  );

  if (!dataset.figures_authoritative) {
    console.log(
      'The scheme figures in this database are not citable. See VERIFY.md for the\n' +
        'full list and what each one needs. Regenerate it with `npm run verify:report`.',
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
