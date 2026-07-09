import { config } from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient } from "@prisma/client";
import { createIngestionWorker } from "@rag/ingestion";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: resolve(root, ".env") });
config({ path: resolve(root, "apps/web/.env.local"), override: true });

const prisma = new PrismaClient();

createIngestionWorker(async (orgId, docId, status) => {
  try {
    await prisma.document.updateMany({
      where: { orgId, docId },
      data: { status },
    });
  } catch (e) {
    console.warn("[worker] Failed to update document status:", e);
  }
});
