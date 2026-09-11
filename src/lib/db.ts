/**
 * src/lib/db.ts
 *
 * Single PrismaClient for Next.js. Lives outside src/core/ so the engine
 * stays pure — the database is an input to recommend(), never a participant.
 *
 * Prisma 7 requires a driver adapter. Supabase pooler uses a self-signed chain
 * that Node 24 + pg v8 rejects when sslmode=require is treated as verify-full,
 * so we strip sslmode from the URL and use ssl:{rejectUnauthorized:false},
 * matching prisma/seed.ts:53 and src/app/api/admin/health-apply/route.ts:40.
 *
 * In dev, Next.js hot reloads modules; a plain `new PrismaClient()` per import
 * would exhaust pool connections. Stash on globalThis like the Prisma docs
 * recommend.
 */

import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

declare global {
  var __RINSETU_PRISMA__: PrismaClient | undefined;
  var __RINSETU_POOL__: pg.Pool | undefined;
}

function connectionStringOrNull(): string | null {
  const raw = process.env.DATABASE_URL;
  if (!raw || raw.trim() === '') return null;
  return raw.trim();
}

function makePool(connectionString: string): pg.Pool {
  const clean = connectionString.replace(/[?&]sslmode=[^&]*/g, '').replace(/[?&]$/, '').replace(/\?$/, '');
  return new pg.Pool({ connectionString: clean, ssl: { rejectUnauthorized: false } });
}

export function hasDatabaseUrl(): boolean {
  return connectionStringOrNull() !== null;
}

export function getPrisma(): PrismaClient {
  const cs = connectionStringOrNull();
  if (!cs) {
    throw new Error('DATABASE_URL is not set — cannot access Postgres.');
  }
  if (globalThis.__RINSETU_PRISMA__) return globalThis.__RINSETU_PRISMA__;
  const pool = globalThis.__RINSETU_POOL__ ?? makePool(cs);
  globalThis.__RINSETU_POOL__ = pool;
  const client = new PrismaClient({ adapter: new PrismaPg(pool) });
  globalThis.__RINSETU_PRISMA__ = client;
  return client;
}

/**
 * True for errors that mean "DB unreachable" rather than a query bug.
 * Mirrors the check in tests/dataset-db.parity.test.ts and admin routes so
 * callers can turn them into a 503 / skipped check instead of a 500.
 */
export function isDbUnreachableError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /can't reach database server/i.test(msg) ||
    /connect (ETIMEDOUT|ECONNREFUSED)/i.test(msg) ||
    /getaddrinfo (ENOTFOUND|EAI_AGAIN)/i.test(msg) ||
    /connection.*timeout/i.test(msg) ||
    /Connection terminated/i.test(msg) ||
    /self.signed certificate/i.test(msg)
  );
}
