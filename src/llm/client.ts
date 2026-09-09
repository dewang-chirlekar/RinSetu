/**
 * src/llm/client.ts
 *
 * One adapter for Gemini Flash. The only place that imports @google/generative-ai.
 * Keeps the two LLM boundaries (extract.ts, explain.ts) from knowing the provider.
 *
 * DEMO_MODE=true serves every call from a fixture cache — no network, no key,
 * no model. This is what makes `Full demo runs with wifi physically off`
 * (`docs/ROADMAP.md` Phase 9) possible and what lets every feature work with
 * the LLM disabled (`CLAUDE.md` hard rule 5).
 *
 * No number or scheme decision ever comes from here — the adapter only carries
 * JSON that the caller already validated with Zod.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

export const DEMO_MODE = process.env.DEMO_MODE === 'true';
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';

let client: GoogleGenerativeAI | null = null;

export function getGeminiClient(): GoogleGenerativeAI {
  if (DEMO_MODE) throw new Error('getGeminiClient() called in DEMO_MODE — use fixture cache instead');
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not set. Set DEMO_MODE=true for offline demo or add the key to .env');
  if (!client) client = new GoogleGenerativeAI(GEMINI_API_KEY);
  return client;
}

/** Gemini Flash model ID — keep in one place so a swap is one edit. 2026-09-09: 1.5/2.0 removed from ListModels, 3.6-flash 503 overloaded — use 2.5-flash stable. */
export const MODEL_ID = 'gemini-2.5-flash';
export const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite', 'gemini-3-flash-preview', 'gemini-3.6-flash'] as const;

/** True if the error looks transient and worth retrying (429 quota or 503 overload or 5xx). */
export function isTransientError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes('429') ||
    m.includes('quota') ||
    m.includes('too many requests') ||
    m.includes('503') ||
    m.includes('service unavailable') ||
    m.includes('overloaded') ||
    m.includes('high demand') ||
    m.includes('500') ||
    m.includes('502') ||
    m.includes('504') ||
    m.includes('unavailable')
  );
}

/** True if the error suggests the model ID is wrong (404). */
export function isModelNotFoundError(message: string): boolean {
  return message.includes('404') || message.toLowerCase().includes('not found') || message.toLowerCase().includes('not supported');
}

/**
 * Fixture cache for DEMO_MODE. Keys are the exact prompt or text that would
 * have been sent to the model; values are the JSON the model would have returned.
 * Stored in `data/llm.fixtures.json` and loaded lazily to keep this file sync.
 */
let fixtures: Record<string, unknown> | null = null;

export async function getFixture(key: string): Promise<unknown | null> {
  if (!DEMO_MODE) return null;
  if (!fixtures) {
    try {
      const mod = await import('../../data/llm.fixtures.json');
      fixtures = (mod.default ?? mod) as Record<string, unknown>;
    } catch {
      fixtures = {};
    }
  }
  return fixtures[key] ?? null;
}

export function isDemoMode(): boolean {
  return DEMO_MODE;
}
