/**
 * Serverless fallback: run ingestion inside the API request when no Redis
 * queue is configured (e.g. on Vercel, where the BullMQ worker cannot run).
 */
import { updateDocumentStatus } from "@/lib/db/knowledgeBase";
import { readUpload } from "@/lib/storage";
import { resolveVectorProvider } from "@/lib/rag/vector-provider";
import { runIngestion } from "@rag/ingestion/pipeline";

export type InlineIngestionJob = {
  storageKey: string;
  docId: string;
  orgId: string;
  mimeType: string;
  filename: string;
};

/** Queue is used only when REDIS_URL is explicitly configured. */
export function isQueueConfigured(): boolean {
  return Boolean(process.env.REDIS_URL?.trim());
}

function parseEmbeddingProvider(
  raw: string | undefined
): "openai" | "ollama" | "gemini" {
  if (raw === "openai" || raw === "gemini" || raw === "ollama") return raw;
  return "ollama";
}

/** Parse → chunk → embed → upsert, then set document READY/FAILED. */
export async function runInlineIngestion(
  job: InlineIngestionJob
): Promise<{ status: "READY" | "FAILED"; chunkCount: number; error?: string }> {
  try {
    const buffer = await readUpload(job.storageKey);

    const embeddingProvider = parseEmbeddingProvider(
      process.env.RAG_EMBEDDING_PROVIDER
    );
    const result = await runIngestion({
      buffer,
      mimeType: job.mimeType,
      filename: job.filename,
      docId: job.docId,
      orgId: job.orgId,
      embeddingProvider,
      vectorProvider: resolveVectorProvider(),
      openaiApiKey: process.env.OPENAI_API_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
      pineconeApiKey: process.env.PINECONE_API_KEY,
      pineconeIndexName: process.env.PINECONE_INDEX_NAME,
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
      ollamaEmbeddingModel: process.env.OLLAMA_EMBEDDING_MODEL,
      geminiEmbeddingModel:
        process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
      qdrantUrl: process.env.QDRANT_URL,
      qdrantCollection: process.env.QDRANT_COLLECTION,
      qdrantApiKey: process.env.QDRANT_API_KEY,
    });

    await updateDocumentStatus(job.orgId, job.docId, "READY");
    return { status: "READY", chunkCount: result.chunkCount };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ingestion failed";
    console.error("[inline-ingestion]", job.filename, message);
    await updateDocumentStatus(job.orgId, job.docId, "FAILED").catch(() => {});
    return { status: "FAILED", chunkCount: 0, error: message };
  }
}
