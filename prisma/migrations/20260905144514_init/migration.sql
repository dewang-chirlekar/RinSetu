-- CreateEnum
CREATE TYPE "SchemeType" AS ENUM ('MICRO', 'TERM', 'EDUCATION');

-- CreateEnum
CREATE TYPE "SubsidyTiming" AS ENUM ('FRONT', 'BACK');

-- CreateEnum
CREATE TYPE "MoratoriumTreatment" AS ENUM ('CAPITALISED', 'SERVICED', 'WAIVED');

-- CreateEnum
CREATE TYPE "PartnerType" AS ENUM ('SCA', 'PSB', 'RRB', 'NBFC_MFI');

-- CreateEnum
CREATE TYPE "CapacityFlag" AS ENUM ('OPEN', 'CONSTRAINED', 'CLOSED');

-- CreateEnum
CREATE TYPE "DataOrigin" AS ENUM ('MIS_UPLOAD', 'SIMULATED');

-- CreateEnum
CREATE TYPE "ProvenanceSource" AS ENUM ('official_guideline', 'ps_text', 'placeholder', 'demo_overlay', 'design_decision', 'common_practice', 'fabricated', 'open_data');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('DRAFT', 'PACKET_GENERATED');

-- CreateTable
CREATE TABLE "schemes" (
    "code" TEXT NOT NULL,
    "type" "SchemeType" NOT NULL,
    "name_i18n" JSONB NOT NULL,
    "description_key" TEXT NOT NULL,
    "max_unit_cost" INTEGER,
    "max_loan" INTEGER,
    "min_loan" INTEGER,
    "min_project_cost" INTEGER,
    "loan_pct_cap" DOUBLE PRECISION,
    "margin_pct" DOUBLE PRECISION,
    "subsidy_pct" DOUBLE PRECISION,
    "subsidy_cap" INTEGER,
    "subsidy_timing" "SubsidyTiming",
    "moratorium_months_min" INTEGER,
    "moratorium_months_max" INTEGER,
    "moratorium_months_default" INTEGER,
    "moratorium_interest_treatment" "MoratoriumTreatment",
    "tenure_months_max" INTEGER,
    "tenure_includes_moratorium" BOOLEAN,
    "eligible_purposes" TEXT[],
    "allowed_partner_types" "PartnerType"[],
    "predicates" TEXT[],
    "provenance" JSONB NOT NULL,
    "source_url" TEXT,
    "source_date" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schemes_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "interest_rules" (
    "id" SERIAL NOT NULL,
    "scheme_code" TEXT NOT NULL,
    "loan_band_min" INTEGER,
    "loan_band_max" INTEGER,
    "purpose" TEXT,
    "gender" TEXT,
    "annual_rate_pct" DOUBLE PRECISION,
    "provenance" JSONB NOT NULL,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "interest_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_ceiling_rules" (
    "id" SERIAL NOT NULL,
    "scheme_code" TEXT NOT NULL,
    "purpose" TEXT,
    "max_unit_cost" INTEGER,
    "max_loan" INTEGER,
    "provenance" JSONB NOT NULL,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "cost_ceiling_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_eligibility" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "annual_family_income_cap" INTEGER,
    "category_requirement" TEXT,
    "age_min" INTEGER,
    "age_max" INTEGER,
    "provenance" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "global_eligibility_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PartnerType" NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "handles_scheme_types" "SchemeType"[],
    "min_ticket" INTEGER,
    "max_ticket" INTEGER,
    "languages" TEXT[],
    "jurisdiction_states" TEXT[],
    "provenance_source" "ProvenanceSource" NOT NULL,
    "provenance_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "partner_health" (
    "id" SERIAL NOT NULL,
    "partner_code" TEXT NOT NULL,
    "as_of" TEXT NOT NULL,
    "funds_sanctioned" INTEGER NOT NULL,
    "funds_utilised" INTEGER NOT NULL,
    "overdue_amount" INTEGER NOT NULL,
    "npa_pct" DOUBLE PRECISION NOT NULL,
    "avg_processing_days" DOUBLE PRECISION NOT NULL,
    "capacity_flag" "CapacityFlag" NOT NULL,
    "data_origin" "DataOrigin" NOT NULL,
    "uploaded_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_defs" (
    "code" TEXT NOT NULL,
    "name_key" TEXT NOT NULL,
    "where_to_obtain_key" TEXT NOT NULL,
    "provenance_source" "ProvenanceSource" NOT NULL,
    "provenance_note" TEXT,

    CONSTRAINT "document_defs_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "document_reqs" (
    "id" SERIAL NOT NULL,
    "scheme_code" TEXT NOT NULL,
    "doc_code" TEXT NOT NULL,
    "partner_type" "PartnerType",
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "notes_key" TEXT,

    CONSTRAINT "document_reqs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "applicant" JSONB NOT NULL,
    "scheme_code" TEXT,
    "partner_code" TEXT,
    "result" JSONB NOT NULL,
    "figures_authoritative" BOOLEAN NOT NULL,
    "dataset_label" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "interest_rules_scheme_code_idx" ON "interest_rules"("scheme_code");

-- CreateIndex
CREATE INDEX "cost_ceiling_rules_scheme_code_idx" ON "cost_ceiling_rules"("scheme_code");

-- CreateIndex
CREATE INDEX "partners_state_district_idx" ON "partners"("state", "district");

-- CreateIndex
CREATE INDEX "partner_health_partner_code_idx" ON "partner_health"("partner_code");

-- CreateIndex
CREATE UNIQUE INDEX "partner_health_partner_code_as_of_key" ON "partner_health"("partner_code", "as_of");

-- CreateIndex
CREATE INDEX "document_reqs_scheme_code_idx" ON "document_reqs"("scheme_code");

-- CreateIndex
CREATE UNIQUE INDEX "document_reqs_scheme_code_doc_code_partner_type_key" ON "document_reqs"("scheme_code", "doc_code", "partner_type");

-- CreateIndex
CREATE INDEX "applications_scheme_code_idx" ON "applications"("scheme_code");

-- CreateIndex
CREATE INDEX "applications_partner_code_idx" ON "applications"("partner_code");

-- AddForeignKey
ALTER TABLE "interest_rules" ADD CONSTRAINT "interest_rules_scheme_code_fkey" FOREIGN KEY ("scheme_code") REFERENCES "schemes"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_ceiling_rules" ADD CONSTRAINT "cost_ceiling_rules_scheme_code_fkey" FOREIGN KEY ("scheme_code") REFERENCES "schemes"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_health" ADD CONSTRAINT "partner_health_partner_code_fkey" FOREIGN KEY ("partner_code") REFERENCES "partners"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reqs" ADD CONSTRAINT "document_reqs_scheme_code_fkey" FOREIGN KEY ("scheme_code") REFERENCES "schemes"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_reqs" ADD CONSTRAINT "document_reqs_doc_code_fkey" FOREIGN KEY ("doc_code") REFERENCES "document_defs"("code") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_scheme_code_fkey" FOREIGN KEY ("scheme_code") REFERENCES "schemes"("code") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_partner_code_fkey" FOREIGN KEY ("partner_code") REFERENCES "partners"("code") ON DELETE SET NULL ON UPDATE CASCADE;
