/**
 * src/app/api/extract/route.ts — LLM boundary #1
 *
 * POST { text, language? } → ApplicantProfile (Zod-validated)
 * GET  ?text=... for quick manual test (same)
 *
 * Requires GEMINI_API_KEY + network (no offline fixture for free-text, per user request).
 * Guided form remains the primary path — this is enhancement.
 */

import { extractProfile } from '@/llm/extract';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  let body: { text?: string; language?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON. Expected { text: string, language?: string }' }, { status: 400 });
  }
  const text = body.text?.trim();
  if (!text) return Response.json({ error: 'text is required' }, { status: 400 });

  try {
    const profile = await extractProfile({ text, language: body.language });
    return Response.json(profile);
  } catch (e) {
    const raw = e instanceof Error ? e.message : e instanceof Event ? `Network error (${(e as Event).type})` : String(e);
    const lower = raw.toLowerCase();
    const isQuota = lower.includes('quota') || raw.includes('429');
    const isBusy = lower.includes('503') || lower.includes('high demand') || lower.includes('overloaded') || lower.includes('service unavailable') || lower.includes('busy');
    const isTransient = isQuota || isBusy;
    let msg = raw;
    let status = 500;
    let retryAfter: string | undefined;
    if (isQuota) {
      msg = 'Free-tier quota exceeded (20/min). Please wait a few seconds and retry, or use the guided form below — it works offline and is the primary path.';
      status = 429;
      retryAfter = '5';
    } else if (isBusy) {
      msg = 'AI service is busy (high demand on Gemini). Please wait 10–15 seconds and try again, or use the guided form below — it works offline and is the primary path.';
      status = 503;
      retryAfter = '10';
    } else if (lower.includes('gemini failed')) {
      // Already user-friendly hint from extract.ts
      msg = raw;
      status = isTransient ? 503 : 500;
      retryAfter = isTransient ? '10' : undefined;
    }
    console.error('POST /api/extract failed:', raw);
    return Response.json({ error: msg }, { status, headers: retryAfter ? { 'Retry-After': retryAfter } : undefined });
  }
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const text = url.searchParams.get('text')?.trim();
  const language = url.searchParams.get('language') ?? undefined;
  if (!text) return Response.json({ error: 'text query param required' }, { status: 400 });
  try {
    const profile = await extractProfile({ text, language });
    return Response.json(profile);
  } catch (e) {
    const raw = e instanceof Error ? e.message : e instanceof Event ? `Network error (${(e as Event).type})` : String(e);
    const lower = raw.toLowerCase();
    const isQuota = lower.includes('quota') || raw.includes('429');
    const isBusy = lower.includes('503') || lower.includes('high demand') || lower.includes('overloaded') || lower.includes('service unavailable') || lower.includes('busy');
    let msg = raw;
    let status = 500;
    let retryAfter: string | undefined;
    if (isQuota) {
      msg = 'Free-tier quota exceeded (20/min). Please wait a few seconds and retry, or use the guided form below — it works offline and is the primary path.';
      status = 429;
      retryAfter = '5';
    } else if (isBusy) {
      msg = 'AI service is busy (high demand on Gemini). Please wait 10–15 seconds and try again, or use the guided form below — it works offline and is the primary path.';
      status = 503;
      retryAfter = '10';
    }
    console.error('GET /api/extract failed:', raw);
    return Response.json({ error: msg }, { status, headers: retryAfter ? { 'Retry-After': retryAfter } : undefined });
  }
}
