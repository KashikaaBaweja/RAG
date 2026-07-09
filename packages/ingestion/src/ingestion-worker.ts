import { Worker } from "bullmq";
import { PrismaClient, type DocumentStatus } from "@prisma/client";
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

const prisma = new PrismaClient();

async function setDocumentStatus(
  orgId: string,
  docId: string,
  status: DocumentStatus
): Promise<void> {
  try {
    await prisma.document.updateMany({
      where: { orgId, docId },
      data: { status },
    });
  } catch (e) {
    console.warn("[ingestion-worker] Failed to update document status:", e);
  }
}

/**
 * Redis-backed BullMQ worker: load bytes from storage → `runIngestion`.
 * Run as a **separate Node process** (not inside Next.js).
 */
export function createIngestionWorker(): Worker<IngestionJobData> {
  const embeddingProvider = process.env.RAG_EMBEDDING_PROVIDER === "openai" ? "openai" : "ollama";
  const vectorProvider = process.env.RAG_VECTOR_PROVIDER === "pinecone" ? "pinecone" : "qdrant";
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const pineconeApiKey = process.env.PINECONE_API_KEY;
  const pineconeIndexName = process.env.PINECONE_INDEX_NAME;
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL;
  const ollamaEmbeddingModel = process.env.OLLAMA_EMBEDDING_MODEL;
  const qdrantUrl = process.env.QDRANT_URL;
  const qdrantCollection = process.env.QDRANT_COLLECTION;
  const qdrantApiKey = process.env.QDRANT_API_KEY;

  if (embeddingProvider === "openai" && !openaiApiKey) {
    console.warn("[ingestion-worker] Missing OPENAI_API_KEY — jobs will fail until set.");
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
          pineconeApiKey,
          pineconeIndexName,
          ollamaBaseUrl,
          ollamaEmbeddingModel,
          qdrantUrl,
          qdrantCollection,
          qdrantApiKey,
        });

        await setDocumentStatus(orgId, docId, "READY");
        console.log(
          `[ingestion-worker] Indexed ${filename} (${result.chunkCount} chunks)`
        );
        return result;
      } catch (e) {
        await setDocumentStatus(orgId, docId, "FAILED");
        throw e;
      }
    },
    {
      connection: bullmqConnectionFromEnv(),
      // Retry when Ollama/Qdrant briefly unavailable
      settings: {},
    }
  );

  worker.on("failed", (job, err) => {
    console.error(
      `[ingestion-worker] Job ${job?.id} failed:`,
      err?.message ?? err
    );
  });

  console.log(`[ingestion-worker] Listening on queue "${INGESTION_QUEUE}"`);
  return worker;
}
