/**
 * src/app/api/explain/route.ts — LLM boundary #2
 *
 * POST { result: RecommendationResult, language?: 'en'|'hi'|'mr' } → { prose: string }
 *
 * Receives ONLY the already-computed result — the model cannot invent a scheme or rupee figure.
 * DEMO_MODE=true serves deterministic fixture; no key needed.
 */

import { explainResult } from '@/llm/explain';
import type { RecommendationResult } from '@/core/types';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<Response> {
  let body: { result?: RecommendationResult; language?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON. Expected { result: RecommendationResult, language?: string }' }, { status: 400 });
  }
  if (!body.result || !Array.isArray(body.result.schemes)) {
    return Response.json({ error: 'result.schemes missing or not an array' }, { status: 400 });
  }
  try {
    const prose = await explainResult({ result: body.result, language: body.language });
    return Response.json({ prose });
  } catch (e) {
    const raw = e instanceof Error ? e.message : String(e);
    const lower = raw.toLowerCase();
    const isBusy = lower.includes('503') || lower.includes('high demand') || lower.includes('overloaded') || lower.includes('service unavailable') || lower.includes('busy');
    const isQuota = lower.includes('quota') || raw.includes('429');
    let status = 500;
    let retryAfter: string | undefined;
    let msg = raw;
    if (isQuota) {
      msg = 'Free-tier quota exceeded (20/min). Please wait and retry.';
      status = 429;
      retryAfter = '5';
    } else if (isBusy) {
      msg = 'AI service is busy (high demand). Please retry in 10–15 seconds — or read the result directly, the numbers are already computed.';
      status = 503;
      retryAfter = '10';
    }
    console.error('POST /api/explain failed:', raw);
    return Response.json({ error: msg }, { status, headers: retryAfter ? { 'Retry-After': retryAfter } : undefined });
  }
}
