/**
 * POST /api/admin/health-preview
 *
 * FormData { file: File } -> { rows, errors, validCount, invalidCount, asOfFallback }
 * Requires admin cookie. No DB access needed — pure validation against registry.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { COOKIE_NAME, isValidToken } from '@/lib/admin-auth';
import { parseHealthCsv } from '@/lib/health-csv';
import { loadPartners } from '@/lib/dataset';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!isValidToken(token)) {
    return NextResponse.json({ error: 'Not authenticated. Log in at /admin/health-upload.' }, { status: 401 });
  }

  let csvText = '';
  try {
    const fd = await request.formData();
    const file = fd.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file field "file"' }, { status: 400 });
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 2MB)' }, { status: 400 });
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      // Not fatal — accept anyway but note
    }
    csvText = await file.text();
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }

  if (!csvText || csvText.trim() === '') {
    return NextResponse.json({ error: 'File is empty' }, { status: 400 });
  }

  const partners = loadPartners();
  const codes = new Set(partners.map((p) => p.code));

  const parsed = parseHealthCsv(csvText, { existingPartnerCodes: codes });

  const validCount = parsed.validRows.length;
  const invalidCount = parsed.rows.filter((r) => !r.valid).length;

  return NextResponse.json({
    rows: parsed.rows,
    errors: parsed.errors,
    validCount,
    invalidCount,
    asOfFallback: parsed.asOfFallback,
  });
}
