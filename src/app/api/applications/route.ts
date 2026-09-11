/**
 * src/app/api/applications/route.ts
 *
 * POST /api/applications  { search?: string, applicant?: ApplicantProfile, schemeCode?: string, partnerCode?: string, language?: string } -> { id }
 * GET  /api/applications  -> { applications: { id, schemeCode, partnerCode, applicantName, createdAt, figuresAuthoritative, datasetLabel, status }[] }
 *
 * Stores the whole RecommendationResult as the receipt (Application.result) so
 * a file reopened in six months shows the numbers it was actually given,
 * not re-priced against whatever the scheme master says by then.
 *
 * No auth for the demo — a real deployment would scope by cookie/JWT. Keeping
 * it open here is intentional so the guided form's "save" is one click and the
 * demo doesn't need login.
 */

import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApplicantProfileSchema } from '@/core/types';
import { recommend } from '@/core/recommend';
import { loadBundle, loadPersonas } from '@/lib/dataset';
import { parseApplicantParams } from '@/lib/applicant-params';
import { getPrisma, isDbUnreachableError, hasDatabaseUrl } from '@/lib/db';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  search: z.string().optional(),
  applicant: z.unknown().optional(),
  schemeCode: z.string().nullable().optional(),
  partnerCode: z.string().nullable().optional(),
  language: z.string().optional(),
});

function parseSearchToApplicant(search: string) {
  const qs = search.startsWith('?') ? search.slice(1) : search;
  const sp = new URLSearchParams(qs);
  const raw: Record<string, string | string[] | undefined> = {};
  for (const [k, v] of sp.entries()) {
    if (raw[k] == null) raw[k] = v;
    else if (Array.isArray(raw[k])) (raw[k] as string[]).push(v);
    else raw[k] = [raw[k] as string, v];
  }
  const personaId = sp.get('persona');
  if (personaId) {
    const persona = loadPersonas().find((p) => p.id === personaId);
    if (!persona) throw new Error(`Unknown persona '${personaId}'`);
    return persona.applicant;
  }
  if (Object.keys(raw).length === 0) throw new Error('Missing applicant data');
  return parseApplicantParams(raw);
}

export async function POST(request: Request) {
  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: 'DATABASE_URL not set — cannot save applications. Seed the Supabase DB and set DATABASE_URL.' },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsedBody = BodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsedBody.error.flatten() }, { status: 400 });
  }

  const { search, applicant: rawApplicant, schemeCode: requestedScheme, partnerCode: requestedPartner, language } = parsedBody.data;

  let applicant;
  try {
    if (rawApplicant !== undefined) {
      applicant = ApplicantProfileSchema.parse(rawApplicant);
    } else if (search !== undefined) {
      applicant = parseSearchToApplicant(search);
    } else {
      return NextResponse.json({ error: 'Provide `search` (query string) or `applicant` object' }, { status: 400 });
    }
  } catch (e) {
    const msg = e instanceof z.ZodError ? e.message : e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Invalid applicant: ${msg}` }, { status: 400 });
  }

  const bundle = loadBundle();
  const result = recommend({ applicant, ...bundle, generatedAt: new Date().toISOString() });

  // Choose scheme to store — prefer caller’s choice if it is ELIGIBLE, else the engine’s recommendation.
  let schemeCode: string | null = null;
  if (requestedScheme) {
    const found = result.schemes.find((s) => s.scheme_code === requestedScheme);
    if (found && found.status === 'ELIGIBLE') schemeCode = requestedScheme;
    else schemeCode = result.recommended_scheme_code;
  } else {
    schemeCode = result.recommended_scheme_code;
  }

  let partnerCode: string | null = null;
  if (requestedPartner) {
    const code = String(requestedPartner).trim();
    if (code) {
      const exists = bundle.partners.some((p) => p.code === code);
      partnerCode = exists ? code : null;
    }
  }

  const lang =
    language && ['en', 'hi', 'mr'].includes(language)
      ? language
      : (applicant.preferred_language && ['en', 'hi', 'mr'].includes(applicant.preferred_language) ? applicant.preferred_language : 'en');

  try {
    const db = getPrisma();
    const row = await db.application.create({
      data: {
        applicant: applicant as unknown as object,
        result: result as unknown as object,
        schemeCode: schemeCode,
        partnerCode: partnerCode,
        figuresAuthoritative: result.dataset.figures_authoritative,
        datasetLabel: result.dataset.label,
        language: lang,
      },
      select: { id: true },
    });
    return NextResponse.json({ id: row.id }, { status: 201 });
  } catch (e) {
    if (isDbUnreachableError(e)) {
      return NextResponse.json({ error: 'Database unreachable — try again, or run with the seeded JSON fallback.' }, { status: 503 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `DB write failed: ${msg}` }, { status: 500 });
  }
}

export async function GET() {
  if (!hasDatabaseUrl()) {
    return NextResponse.json(
      { error: 'DATABASE_URL not set', applications: [] },
      { status: 503 },
    );
  }
  try {
    const db = getPrisma();
    const rows = await db.application.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: {
        id: true,
        schemeCode: true,
        partnerCode: true,
        applicant: true,
        result: true,
        figuresAuthoritative: true,
        datasetLabel: true,
        status: true,
        language: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const applications = rows.map((r) => {
      const applicant = r.applicant as unknown as { name?: string | null };
      const result = r.result as unknown as { recommended_scheme_code?: string | null } | null;
      return {
        id: r.id,
        schemeCode: r.schemeCode,
        schemeCodeRecommended: (result as { recommended_scheme_code?: string | null } | null)?.recommended_scheme_code ?? null,
        partnerCode: r.partnerCode,
        applicantName: applicant?.name ?? null,
        figuresAuthoritative: r.figuresAuthoritative,
        datasetLabel: r.datasetLabel,
        status: r.status,
        language: r.language,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      };
    });
    return NextResponse.json({ applications });
  } catch (e) {
    if (isDbUnreachableError(e)) {
      return NextResponse.json({ error: 'Database unreachable', applications: [] }, { status: 503 });
    }
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `DB read failed: ${msg}`, applications: [] }, { status: 500 });
  }
}
