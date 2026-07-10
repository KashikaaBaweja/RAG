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

export type DocumentStatusUpdater = (
  orgId: string,
  docId: string,
  status: "READY" | "FAILED"
) => Promise<void>;

function parseEmbeddingProvider(
  raw: string | undefined
): "openai" | "ollama" | "gemini" {
  if (raw === "openai" || raw === "gemini" || raw === "ollama") return raw;
  return "ollama";
}

/** Pinecone wins when credentials exist; otherwise Qdrant. Explicit env overrides. */
function resolveVectorProvider(): "pinecone" | "qdrant" {
  const explicit = process.env.RAG_VECTOR_PROVIDER;
  const hasPinecone = Boolean(
    process.env.PINECONE_API_KEY?.trim() && process.env.PINECONE_INDEX_NAME?.trim()
  );
  if (explicit === "pinecone") return "pinecone";
  if (explicit === "qdrant") return "qdrant";
  return hasPinecone ? "pinecone" : "qdrant";
}

/**
 * Redis-backed BullMQ worker: load bytes from storage → `runIngestion`.
 * Run as a **separate Node process** (not inside Next.js).
 *
 * Optional `onStatus` keeps Postgres document rows in sync without coupling
 * this package to Prisma (which must be generated before typecheck).
 */
export function createIngestionWorker(
  onStatus?: DocumentStatusUpdater
): Worker<IngestionJobData> {
  const embeddingProvider = parseEmbeddingProvider(process.env.RAG_EMBEDDING_PROVIDER);
  const vectorProvider = resolveVectorProvider();
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const geminiApiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const pineconeApiKey = process.env.PINECONE_API_KEY;
  const pineconeIndexName = process.env.PINECONE_INDEX_NAME;
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL;
  const ollamaEmbeddingModel = process.env.OLLAMA_EMBEDDING_MODEL;
  const geminiEmbeddingModel = process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001";
  const qdrantUrl = process.env.QDRANT_URL;
  const qdrantCollection = process.env.QDRANT_COLLECTION;
  const qdrantApiKey = process.env.QDRANT_API_KEY;

  if (embeddingProvider === "openai" && !openaiApiKey) {
    console.warn("[ingestion-worker] Missing OPENAI_API_KEY — jobs will fail until set.");
  }
  if (embeddingProvider === "gemini" && !geminiApiKey) {
    console.warn("[ingestion-worker] Missing GEMINI_API_KEY — jobs will fail until set.");
  }

  if (vectorProvider === "pinecone" && (!pineconeApiKey || !pineconeIndexName)) {
    console.warn(
      "[ingestion-worker] Missing PINECONE_API_KEY or PINECONE_INDEX_NAME — jobs will fail until set."
    );
  }

  const worker = new Worker<IngestionJobData>(
    INGESTION_QUEUE,
    async (job) => {
      const { storageKey, docId, orgId, mimeType, filename } = job.data;

      if (embeddingProvider === "openai" && !openaiApiKey) {
        throw new Error("Missing OpenAI configuration");
      }
      if (embeddingProvider === "gemini" && !geminiApiKey) {
        throw new Error("Missing Gemini configuration");
      }

      if (vectorProvider === "pinecone" && (!pineconeApiKey || !pineconeIndexName)) {
        throw new Error("Missing Pinecone configuration");
      }

      try {
        const buffer = await readUpload(storageKey);

        const result = await runIngestion({
          buffer,
          mimeType,
          filename,
          docId,
          orgId,
          embeddingProvider,
          vectorProvider,
          openaiApiKey,
          geminiApiKey,
          pineconeApiKey,
          pineconeIndexName,
          ollamaBaseUrl,
          ollamaEmbeddingModel,
          geminiEmbeddingModel,
          qdrantUrl,
          qdrantCollection,
          qdrantApiKey,
        });

        await onStatus?.(orgId, docId, "READY");
        console.log(
          `[ingestion-worker] Indexed ${filename} (${result.chunkCount} chunks) via ${vectorProvider}`
        );
        return result;
      } catch (e) {
        await onStatus?.(orgId, docId, "FAILED");
        throw e;
      }
    },
    { connection: bullmqConnectionFromEnv() }
  );

  worker.on("failed", (job, err) => {
    console.error(
      `[ingestion-worker] Job ${job?.id} failed:`,
      err?.message ?? err
    );
  });

  console.log(
    `[ingestion-worker] Listening on queue "${INGESTION_QUEUE}" (embeddings=${embeddingProvider}, vectors=${vectorProvider})`
  );
  return worker;
}
