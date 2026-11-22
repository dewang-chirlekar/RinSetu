/**
 * src/lib/intake-params.ts
 *
 * Small, pure helpers shared by the POST intake route and the pages that read
 * the profile back. Nothing here touches Next.js, so it is safe to import from
 * tests and from client components.
 *
 * The intake form used to submit with GET, which put the applicant's name,
 * income, caste, age and district into the URL. That URL then leaked into
 * browser history, server access logs, and the Referer header of any third
 * party asset. The form now POSTs to /api/intake, which stores the validated
 * profile in an HttpOnly cookie and redirects to /result. These helpers are the
 * bridge between multipart/form-urlencoded bodies, plain profiles and the
 * query-string shape the existing form already understands.
 */

import { applicantToParams } from './applicant-params';
import type { ApplicantProfile } from '@/core/types';

export type RawParams = Record<string, string | string[] | undefined>;

/** Cookie name. Not namespaced by locale: the profile is the same in every language. */
export const PROFILE_COOKIE = 'rinsetu_profile';

/** Two hours is long enough to review, download a packet and save a receipt. */
export const PROFILE_MAX_AGE_SECONDS = 60 * 60 * 2;

/**
 * Cookie attributes for the profile. `httpOnly` keeps it out of client-side JS,
 * `sameSite: 'lax'` lets the top-level POST redirect carry it while blocking
 * cross-site reads, and `secure` is on in production only so local HTTP still
 * works.
 */
export function profileCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: PROFILE_MAX_AGE_SECONDS,
    priority: 'high' as const,
  };
}

export function encodeProfile(profile: ApplicantProfile): string {
  return JSON.stringify(profile);
}

/**
 * Turns a submitted form body into the RawParams shape `parseApplicantParams`
 * already validates. Repeated names (the document checkboxes) become arrays
 * instead of being flattened to the last value.
 */
export function formDataToParams(formData: FormData): RawParams {
  const params: RawParams = {};

  for (const key of formData.keys()) {
    const values = formData.getAll(key).filter((value): value is string => typeof value === 'string');
    if (values.length === 0) continue;
    params[key] = values.length === 1 ? values[0] : values;
  }

  return params;
}

/**
 * The inverse of `formDataToParams`, scoped to a validated profile. Used to
 * pre-fill the guided form from the cookie without ever putting the values in
 * the URL.
 */
export function profileToParams(profile: ApplicantProfile): RawParams {
  const search = applicantToParams(profile);
  const params: RawParams = {};

  for (const [key, value] of search.entries()) {
    const existing = params[key];
    if (existing === undefined) params[key] = value;
    else if (Array.isArray(existing)) existing.push(value);
    else params[key] = [existing, value];
  }

  return params;
}

/**
 * Only three destinations are allowed after the intake POST. Keeping this an
 * allow-list, rather than "any path beginning with /", rules out protocol
 * relative redirects and accidental open redirects from a tampered hidden
 * field.
 */
export const INTAKE_DESTINATIONS = ['/result', '/apply', '/api/packet'] as const;

export type IntakeDestination = (typeof INTAKE_DESTINATIONS)[number];

export function safeIntakeDestination(value: string | null | undefined): IntakeDestination {
  return INTAKE_DESTINATIONS.includes(value as IntakeDestination)
    ? (value as IntakeDestination)
    : '/result';
}
