/**
 * scripts/check-boundaries.mjs
 *
 * CLAUDE.md, architectural boundary: src/core/ must not import from src/llm/,
 * src/app/ or src/components/.
 *
 * Its purity is the reason we can defend our numbers. A core module that reaches
 * into the UI or the model adapter can no longer be reasoned about as a function
 * of its inputs, and the two invariants stop being checkable.
 *
 * Deliberately a plain Node script with no dependencies, so it runs in CI before
 * anything is installed beyond npm ci, and so a team member can read the whole
 * rule in one screen.
 *
 * Run: npm run check:boundaries
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const CORE = join(ROOT, 'src', 'core');

/** Import specifiers the core may never reach for, and why. */
const FORBIDDEN = [
  { test: /(^|\/)src\/llm(\/|$)/, label: 'src/llm', why: 'the core must not depend on the language model adapter' },
  { test: /(^|\/)src\/app(\/|$)/, label: 'src/app', why: 'the core must not depend on routing or React' },
  { test: /(^|\/)src\/components(\/|$)/, label: 'src/components', why: 'the core must not depend on the UI' },
  { test: /^@\/llm(\/|$)/, label: '@/llm', why: 'the core must not depend on the language model adapter' },
  { test: /^@\/app(\/|$)/, label: '@/app', why: 'the core must not depend on routing or React' },
  { test: /^@\/components(\/|$)/, label: '@/components', why: 'the core must not depend on the UI' },
  { test: /^next(\/|$)/, label: 'next', why: 'the core must be runnable outside Next.js' },
  { test: /^react(-dom)?(\/|$)/, label: 'react', why: 'the core must be runnable outside React' },
  { test: /^@prisma\/client$/, label: '@prisma/client', why: 'the core takes data as arguments; loading is src/lib/dataset.ts' },
  { test: /^node:fs$/, label: 'node:fs', why: 'the core must not read files — hard rule 9 and testability' },
  { test: /^fs$/, label: 'fs', why: 'the core must not read files — hard rule 9 and testability' },
];

/**
 * Relative imports that climb out of src/core/. `../types` is fine, `../../llm/x`
 * is not, and the FORBIDDEN list above cannot see it because the specifier has no
 * src/ prefix.
 */
function escapesCore(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;
  const fromDir = join(fromFile, '..');
  const resolved = join(fromDir, specifier);
  const rel = relative(CORE, resolved);
  if (rel.startsWith('..')) {
    return `resolves to ${relative(ROOT, resolved).split(sep).join('/')}, which is outside src/core/`;
  }
  return null;
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g;
const REQUIRE_RE = /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
const DYNAMIC_RE = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const violations = [];

for (const file of walk(CORE)) {
  const source = readFileSync(file, 'utf8');
  const shown = relative(ROOT, file).split(sep).join('/');

  const specifiers = new Set();
  for (const re of [IMPORT_RE, REQUIRE_RE, DYNAMIC_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(source)) !== null) specifiers.add(match[1]);
  }

  for (const specifier of specifiers) {
    for (const rule of FORBIDDEN) {
      if (rule.test.test(specifier)) {
        violations.push(`${shown}\n    imports '${specifier}' (${rule.label}) — ${rule.why}`);
      }
    }
    const escape = escapesCore(file, specifier);
    if (escape) violations.push(`${shown}\n    imports '${specifier}' — ${escape}`);
  }
}

if (violations.length > 0) {
  console.error('\nBoundary violations in src/core/:\n');
  for (const violation of violations) console.error(`  ${violation}\n`);
  console.error(
    'src/core/ is pure, synchronous, dependency-light TypeScript. Move the dependency\n' +
      'to src/lib/ and pass the data in as an argument instead.\n',
  );
  process.exit(1);
}

console.log('Boundary check passed: src/core/ imports nothing from llm/, app/, components/, Next, React or the filesystem.');
