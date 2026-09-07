'use client';

import { useState } from 'react';

export function AdminLogin() {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get('password') ?? '');
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        location.reload();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? 'Sign in failed');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="sheet mt-4 px-4 py-4">
      <h2 className="text-ink font-serif text-sm font-semibold">Admin sign in</h2>
      <p className="text-ink-2 mt-1 text-xs leading-relaxed">
        Single password from <span className="num">ADMIN_PASSWORD</span> in <span className="num">.env</span>. No user accounts — this screen is the only protected route.
      </p>
      {error ? <p className="text-fail mt-2 text-xs" role="alert">{error}</p> : null}
      <label htmlFor="admin-password" className="text-ink mt-3 block text-xs font-medium">Password</label>
      <input
        id="admin-password"
        name="password"
        type="password"
        required
        className="border-rule bg-paper mt-1 w-full max-w-sm border px-3 py-2 text-sm"
        placeholder="••••••••"
        autoComplete="current-password"
      />
      <button type="submit" disabled={loading} className="bg-accent text-paper mt-3 inline-flex items-center px-4 py-2 text-sm font-medium disabled:opacity-50">
        {loading ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="text-ink-3 mt-2 text-[0.6875rem]">
        Default local password is <span className="num">rinsetu-admin</span> unless you set <span className="num">ADMIN_PASSWORD</span>. Cookie lasts 8 hours.
      </p>
    </form>
  );
}

export function AdminSignOut() {
  const [loading, setLoading] = useState(false);
  async function onClick() {
    setLoading(true);
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
      location.reload();
    } finally {
      setLoading(false);
    }
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="border-rule-strong text-ink hover:bg-paper-sunk mt-3 inline-flex items-center border px-3 py-2 text-xs font-medium disabled:opacity-50"
    >
      {loading ? 'Signing out…' : 'Sign out'}
    </button>
  );
}
