/**
 * POST /api/admin/health-apply
 *
 * Body: { rows: PartnerHealthRecord[] }
 * Requires admin cookie. Writes each row to Postgres as data_origin MIS_UPLOAD,
 * upserted on (partner_code, as_of). Returns { inserted, updated }.
 *
 * No filesystem writes, no mutation of data/*.json — the DB is the source for
 * future loads via src/lib/dataset-db.ts. Re-running the same CSV is idempotent
 * (same partner+as_of overwrites).
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { z } from 'zod';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { COOKIE_NAME, isValidToken } from '@/lib/admin-auth';
import { loadPartners } from '@/lib/dataset';

export const dynamic = 'force-dynamic';

const RowSchema = z.object({
  partner_code: z.string().min(1),
  funds_sanctioned: z.number().int().nonnegative(),
  funds_utilised: z.number().int().nonnegative(),
  overdue_amount: z.number().int().nonnegative(),
  npa_pct: z.number().min(0).max(100),
  avg_processing_days: z.number().nonnegative(),
  capacity_flag: z.enum(['OPEN', 'CONSTRAINED', 'CLOSED']),
  data_origin: z.enum(['MIS_UPLOAD']).optional(),
  as_of: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

const BodySchema = z.object({
  rows: z.array(RowSchema).min(1).max(500),
});

function makeClient(connectionString: string): PrismaClient {
  const clean = connectionString.replace(/[?&]sslmode=[^&]*/g, '').replace(/[?&]$/, '').replace(/\?$/, '');
  const pool = new pg.Pool({ connectionString: clean, ssl: { rejectUnauthorized: false } });
  return new PrismaClient({ adapter: new PrismaPg(pool) });
}

export async function POST(request: Request) {
  const jar = await cookies();
  if (!isValidToken(jar.get(COOKIE_NAME)?.value)) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }

  // Validate partner codes still in registry at apply time (prevents stale preview exploit)
  const validCodes = new Set(loadPartners().map((p) => p.code));
  for (const row of parsed.data.rows) {
    if (!validCodes.has(row.partner_code)) {
      return NextResponse.json({ error: `Unknown partner_code '${row.partner_code}'` }, { status: 400 });
    }
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return NextResponse.json(
      { error: 'DATABASE_URL not set — cannot write to Postgres. Preview works offline, but apply needs a DB.' },
      { status: 503 },
    );
  }

  const db = makeClient(connectionString);
  let inserted = 0;
  let updated = 0;
  try {
    for (const row of parsed.data.rows) {
      const existing = await db.partnerHealth.findUnique({
        where: { partnerCode_asOf: { partnerCode: row.partner_code, asOf: row.as_of } },
      });
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
          dataOrigin: 'MIS_UPLOAD',
        },
        update: {
          fundsSanctioned: row.funds_sanctioned,
          fundsUtilised: row.funds_utilised,
          overdueAmount: row.overdue_amount,
          npaPct: row.npa_pct,
          avgProcessingDays: row.avg_processing_days,
          capacityFlag: row.capacity_flag,
          dataOrigin: 'MIS_UPLOAD',
        },
      });
      if (existing) updated += 1;
      else inserted += 1;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `DB write failed: ${msg}` }, { status: 500 });
  } finally {
    await db.$disconnect();
  }

  return NextResponse.json({ inserted, updated });
}
