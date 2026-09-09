/**
 * src/lib/applicant-params.ts
 *
 * URL query string ⇄ ApplicantProfile.
 *
 * The intake form submits with GET, so a result page is a plain URL: shareable,
 * bookmarkable, reloadable, and it needs no client-side JavaScript at all. That
 * last property is the reason for the choice — CLAUDE.md hard rule 10 says the
 * target user is on a low-end phone, and hard rule 5 says every feature must work
 * with the LLM disabled. A GET form satisfies both by construction.
 *
 * This is a trust boundary: query strings are user input. Nothing leaves this
 * file without going through ApplicantProfileSchema, the same Zod schema that
 * guards LLM extraction output.
 *
 * The empty-string rule is the subtle part. An HTML input the user left blank
 * submits '', and '' must become null (UNKNOWN), never 0. A zero income would
 * sail through the income cap; an unknown income must make the check
 * unevaluable. See the `null means UNKNOWN, never zero` note in src/core/types.ts.
 */

import { ApplicantProfileSchema, type ApplicantProfile } from '@/core/types';

export type RawParams = Record<string, string | string[] | undefined>;

function one(params: RawParams, key: string): string | null {
  const value = params[key];
  const first = Array.isArray(value) ? value[0] : value;
  if (first === undefined) return null;
  const trimmed = first.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function many(params: RawParams, key: string): string[] {
  const value = params[key];
  if (value === undefined) return [];
  return (Array.isArray(value) ? value : [value]).filter((entry) => entry.trim().length > 0);
}

/** Blank or unparseable → null. Never a zero substituted for a blank. Handles “5 lakh”, “90 thousand”, “₹ 1,25,000”. */
function num(params: RawParams, key: string): number | null {
  const raw = one(params, key);
  if (raw === null) return null;
  const cleaned = raw.replace(/[,\s₹]/g, '').toLowerCase();
  if (cleaned.includes('lakh')) {
    const n = parseFloat(cleaned.replace('lakh', ''));
    return Number.isFinite(n) ? Math.round(n * 100000) : null;
  }
  if (cleaned.includes('thousand')) {
    const n = parseFloat(cleaned.replace('thousand', ''));
    return Number.isFinite(n) ? Math.round(n * 1000) : null;
  }
  // Plain number like "500000" or "5.5"
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Tri-state checkbox/radio: 'yes' | 'no' | absent → true | false | null. */
function tribool(params: RawParams, key: string): boolean | null {
  const raw = one(params, key);
  if (raw === 'yes') return true;
  if (raw === 'no') return false;
  return null;
}

/**
 * The education block is `null` when nothing about it was answered, rather than
 * an object full of nulls. Both parse, but a null block reads correctly in a
 * snapshot and matches what the persona fixtures do.
 */
function education(params: RawParams): ApplicantProfile['education'] {
  const admission = tribool(params, 'edu_admission');
  const location = one(params, 'edu_location');
  const course = one(params, 'edu_course');
  const duration = num(params, 'edu_duration');

  if (admission === null && location === null && course === null && duration === null) {
    return null;
  }

  return {
    admission_confirmed: admission,
    study_location: location === 'INDIA' || location === 'ABROAD' ? location : null,
    course_name: course,
    course_duration_months: duration,
  };
}

/**
 * Parses a query string into a validated profile.
 *
 * Throws a ZodError on a value the form itself would not have produced — a
 * hand-edited URL with `age=999`, say. Callers render the intake form again
 * rather than a half-populated result.
 */
export function parseApplicantParams(params: RawParams): ApplicantProfile {
  return ApplicantProfileSchema.parse({
    name: one(params, 'name'),
    age: num(params, 'age'),
    gender: one(params, 'gender') ?? undefined,
    category: one(params, 'category') ?? undefined,
    annual_family_income: num(params, 'income'),
    state: one(params, 'state'),
    district: one(params, 'district'),
    tehsil: one(params, 'tehsil'),
    village: one(params, 'village'),
    lat: num(params, 'lat'),
    lng: num(params, 'lng'),
    intent: one(params, 'intent') ?? undefined,
    purpose: one(params, 'purpose'),
    project_cost: num(params, 'project_cost'),
    own_funds_available: num(params, 'own_funds'),
    education: education(params),
    documents_available: many(params, 'doc'),
    preferred_language: one(params, 'lang') ?? undefined,
    requested_tenure_months: num(params, 'tenure'),
    requested_moratorium_months: num(params, 'moratorium'),
    notes: one(params, 'notes'),
  });
}

/** True when the URL carries no answers at all, so /result can redirect to the form. */
export function isEmptyParams(params: RawParams): boolean {
  return Object.keys(params).length === 0;
}

/**
 * Rebuilds a query string from a profile. Used by the persona explorer so
 * 'open this case in the form' lands on a pre-filled intake page — the same
 * round trip a reviewer would want to do by hand.
 */
export function applicantToParams(applicant: ApplicantProfile): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return;
    params.set(key, String(value));
  };

  set('name', applicant.name);
  set('age', applicant.age);
  set('gender', applicant.gender);
  set('category', applicant.category);
  set('income', applicant.annual_family_income);
  set('state', applicant.state);
  set('district', applicant.district);
  set('tehsil', (applicant as unknown as { tehsil?: string | null }).tehsil);
  set('village', (applicant as unknown as { village?: string | null }).village);
  set('lat', applicant.lat);
  set('lng', applicant.lng);
  set('intent', applicant.intent);
  set('purpose', applicant.purpose);
  set('project_cost', applicant.project_cost);
  set('own_funds', applicant.own_funds_available);
  set('tenure', applicant.requested_tenure_months);
  set('moratorium', applicant.requested_moratorium_months);
  set('notes', applicant.notes);

  if (applicant.education) {
    const { admission_confirmed, study_location, course_name, course_duration_months } =
      applicant.education;
    if (admission_confirmed !== null) set('edu_admission', admission_confirmed ? 'yes' : 'no');
    set('edu_location', study_location);
    set('edu_course', course_name);
    set('edu_duration', course_duration_months);
  }

  for (const code of applicant.documents_available) params.append('doc', code);

  return params;
}
