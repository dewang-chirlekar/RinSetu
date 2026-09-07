/**
 * POST /api/admin/login
 *
 * Body: { password: string } (JSON) or form-data password field.
 * On success sets HttpOnly cookie `rinsetu_admin` and returns {ok:true}.
 * On failure 401 with {error}.
 */

import { NextResponse } from 'next/server';
import { COOKIE_MAX_AGE, COOKIE_NAME, expectedToken, isValidPassword, tokenFor } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let supplied = '';
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const body = (await request.json()) as { password?: string };
      supplied = body.password ?? '';
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
  } else if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
    const fd = await request.formData();
    supplied = String(fd.get('password') ?? '');
  } else {
    // Fallback: try json then formData
    try {
      const body = (await request.clone().json()) as { password?: string };
      supplied = body.password ?? '';
    } catch {
      try {
        const fd = await request.formData();
        supplied = String(fd.get('password') ?? '');
      } catch {
        supplied = '';
      }
    }
  }

  if (!isValidPassword(supplied)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const token = tokenFor(supplied);
  // Double-check token matches expected (defence if env changed mid-request)
  if (token !== expectedToken()) {
    // This should be unreachable if isValidPassword passed, but keep as guard
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
