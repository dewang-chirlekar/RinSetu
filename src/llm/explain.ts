/**
 * src/llm/explain.ts — LLM boundary #2
 *
 * Already-computed RecommendationResult → plain-language prose.
 * Receives ONLY the computed result and must not be given the authority or
 * the data to introduce a fact. It cannot decide which scheme applies or what
 * the EMI is — those are in the result it is handed.
 *
 * Do-not-translate glossary: scheme names, amounts, `₹`, codes, purpose strings
 * are rendered verbatim, never translated.
 *
 * DEMO_MODE=true serves a deterministic fixture — no network, no key.
 */

import { SchemaType } from '@google/generative-ai';
import { getFixture, getGeminiClient, isDemoMode, MODEL_ID } from './client';
import type { RecommendationResult } from '@/core/types';

const EXPLAIN_INSTRUCTION = `
You are RinSetu's narrator. You are given a RecommendationResult that was already
computed by deterministic code. Your job is ONLY to narrate it in the user's language.

Rules you must follow (or you have broken the project):
- Do NOT decide which scheme applies — it is already in the result.
- Do NOT compute or change any rupee figure, rate, EMI, schedule row, distance or health score — copy them exactly as given.
- Do NOT translate scheme names, purpose codes, amounts, '₹', or status codes (ELIGIBLE/NOT_ELIGIBLE/INDETERMINATE). Keep them verbatim.
- Do NOT invent a document, partner, or remediation.
- If a scheme is NOT_ELIGIBLE or INDETERMINATE, state its reason code and remediation exactly as given.
- Keep it short (<= 180 words), plain, and in the requested language. The guided form is the primary path — this narration is an enhancement.

You will receive JSON: { result, language }. Language is 'en'|'hi'|'mr'. Respond with JSON: { prose: string }.
`.trim();

function fixtureKey(result: RecommendationResult, language: string): string {
  const rec = result.recommended_scheme_code ?? 'none';
  return `explain:${rec}:${language}:${result.schemes.length}`;
}

export async function explainResult(input: {
  result: RecommendationResult;
  language?: string;
}): Promise<string> {
  const language = input.language ?? 'en';
  const { result } = input;

  if (!result || !Array.isArray(result.schemes)) throw new Error('explainResult: result.schemes missing');

  // DEMO_MODE: deterministic fixture, no network
  if (isDemoMode()) {
    const key = fixtureKey(result, language);
    const hit = await getFixture(key);
    if (typeof hit === 'string') return hit;
    if (hit && typeof (hit as { prose?: unknown }).prose === 'string') return (hit as { prose: string }).prose;
    // Fallback: deterministic narration from the result — no model, no invention
    const rec = result.schemes.find((s) => s.scheme_code === result.recommended_scheme_code);
    const parts: string[] = [];
    if (rec) {
      parts.push(
        language === 'hi'
          ? `आपके लिए ${rec.scheme_code} उपयुक्त है — स्थिति ${rec.status} है।`
          : language === 'mr'
            ? `तुमच्यासाठी ${rec.scheme_code} योग्य आहे — स्थिती ${rec.status} आहे.`
            : `For you, ${rec.scheme_code} fits — status is ${rec.status}.`,
      );
      if (rec.computation && rec.computation.computable) {
        const loan = (rec.computation as { loan: number }).loan;
        const emi = (rec.computation as { schedule: { emi: number } }).schedule.emi;
        parts.push(
          language === 'hi'
            ? `ऋण ₹${loan} और किस्त ₹${emi} पहले से ही नियत कोड से निकाली गई है।`
            : language === 'mr'
              ? `कर्ज ₹${loan} आणि हप्ता ₹${emi} आधीच नियत कोडमधून काढले आहे.`
              : `Loan Rs ${loan} and instalment Rs ${emi} were already computed by deterministic code.`,
        );
      }
      const others = result.schemes.filter((s) => s.scheme_code !== rec.scheme_code);
      if (others.length > 0) {
        const codes = others.map((s) => `${s.scheme_code} (${s.status})`).join(', ');
        parts.push(
          language === 'hi'
            ? `अन्य योजनाएँ: ${codes} — कारण और उपाय नतीजे में दिए गए हैं।`
            : language === 'mr'
              ? `इतर योजना: ${codes} — कारणे आणि उपाय निकालात दिले आहेत.`
              : `Other schemes: ${codes} — reasons and next steps are in the result.`,
        );
      }
    } else {
      parts.push(
        language === 'hi'
          ? 'दी गई जानकारी पर कोई योजना पात्र नहीं निकली। नतीजे में हर योजना के कारण और उपाय दिए गए हैं।'
          : language === 'mr'
            ? 'दिलेल्या माहितीवर कोणतीही योजना पात्र ठरली नाही. निकालात प्रत्येक योजनेची कारणे आणि उपाय दिले आहेत.'
            : 'No scheme is eligible on the given information. Reasons and next steps for every scheme are in the result.',
      );
    }
    parts.push(
      language === 'hi'
        ? 'यह विवरण केवल पहले से निकले नतीजे को सुनाता है, नया आंकड़ा नहीं बनाता।'
        : language === 'mr'
          ? 'हे वर्णन फक्त आधीच काढलेल्या निकालाचे कथन करते, नवीन आकडा तयार करत नाही.'
          : 'This narration only retells the already-computed result; it creates no new figure.',
    );
    return parts.join(' ');
  }

  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: MODEL_ID,
    generationConfig: {
      temperature: 0.3,
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: { prose: { type: SchemaType.STRING } },
        required: ['prose'],
      },
    },
  });

  // Only the computed result is sent — the model has no other source of truth
  const payload = JSON.stringify({ result, language });
  const prompt = `${EXPLAIN_INSTRUCTION}\n\nInput JSON:\n${payload}`;
  const res = await model.generateContent(prompt);
  const text = res.response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`explainResult: model did not return JSON: ${text.slice(0, 500)}`);
  }
  const prose = (parsed as { prose?: unknown }).prose;
  if (typeof prose !== 'string' || prose.trim().length === 0) throw new Error('explainResult: prose missing');
  return prose.trim();
}
