/**
 * src/app/admin/health-upload/page.tsx
 *
 * Admin health upload — the Phase 8 screen.
 * Server wrapper checks admin cookie and either shows login or the upload UI.
 * No client auth logic — cookie is HttpOnly, checked on the server.
 */

import { cookies } from 'next/headers';
import { getLocale } from 'next-intl/server';
import { COOKIE_NAME, isValidToken } from '@/lib/admin-auth';
import { AdminHealthUpload } from '@/components/AdminHealthUpload';
import { AdminLogin, AdminSignOut } from '@/components/AdminLogin';

export const dynamic = 'force-dynamic';

export default async function AdminHealthUploadPage() {
  const locale = await getLocale();
  // Needed for translate without explicit locale in child components that run server
  (globalThis as unknown as { __RINSETU_LOCALE__?: string }).__RINSETU_LOCALE__ = locale as string;
  const jar = await cookies();
  const authed = isValidToken(jar.get(COOKIE_NAME)?.value);

  return (
    <div>
      <h1 className="text-ink font-serif text-2xl font-semibold leading-tight">Health data upload</h1>
      <p className="text-ink-2 mt-2 text-sm leading-relaxed">
        Replace the simulated health seed with a real MIS extract. Each row becomes <span className="stamp text-pass">MIS_UPLOAD</span> and the partner ranking updates immediately. Upload is previewed before it writes.
      </p>
      <div className="border-rule bg-paper-sunk mt-3 border-l-[3px] px-3.5 py-2.5 text-xs leading-relaxed">
        <p className="text-ink font-medium">Current data: SIMULATED</p>
        <p className="text-ink-2 mt-1">All 15 health rows in this build are simulated and shown with an amber chip. This upload is the path ROADMAP §7 describes on the day a real MIS export arrives.</p>
      </div>

      {!authed ? (
        <AdminLogin />
      ) : (
        <>
          <AdminSignOut />
          <AdminHealthUpload />
        </>
      )}
    </div>
  );
}
