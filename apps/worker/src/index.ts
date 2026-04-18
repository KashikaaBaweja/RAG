import "dotenv/config";
import { Worker } from "bullmq";
import { runIngestion } from "@rag/ingestion";
import { readUpload } from "./storage.js";

const INGESTION_QUEUE = "ingestion";

function redisConnection(): { host: string; port: number } {
  const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: parsed.port ? Number(parsed.port) : 6379,
    };
  } catch {
    return { host: "127.0.0.1", port: 6379 };
  }
}

const connection = {
  ...redisConnection(),
  maxRetriesPerRequest: null,
};

const openaiApiKey = process.env.OPENAI_API_KEY;
const pineconeApiKey = process.env.PINECONE_API_KEY;
const pineconeIndexName = process.env.PINECONE_INDEX_NAME;

if (!openaiApiKey || !pineconeApiKey || !pineconeIndexName) {
  console.warn(
    "[worker] Missing OPENAI_API_KEY, PINECONE_API_KEY, or PINECONE_INDEX_NAME — ingestion jobs will fail until set."
  );
}

new Worker(
  INGESTION_QUEUE,
  async (job) => {
    const { storageKey, docId, orgId, mimeType, filename } = job.data as {
      storageKey: string;
      docId: string;
      orgId: string;
      mimeType: string;
      filename: string;
    };

    if (!openaiApiKey || !pineconeApiKey || !pineconeIndexName) {
      throw new Error("Missing OpenAI or Pinecone configuration");
    }

    const buffer = await readUpload(storageKey);

    const result = await runIngestion({
      buffer,
      mimeType,
      filename,
      docId,
      orgId,
      openaiApiKey,
      pineconeApiKey,
      pineconeIndexName,
    });

    return result;
  },
  { connection }
);

console.log(`[worker] Listening on queue "${INGESTION_QUEUE}"`);
