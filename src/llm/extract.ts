/**
 * src/llm/extract.ts — LLM boundary #1
 *
 * Free text or documents → ApplicantProfile, via Gemini Flash structured output,
 * then Zod-validated. Per roadmap + user instruction, Gemini is ONLY for
 * information extraction from documents/free-text into the application form —
 * never to decide which scheme applies or what the EMI is. That stays in src/core/.
 *
 * Free-text extraction now REQUIRES network + GEMINI_API_KEY (no offline fixture
 * for "describe in own words", even in demo). Document extraction also uses the
 * same model with multimodal input (image/PDF parts).
 */

import { SchemaType } from '@google/generative-ai';
import { ApplicantProfileSchema, type ApplicantProfile } from '@/core/types';
import { getFixture, getGeminiClient, isDemoMode, MODEL_ID } from './client';

const EXTRACT_INSTRUCTION = `
You are RinSetu's intake parser. Extract an ApplicantProfile from the user's free text.
Return ONLY JSON matching the schema below. Use null for anything not stated — never guess.
Do not invent a scheme, rate, ceiling, subsidy or EMI. Those come from deterministic code later.

Schema (all values nullable unless noted, use null when not stated):
{
  "name": string | null (person's full name if stated, e.g. "Rahul", "Sunita Devi"),
  "age": number | null (0-120),
  "gender": "FEMALE"|"MALE"|"OTHER"|"UNDISCLOSED",
  "category": "SC"|"ST"|"OBC"|"GENERAL"|"UNKNOWN",
  "annual_family_income": number | null (rupees per year),
  "state": string | null (Indian state name, e.g. "MH", "Maharashtra"),
  "district": string | null,
  "tehsil": string | null,
  "village": string | null,
  "lat": number | null, "lng": number | null,
  "intent": "LIVELIHOOD"|"EDUCATION"|"UNKNOWN",
  "purpose": string | null (purpose code like "tailoring", "manufacturing", "professional_course_india"),
  "project_cost": number | null (rupees),
  "own_funds_available": number | null,
  "education": { "admission_confirmed": boolean | null, "study_location": "INDIA"|"ABROAD"|null } | null,
  "documents_available": string[] (e.g. ["CASTE_CERT","INCOME_CERT","AADHAAR"]),
  "preferred_language": string (default "en", use "hi" if text is Hindi, "mr" if Marathi),
  "requested_tenure_months": number | null,
  "requested_moratorium_months": number | null,
  "notes": string | null
}

Rules:
- name: "My name is Rahul" or "I am Sunita Devi" -> "Rahul" / "Sunita Devi", else null.
- purpose: map "tailoring unit" -> "tailoring", "shop" -> "petty_trade", "manufacturing" -> "manufacturing", "course in India" -> "professional_course_india" etc. If unsure, null.
- intent: "I want to start a business" -> LIVELIHOOD, "study" -> EDUCATION, else UNKNOWN.
- category: only "SC" if user says Scheduled Caste / SC; else UNKNOWN (never assume).
- documents_available: only list docs the user explicitly says they have.
- Keep numbers exactly as the user said (90 thousand -> 90000). No scheme numbers.
`.trim();

function normalizeExtracted(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const r = raw as Record<string, unknown>;
  // name/tehsil/village: trim, empty -> null
  for (const k of ['name', 'tehsil', 'village', 'state', 'district']) {
    if (typeof r[k] === 'string') {
      const v = (r[k] as string).trim();
      r[k] = v || null;
    }
  }
  // category: "Scheduled Caste" / "SC" / "sc" -> "SC", null -> UNKNOWN
  if (r.category == null || r.category === '') r.category = 'UNKNOWN';
  else if (typeof r.category === 'string') {
    const v = r.category.trim().toUpperCase();
    if (v.includes('SC') || v.includes('SCHEDULED CASTE')) r.category = 'SC';
    else if (v.includes('ST')) r.category = 'ST';
    else if (v.includes('OBC')) r.category = 'OBC';
    else if (v.includes('GENERAL')) r.category = 'GENERAL';
    else if (v === 'UNKNOWN' || v === '') r.category = 'UNKNOWN';
    else r.category = 'UNKNOWN';
  }
  // gender: "Female" -> "FEMALE", null -> UNDISCLOSED
  if (r.gender == null || r.gender === '') r.gender = 'UNDISCLOSED';
  else if (typeof r.gender === 'string') {
    const v = r.gender.trim().toUpperCase();
    if (['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED'].includes(v)) r.gender = v;
    else r.gender = 'UNDISCLOSED';
  }
  // intent: null -> UNKNOWN
  if (r.intent == null || r.intent === '') r.intent = 'UNKNOWN';
  else if (typeof r.intent === 'string') {
    const v = r.intent.trim().toUpperCase();
    if (['LIVELIHOOD', 'EDUCATION', 'UNKNOWN'].includes(v)) r.intent = v;
    else r.intent = 'UNKNOWN';
  }
  // documents_available: null -> []
  if (!Array.isArray(r.documents_available)) r.documents_available = [];
  // numbers that may come as strings like "90000" or "90,000" or "5 lakh"
  for (const k of ['age', 'annual_family_income', 'project_cost', 'own_funds_available', 'requested_tenure_months', 'requested_moratorium_months', 'lat', 'lng']) {
    const v = r[k];
    if (typeof v === 'string' && v.trim() !== '') {
      const cleaned = v.replace(/[,₹\s]/g, '').toLowerCase();
      if (cleaned.includes('lakh')) {
        const num = parseFloat(cleaned.replace('lakh', ''));
        if (!Number.isNaN(num)) r[k] = Math.round(num * 100000);
      } else if (cleaned.includes('thousand')) {
        const num = parseFloat(cleaned.replace('thousand', ''));
        if (!Number.isNaN(num)) r[k] = Math.round(num * 1000);
      } else {
        const num = Number(cleaned);
        if (!Number.isNaN(num)) r[k] = num;
        else r[k] = null;
      }
    }
  }
  // education nested
  if (r.education && typeof r.education === 'object') {
    const edu = r.education as Record<string, unknown>;
    if (typeof edu.study_location === 'string') edu.study_location = edu.study_location.trim().toUpperCase();
  }
  return r;
}

function fixtureKeyForText(text: string): string {
  return `extract:${text.trim().toLowerCase()}`;
}

export async function extractProfile(input: {
  text: string;
  language?: string;
}): Promise<ApplicantProfile> {
  const text = input.text?.trim();
  if (!text) throw new Error('extractProfile: text is empty');

  // Phase 9 — DEMO_MODE fixture cache: serve known demo sentences without network/key
  if (isDemoMode()) {
    const key = fixtureKeyForText(text);
    const hit = await getFixture(key);
    if (hit && typeof hit === 'object') {
      return ApplicantProfileSchema.parse(normalizeExtracted(hit));
    }
    // No fixture hit: fall through to deterministic minimal extraction so the
    // guided form path still works offline, but free-text unknown sentences
    // get a clear message rather than a network timeout.
    const fallbackHit = await getFixture('extract:__fallback__');
    if (fallbackHit && typeof fallbackHit === 'object') {
      return ApplicantProfileSchema.parse(normalizeExtracted({ ...(fallbackHit as object), notes: text }));
    }
    throw new Error(
      'DEMO_MODE is on and this sentence has no fixture in data/llm.fixtures.json. Add "extract:<lowercased sentence>" to the fixtures, or turn DEMO_MODE off for live extraction.',
    );
  }

  // No offline fixture for free-text in live mode — requires network + GEMINI_API_KEY (user request)
  if (!process.env.GEMINI_API_KEY && !process.env.NEXT_PUBLIC_GEMINI_API_KEY) {
    // getGeminiClient will throw with helpful message if key missing
  }

  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: MODEL_ID,
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, nullable: true },
          age: { type: SchemaType.NUMBER, nullable: true },
          gender: { type: SchemaType.STRING, format: 'enum', enum: ['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED'], nullable: true },
          category: { type: SchemaType.STRING, format: 'enum', enum: ['SC', 'ST', 'OBC', 'GENERAL', 'UNKNOWN'], nullable: true },
          annual_family_income: { type: SchemaType.NUMBER, nullable: true },
          state: { type: SchemaType.STRING, nullable: true },
          district: { type: SchemaType.STRING, nullable: true },
          tehsil: { type: SchemaType.STRING, nullable: true },
          village: { type: SchemaType.STRING, nullable: true },
          lat: { type: SchemaType.NUMBER, nullable: true },
          lng: { type: SchemaType.NUMBER, nullable: true },
          intent: { type: SchemaType.STRING, format: 'enum', enum: ['LIVELIHOOD', 'EDUCATION', 'UNKNOWN'], nullable: true },
          purpose: { type: SchemaType.STRING, nullable: true },
          project_cost: { type: SchemaType.NUMBER, nullable: true },
          own_funds_available: { type: SchemaType.NUMBER, nullable: true },
          education: {
            type: SchemaType.OBJECT,
            nullable: true,
            properties: {
              admission_confirmed: { type: SchemaType.BOOLEAN, nullable: true },
              study_location: { type: SchemaType.STRING, format: 'enum', enum: ['INDIA', 'ABROAD'], nullable: true },
            },
          },
          documents_available: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          preferred_language: { type: SchemaType.STRING, nullable: true },
          requested_tenure_months: { type: SchemaType.NUMBER, nullable: true },
          requested_moratorium_months: { type: SchemaType.NUMBER, nullable: true },
          notes: { type: SchemaType.STRING, nullable: true },
        },
        required: ['gender', 'category', 'intent', 'documents_available'],
      },
    },
  });

  const prompt = `${EXTRACT_INSTRUCTION}\n\nUser text:\n"""${text}"""`;
  let rawText: string | undefined;
  // Retry on 429 quota with exponential backoff (free tier 20/min)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent(prompt);
      rawText = result.response.text();
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isQuota = msg.includes('429') || msg.toLowerCase().includes('quota') || msg.includes('Too Many Requests');
      if (isQuota && attempt < 2) {
        const m = msg.match(/retry in (\d+(\.\d+)?)s/i);
        const waitMs = m ? Math.ceil(parseFloat(m[1]) * 1000) : 1500 * (attempt + 1);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      // Friendly quota message
      if (isQuota) throw new Error(`Quota exceeded (free tier 20/min for ${MODEL_ID}). Please retry in a few seconds or use the guided form — it works offline and needs no API key.`);
      throw new Error(`extractProfile: Gemini failed: ${msg.slice(0, 800)}`);
    }
  }
  if (!rawText) throw new Error('extractProfile: Gemini failed: no response');
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`extractProfile: model did not return JSON: ${rawText.slice(0, 800)}`);
  }

  // Normalize common LLM slips before Zod (case, synonyms, string numbers)
  const norm = normalizeExtracted(parsed);
  return ApplicantProfileSchema.parse(norm);
}

/**
 * Extract from uploaded documents (images/PDFs) for the confirmed loan.
 * Only the required doc codes for that loan are considered — the model is
 * told which docs are required and must not invent others.
 *
 * Each file is sent as a Gemini inlineData part (base64). The model returns
 * the same ApplicantProfile JSON, but `documents_available` will list only the
 * doc codes it could verify from the files (e.g. AADHAAR number visible).
 */
export async function extractFromDocuments(input: {
  files: Array<{ name: string; mimeType: string; dataBase64: string; docCodeHint?: string }>;
  requiredDocCodes: string[];
  language?: string;
}): Promise<ApplicantProfile> {
  if (input.files.length === 0) throw new Error('extractFromDocuments: no files');

  if (isDemoMode()) {
    // Fixture per file count + required docs so demo can show extraction without network
    const key = `extract-documents:${input.requiredDocCodes.join(',')}:${input.files.length}`;
    const hit = await getFixture(key);
    if (hit && typeof hit === 'object') {
      return ApplicantProfileSchema.parse(normalizeExtracted(hit));
    }
    const fallback = await getFixture('extract-documents:__fallback__');
    if (fallback && typeof fallback === 'object') {
      return ApplicantProfileSchema.parse(normalizeExtracted(fallback));
    }
    throw new Error('DEMO_MODE is on and document extraction has no fixture. Add "extract-documents:__fallback__" to data/llm.fixtures.json.');
  }

  const client = getGeminiClient();
  const model = client.getGenerativeModel({
    model: MODEL_ID,
    generationConfig: {
      temperature: 0,
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, nullable: true },
          age: { type: SchemaType.NUMBER, nullable: true },
          gender: { type: SchemaType.STRING, format: 'enum', enum: ['FEMALE', 'MALE', 'OTHER', 'UNDISCLOSED'], nullable: true },
          category: { type: SchemaType.STRING, format: 'enum', enum: ['SC', 'ST', 'OBC', 'GENERAL', 'UNKNOWN'], nullable: true },
          annual_family_income: { type: SchemaType.NUMBER, nullable: true },
          state: { type: SchemaType.STRING, nullable: true },
          district: { type: SchemaType.STRING, nullable: true },
          tehsil: { type: SchemaType.STRING, nullable: true },
          village: { type: SchemaType.STRING, nullable: true },
          lat: { type: SchemaType.NUMBER, nullable: true },
          lng: { type: SchemaType.NUMBER, nullable: true },
          intent: { type: SchemaType.STRING, format: 'enum', enum: ['LIVELIHOOD', 'EDUCATION', 'UNKNOWN'], nullable: true },
          purpose: { type: SchemaType.STRING, nullable: true },
          project_cost: { type: SchemaType.NUMBER, nullable: true },
          own_funds_available: { type: SchemaType.NUMBER, nullable: true },
          education: {
            type: SchemaType.OBJECT,
            nullable: true,
            properties: {
              admission_confirmed: { type: SchemaType.BOOLEAN, nullable: true },
              study_location: { type: SchemaType.STRING, format: 'enum', enum: ['INDIA', 'ABROAD'], nullable: true },
            },
          },
          documents_available: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          preferred_language: { type: SchemaType.STRING, nullable: true },
          requested_tenure_months: { type: SchemaType.NUMBER, nullable: true },
          requested_moratorium_months: { type: SchemaType.NUMBER, nullable: true },
          notes: { type: SchemaType.STRING, nullable: true },
        },
        required: ['gender', 'category', 'intent', 'documents_available'],
      },
    },
  });

  const docList = input.requiredDocCodes.join(', ') || 'any';
  const instruction = `${EXTRACT_INSTRUCTION}\n\nYou are given ${input.files.length} document file(s) for the confirmed loan. Required docs for this loan: ${docList}. Extract only what is visible in the files. For documents_available, list only the doc codes from the required list that you can verify (e.g. AADHAAR if Aadhaar number is visible, CASTE_CERT if caste certificate is visible). Do not guess beyond the files.`;

  const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [{ text: instruction }];
  for (const f of input.files) {
    parts.push({ inlineData: { mimeType: f.mimeType, data: f.dataBase64 } });
    if (f.docCodeHint) parts.push({ text: `File ${f.name} is claimed to be ${f.docCodeHint}.` });
  }

  let rawText: string | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const result = await model.generateContent(parts as never);
      rawText = result.response.text();
      break;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const isQuota = msg.includes('429') || msg.toLowerCase().includes('quota');
      if (isQuota && attempt < 2) {
        const m = msg.match(/retry in (\d+(\.\d+)?)s/i);
        const waitMs = m ? Math.ceil(parseFloat(m[1]) * 1000) : 1500 * (attempt + 1);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }
      if (isQuota) throw new Error(`Quota exceeded (free tier 20/min for ${MODEL_ID}). Please retry or use the guided form.`);
      throw new Error(`extractFromDocuments: Gemini failed: ${msg.slice(0, 800)}`);
    }
  }
  if (!rawText) throw new Error('extractFromDocuments: Gemini failed: no response');
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error(`extractFromDocuments: model did not return JSON: ${rawText.slice(0, 800)}`);
  }
  return ApplicantProfileSchema.parse(normalizeExtracted(parsed));
}
