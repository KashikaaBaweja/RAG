import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Shared base for TS packages and apps (extend in app with Next rules). */
export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "dist/**", ".turbo/**"],
  }
);
