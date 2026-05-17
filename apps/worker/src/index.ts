import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createIngestionWorker } from "@rag/ingestion";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(root, ".env") });
config({ path: resolve(root, "apps/web/.env.local"), override: true });

createIngestionWorker();
