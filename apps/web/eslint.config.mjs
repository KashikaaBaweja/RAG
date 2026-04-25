import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";
import base from "@rag/config/eslint.config.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/** Playwright/Vitest + eval helpers are not Next pages; `next/core-web-vitals` often false-positives on them. */
const eslintConfig = [
  {
    ignores: ["tests/**", "evals/**", "playwright.config.ts", "vitest.config.ts"],
  },
  ...base,
  ...compat.extends("next/core-web-vitals"),
];

export default eslintConfig;
