/**
 * src/app/api/extract-documents/route.ts
 *
 * POST { files: [{ name, mimeType, dataBase64, docCodeHint? }], requiredDocCodes: string[], language? }
 *   → ApplicantProfile (Zod-validated)
 *
 * Gemini is ONLY for information extraction from documents into the application form
 * (per user instruction). No scheme decision, no EMI — those stay in src/core/.
 * Requires GEMINI_API_KEY + network (no offline fixture for documents).
 */

import { extractFromDocuments } from '@/llm/extract';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  let body: { files?: Array<{ name: string; mimeType: string; dataBase64: string; docCodeHint?: string }>; requiredDocCodes?: string[]; language?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON. Expected { files: [{ name, mimeType, dataBase64 }], requiredDocCodes: string[] }' }, { status: 400 });
  }
  if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
    return Response.json({ error: 'files is required (at least one file with name, mimeType, dataBase64)' }, { status: 400 });
  }
  if (!body.requiredDocCodes || !Array.isArray(body.requiredDocCodes)) {
    return Response.json({ error: 'requiredDocCodes is required (string[] for the confirmed loan)' }, { status: 400 });
  }
  try {
    const profile = await extractFromDocuments({
      files: body.files,
      requiredDocCodes: body.requiredDocCodes,
      language: body.language,
    });
    return Response.json(profile);
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const lower = raw.toLowerCase();
    const isQuota = lower.includes('quota') || raw.includes('429');
    const isBusy = lower.includes('503') || lower.includes('high demand') || lower.includes('overloaded') || lower.includes('service unavailable') || lower.includes('busy');
    let status = 500;
    let retryAfter: string | undefined;
    let msg = raw;
    if (isQuota) {
      msg = 'Free-tier quota exceeded (20/min). Please wait a few seconds and retry, or use the guided form below — it works offline.';
      status = 429;
      retryAfter = '5';
    } else if (isBusy) {
      msg = 'AI service is busy (high demand on Gemini). Please wait 10–15 seconds and try again, or use the guided form — it works offline.';
      status = 503;
      retryAfter = '10';
    }
    const isKeyMissing = lower.includes('gemini_api_key');
    if (isKeyMissing) status = 500;
    console.error('POST /api/extract-documents failed:', raw);
    return Response.json({ error: msg }, { status, headers: retryAfter ? { 'Retry-After': retryAfter } : undefined });
  }
}
