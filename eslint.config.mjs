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
];

export default eslintConfig;
