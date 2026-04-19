import { Worker } from "bullmq";
import { runIngestion } from "./pipeline.js";
import { readUpload } from "./read-upload.js";
import { bullmqConnectionFromEnv } from "./redis-connection.js";

export const INGESTION_QUEUE = "ingestion" as const;

export type IngestionJobData = {
  storageKey: string;
  docId: string;
  orgId: string;
  mimeType: string;
  filename: string;
};

/**
 * Redis-backed BullMQ worker: load bytes from storage → `runIngestion`.
 * Run as a **separate Node process** (not inside Next.js).
 */
export function createIngestionWorker(): Worker<IngestionJobData> {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const pineconeApiKey = process.env.PINECONE_API_KEY;
  const pineconeIndexName = process.env.PINECONE_INDEX_NAME;

  if (!openaiApiKey || !pineconeApiKey || !pineconeIndexName) {
    console.warn(
      "[ingestion-worker] Missing OPENAI_API_KEY, PINECONE_API_KEY, or PINECONE_INDEX_NAME — jobs will fail until set."
    );
  }

  const worker = new Worker<IngestionJobData>(
    INGESTION_QUEUE,
    async (job) => {
      const { storageKey, docId, orgId, mimeType, filename } = job.data;

      if (!openaiApiKey || !pineconeApiKey || !pineconeIndexName) {
        throw new Error("Missing OpenAI or Pinecone configuration");
      }

      const buffer = await readUpload(storageKey);

      return runIngestion({
        buffer,
        mimeType,
        filename,
        docId,
        orgId,
        openaiApiKey,
        pineconeApiKey,
        pineconeIndexName,
      });
    },
    { connection: bullmqConnectionFromEnv() }
  );

  console.log(`[ingestion-worker] Listening on queue "${INGESTION_QUEUE}"`);
  return worker;
}
