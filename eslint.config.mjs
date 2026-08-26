import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    // CLAUDE.md, architectural boundary. scripts/check-boundaries.mjs enforces the
    // same rule for CI and catches relative paths that climb out of src/core/;
    // this makes the violation visible in the editor as you type it.
    files: ["src/core/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/llm", "@/llm/*", "**/llm/*"],
              message:
                "src/core/ must not import from src/llm/. The core is deterministic; the model adapter is not.",
            },
            {
              group: ["@/app", "@/app/*", "**/app/*"],
              message: "src/core/ must not import from src/app/.",
            },
            {
              group: ["@/components", "@/components/*", "**/components/*"],
              message: "src/core/ must not import from src/components/.",
            },
            {
              group: ["next", "next/*", "react", "react-dom", "@prisma/client"],
              message:
                "src/core/ must be runnable outside Next, React and Prisma. Load data in src/lib/ and pass it in.",
            },
          ],
        },
      ],
    },
  },
  {
    // Every navigation in RinSetu is a plain <a>, on purpose.
    //
    // CLAUDE.md hard rule 10: the target user is on a low-end phone. next/link
    // ships a client runtime and prefetches routes on hover/viewport — on the
    // persona explorer that is 80 speculative requests for a page whose whole
    // point is that it needs no JavaScript at all. The intake form submits with
    // GET for the same reason, so there is no client-side router to preserve.
    //
    // The rule this disables catches accidental <a> in a next/link codebase. This
    // codebase has no next/link, so there is nothing for it to catch.
    files: ["src/app/**/*.tsx", "src/components/**/*.tsx"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
];

export default eslintConfig;
