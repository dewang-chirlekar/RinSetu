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
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: 500 });
  }
}
