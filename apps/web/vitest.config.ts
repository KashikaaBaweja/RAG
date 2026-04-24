import path from "path";
import { fileURLToPath } from "url";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    testTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@": root,
      "@rag/ingestion": path.resolve(root, "../../packages/ingestion/src/index.ts"),
    },
  },
});
