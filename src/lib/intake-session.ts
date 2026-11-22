/**
 * src/lib/intake-session.ts
 *
 * Reads the validated applicant profile back out of the HttpOnly cookie set by
 * POST /api/intake.
 *
 * The cookie is a trust boundary just like the old query string was: it is
 * user-controlled, so every read goes through ApplicantProfileSchema. A cookie
 * that was hand-edited, truncated by the browser, or left behind by an older
 * version of the schema simply reads as "no profile" instead of crashing the
 * result page.
 */

import { cookies } from 'next/headers';
import { ApplicantProfileSchema, type ApplicantProfile } from '@/core/types';
import { PROFILE_COOKIE } from './intake-params';

export async function readProfileCookie(): Promise<ApplicantProfile | null> {
  const store = await cookies();
  const raw = store.get(PROFILE_COOKIE)?.value;
  if (!raw) return null;

  try {
    const parsed = ApplicantProfileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
