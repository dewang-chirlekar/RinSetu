/**
 * src/app/api/packet/route.ts
 *
 * GET /api/packet?persona=P01
 * GET /api/packet?age=25&category=SC&... (same query as /result)
 *
 * Returns application/pdf — the pre-filled packet. No new numbers: reuses
 * recommend() output, then renders PacketDocument via @react-pdf/renderer.
 */

import { ZodError } from 'zod';
import { renderToBuffer } from '@react-pdf/renderer';
import { recommend } from '@/core/recommend';
import { loadBundle, loadPersonas } from '@/lib/dataset';
import { parseApplicantParams } from '@/lib/applicant-params';
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
  const params: RawParams = Object.fromEntries(url.searchParams.entries()) as RawParams;
  // URLSearchParams loses duplicate keys — acceptable for this form (no arrays)

  const personaId = one(params, 'persona');
  const persona = personaId ? loadPersonas().find((e) => e.id === personaId) : undefined;

  let applicant;
  if (persona) {
    applicant = persona.applicant;
  } else {
    // Reconstruct RawParams with proper array handling for Next's searchParams shape
    const raw: RawParams = {};
    for (const [k, v] of url.searchParams.entries()) {
      if (raw[k] == null) raw[k] = v;
      else if (Array.isArray(raw[k])) (raw[k] as string[]).push(v);
      else raw[k] = [raw[k] as string, v];
    }
    // Empty packet -> 400
    if (Object.keys(raw).length === 0 || (Object.keys(raw).length === 1 && raw.persona != null && !persona)) {
      return new Response('Missing applicant data. Use ?persona=P01 or the guided form query.', { status: 400 });
    }
    try {
      applicant = parseApplicantParams(raw as Record<string, string | string[] | undefined> as never);
    } catch (e) {
      if (e instanceof ZodError) {
        return new Response(`Invalid applicant data: ${e.message}`, { status: 400 });
      }
      throw e;
    }
  }

  const bundle = loadBundle();
  const result = recommend({
    applicant,
    ...bundle,
    generatedAt: new Date().toISOString(),
  });
  const schemeByCode = new Map(bundle.dataset.schemes.map((s) => [s.code, s]));

  const pdfBuffer = await renderToBuffer(
    // PacketDocument returns a <Document>, but TS sees unknown props — cast is safe: no new numbers, just reuses recommend() output
    React.createElement(PacketDocument as unknown as React.ComponentType<never>, { applicant, result, schemeByCode } as never) as never,
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
