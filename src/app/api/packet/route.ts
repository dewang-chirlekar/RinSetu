/**
 * src/app/api/packet/route.ts
 *
 * GET /api/packet
 * GET /api/packet?persona=P01
 * GET /api/packet?age=25&category=SC&... (legacy query, still parsed)
 *
 * Returns application/pdf — the pre-filled packet. No new numbers: reuses
 * recommend() output, then renders PacketDocument via @react-pdf/renderer.
 *
 * New submissions carry the profile in the HttpOnly intake cookie, so the
 * normal packet link is the bare /api/packet URL. Legacy query strings are
 * still accepted for old links, and persona ids remain shareable.
 */

import { ZodError } from 'zod';
import { getLocale } from 'next-intl/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { recommend } from '@/core/recommend';
import { loadBundle, loadPersonas } from '@/lib/dataset';
import { parseApplicantParams } from '@/lib/applicant-params';
import { readProfileCookie } from '@/lib/intake-session';
import { PacketDocument } from '@/lib/packet';
import React from 'react';

export const dynamic = 'force-dynamic';

type RawParams = Record<string, string | string[] | undefined>;

function one(params: RawParams, key: string): string | null {
  const v = params[key];
  const c = Array.isArray(v) ? v[0] : v;
  return c ?? null;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);

  // Reconstruct RawParams with proper array handling for the legacy shape.
  const raw: RawParams = {};
  for (const [k, v] of url.searchParams.entries()) {
    if (raw[k] == null) raw[k] = v;
    else if (Array.isArray(raw[k])) (raw[k] as string[]).push(v);
    else raw[k] = [raw[k] as string, v];
  }

  const personaId = one(raw, 'persona');
  const persona = personaId ? loadPersonas().find((e) => e.id === personaId) : undefined;
  const hasExplicitParams = Object.keys(raw).some((key) => key !== 'persona');

  let applicant;
  if (persona) {
    applicant = persona.applicant;
  } else if (hasExplicitParams) {
    // Legacy links only. New links never contain personal details.
    try {
      applicant = parseApplicantParams(raw);
    } catch (e) {
      if (e instanceof ZodError) {
        return new Response(`Invalid applicant data: ${e.message}`, { status: 400 });
      }
      throw e;
    }
  } else {
    const cookieProfile = await readProfileCookie();
    if (!cookieProfile) {
      return new Response(
        'Missing applicant data. Submit the guided form, use ?persona=P01, or open this link in the browser that filled the form.',
        { status: 400 },
      );
    }
    applicant = cookieProfile;
  }

  const bundle = loadBundle();
  const result = recommend({
    applicant,
    ...bundle,
    generatedAt: new Date().toISOString(),
  });
  const schemeByCode = new Map(bundle.dataset.schemes.map((s) => [s.code, s]));
  // Packet respects applicant's preferred language if set, else UI locale
  const uiLocale = (await getLocale()) as 'en' | 'hi' | 'mr';
  const packetLocale =
    applicant.preferred_language && ['en', 'hi', 'mr'].includes(applicant.preferred_language)
      ? (applicant.preferred_language as 'en' | 'hi' | 'mr')
      : uiLocale;

  const pdfBuffer = await renderToBuffer(
    // PacketDocument returns a <Document>, but TS sees unknown props — cast is safe: no new numbers, just reuses recommend() output
    React.createElement(PacketDocument as unknown as React.ComponentType<never>, { applicant, result, schemeByCode, locale: packetLocale } as never) as never,
  );

  const filename = `RinSetu-${applicant.id ?? result.recommended_scheme_code ?? 'packet'}.pdf`;

  return new Response(pdfBuffer as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
