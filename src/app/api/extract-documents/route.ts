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
    const msg = e instanceof Error ? e.message : String(e);
    const isKeyMissing = msg.includes('GEMINI_API_KEY');
    return Response.json({ error: msg }, { status: isKeyMissing ? 500 : 500 });
  }
}
