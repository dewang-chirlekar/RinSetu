/**
 * src/app/api/applications/[id]/route.ts
 *
 * DELETE /api/applications/[id] -> { ok: true } | { error }
 *
 * Demo is intentionally open — no auth, same as POST. A real deployment
 * would scope by cookie/JWT and check ownership. The receipt model
 * (prisma/schema.prisma:367) means deletion is final; there is no soft-delete.
 */

import { NextResponse } from 'next/server';
import { getPrisma, hasDatabaseUrl, isDbUnreachableError } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: 'DATABASE_URL not set — cannot delete.' }, { status: 503 });
  }

  const { id } = await context.params;
  if (!id || typeof id !== 'string' || id.trim() === '') {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }

  try {
    const db = getPrisma();
    await db.application.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (isDbUnreachableError(e)) {
      return NextResponse.json({ error: 'Database unreachable — try again.' }, { status: 503 });
    }
    // Prisma P2025 = record not found — code is on the error object, message varies by Prisma version
    const code = (e as { code?: string })?.code;
    const msg = e instanceof Error ? e.message : String(e);
    if (
      code === 'P2025' ||
      msg.includes('P2025') ||
      msg.toLowerCase().includes('record to delete does not exist') ||
      msg.toLowerCase().includes('no record was found')
    ) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    }
    return NextResponse.json({ error: `DB delete failed: ${msg}` }, { status: 500 });
  }
}

// GET single via API as well (handy for curl / tests; page still reads via Prisma directly)
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json({ error: 'DATABASE_URL not set' }, { status: 503 });
  }
  const { id } = await context.params;
  try {
    const db = getPrisma();
    const row = await db.application.findUnique({
      where: { id },
      select: {
        id: true,
        schemeCode: true,
        partnerCode: true,
        applicant: true,
        result: true,
        figuresAuthoritative: true,
        datasetLabel: true,
        language: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!row) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
    return NextResponse.json({ application: row });
  } catch (e) {
    if (isDbUnreachableError(e)) {
      return NextResponse.json({ error: 'Database unreachable' }, { status: 503 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `DB read failed: ${msg}` }, { status: 500 });
  }
}
