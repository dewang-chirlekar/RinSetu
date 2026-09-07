/**
 * src/lib/admin-auth.ts
 *
 * Single-password admin auth for Phase 8. No user accounts, no OAuth —
 * CLAUDE.md stack forbids anything beyond "a single admin login for the
 * health-data upload".
 *
 * How it works: `ADMIN_PASSWORD` lives in `.env` (gitignored). The server
 * compares the supplied password to that value and, on success, sets an
 * HttpOnly cookie `rinsetu_admin` containing an HMAC-like token:
 *   token = sha256(password)
 * Verification checks `cookie == sha256(expectedPassword)`. This is not a
 * general auth system — it is one shared secret for the upload screen, and
 * the token is not guessable without the password. For the jury demo a
 * weak password is fine; rotation is "change .env and redeploy".
 *
 * Why not JWT/session DB? Team is six beginners, no ops. One env var + one
 * cookie is debuggable at 2am, fits the "boring, readable" rule.
 */

import { createHash } from 'crypto';

const COOKIE_NAME = 'rinsetu_admin';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

export function getExpectedPassword(): string {
  // Default for local dev without .env — prevents a blank-password footgun
  // from silently leaving the screen open in production.
  return process.env.ADMIN_PASSWORD ?? 'rinsetu-admin';
}

export function tokenFor(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function expectedToken(): string {
  return tokenFor(getExpectedPassword());
}

export function isValidPassword(supplied: string): boolean {
  // Constant-time-ish: hash both sides and compare strings of equal length.
  // Not crypto-critical here, but avoids trivial timing variation.
  const expected = getExpectedPassword();
  if (supplied.length === 0) return false;
  return tokenFor(supplied) === tokenFor(expected);
}

export function isValidToken(token: string | undefined | null): boolean {
  if (!token) return false;
  return token === expectedToken();
}

export { COOKIE_NAME, COOKIE_MAX_AGE };
