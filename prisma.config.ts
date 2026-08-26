/**
 * prisma.config.ts
 *
 * Prisma 7 no longer reads the connection string from schema.prisma. The CLI
 * (`prisma migrate`, `prisma db push`, `prisma studio`) reads it from here.
 *
 * The URL is passed only when DATABASE_URL is actually set, and that shape is
 * deliberate. Prisma's own `env()` helper throws while *loading this file* if the
 * variable is missing, which takes down `prisma generate` too — and generating
 * the client is what makes `npm run typecheck` pass. Five of six laptops on this
 * team have no Supabase credentials, so a config that cannot load without them
 * would mean nobody can typecheck the project. With the spread below, `generate`
 * works offline and only the commands that genuinely need a database fail, with a
 * connection error that says so.
 *
 * Nothing falls back to a local default. A silent fallback would give each
 * developer their own quietly divergent database.
 *
 * The engine does not go through Prisma at all today: src/core/ reads plain
 * objects, src/lib/dataset.ts builds them from data/*.json, and the whole test
 * suite runs with no database. That is why `npm run test` needs no service and
 * why the boundary check can assert src/core/ imports nothing but TypeScript.
 */

import { defineConfig } from 'prisma/config';

const databaseUrl = process.env.DATABASE_URL;

export default defineConfig({
  schema: 'prisma/schema.prisma',
  ...(databaseUrl ? { datasource: { url: databaseUrl } } : {}),
  migrations: {
    // Runs after `prisma migrate dev` / `prisma migrate reset`. Same script as
    // `npm run seed`, so there is one seeding path rather than two that drift.
    seed: 'tsx prisma/seed.ts',
  },
});
