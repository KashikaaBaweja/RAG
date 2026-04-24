import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  /** CWD is often `apps/web` when invoked via `pnpm --filter web test`; keep tests at repo root. */
  root,
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": path.join(root, "apps/web"),
      "@rag/ingestion": path.join(root, "packages/ingestion/src/index.ts"),
    },
  },
});
