/**
 * src/app/api/intake/route.ts
 *
 * POST /api/intake
 *
 * The one place the guided form hands over an applicant profile. It exists so
 * the profile never travels in a URL: the form posts here, this route validates
 * it, stores it in an HttpOnly cookie, and redirects to the page that needs it.
 *
 * Two request shapes are accepted:
 *
 *   - form posts from the no-JS guided form (multipart or urlencoded)
 *   - JSON posts from the free-text extractor (and any future client)
 *
 * The form path is the important one. CLAUDE.md hard rule 10 says the target
 * user is on a low-end phone and hard rule 5 says the guided flow must work
 * with the LLM off. A plain `<form method="post">` and a 303 redirect preserve
 * both, while keeping the answers out of history, logs and Referer headers.
 */

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { ApplicantProfileSchema, type ApplicantProfile } from '@/core/types';
import { parseApplicantParams } from '@/lib/applicant-params';
import {
  PROFILE_COOKIE,
  encodeProfile,
  formDataToParams,
  profileCookieOptions,
  safeIntakeDestination,
} from '@/lib/intake-params';

export const dynamic = 'force-dynamic';

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // curl and some very old browsers omit it.
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function withProfileCookie(response: NextResponse, applicant: ApplicantProfile): NextResponse {
  response.cookies.set(PROFILE_COOKIE, encodeProfile(applicant), profileCookieOptions());
  return response;
}

export async function POST(request: Request): Promise<NextResponse> {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Cross-origin intake is not allowed.' }, { status: 403 });
  }

  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('application/json')) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = ApplicantProfileSchema.safeParse(
      body && typeof body === 'object' && 'applicant' in body
        ? (body as { applicant: unknown }).applicant
        : body,
    );
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid applicant', details: parsed.error.flatten() }, { status: 400 });
    }

    return withProfileCookie(NextResponse.json({ ok: true }), parsed.data);
  }

  let destination = safeIntakeDestination(null);
  let applicant;
  try {
    const formData = await request.formData();
    destination = safeIntakeDestination(
      typeof formData.get('next') === 'string' ? (formData.get('next') as string) : null,
    );
    applicant = parseApplicantParams(formDataToParams(formData));
  } catch (error) {
    if (error instanceof ZodError) {
      // No profile is stored, and no answers are echoed back. ?invalid=1 only
      // switches /result to its existing "unreadable link" notice.
      return NextResponse.redirect(new URL('/result?invalid=1', request.url), 303);
    }
    throw error;
  }

  const response = NextResponse.redirect(new URL(destination, request.url), 303);
  return withProfileCookie(response, applicant);
}
