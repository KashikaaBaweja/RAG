import { runIngestion } from "@rag/ingestion";
import { readUpload } from "@/lib/storage";

function parseEmbeddingProvider(
  raw: string | undefined
): "openai" | "ollama" | "gemini" {
  if (raw === "openai" || raw === "gemini" || raw === "ollama") return raw;
  return "ollama";
}

function resolveVectorProvider(): "pinecone" | "qdrant" {
  const explicit = process.env.RAG_VECTOR_PROVIDER;
  const hasPinecone = Boolean(
    process.env.PINECONE_API_KEY?.trim() && process.env.PINECONE_INDEX_NAME?.trim()
  );
  if (explicit === "pinecone") return "pinecone";
  if (explicit === "qdrant") return "qdrant";
  return hasPinecone ? "pinecone" : "qdrant";
}

function runNowConfigured(): boolean {
  return !process.env.REDIS_URL?.trim();
}

export function shouldRunIngestionNow(): boolean {
  return runNowConfigured();
}

type IngestCommon = {
  docId: string;
  orgId: string;
  mimeType: string;
  filename: string;
};

export async function ingestBufferNow(
  params: IngestCommon & { buffer: Buffer }
): Promise<{ chunkCount: number; vectorIds: string[] }> {
  const embeddingProvider = parseEmbeddingProvider(process.env.RAG_EMBEDDING_PROVIDER);
  const vectorProvider = resolveVectorProvider();
  // The ingestion package types may lag behind runtime provider support across workspace builds.
  const ingestionParams: Record<string, unknown> = {
    buffer: params.buffer,
    docId: params.docId,
    orgId: params.orgId,
    mimeType: params.mimeType,
    filename: params.filename,
    embeddingProvider,
    vectorProvider,
    openaiApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY,
    pineconeApiKey: process.env.PINECONE_API_KEY,
    pineconeIndexName: process.env.PINECONE_INDEX_NAME,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
    ollamaEmbeddingModel: process.env.OLLAMA_EMBEDDING_MODEL,
    geminiEmbeddingModel: process.env.GEMINI_EMBEDDING_MODEL ?? "gemini-embedding-001",
    qdrantUrl: process.env.QDRANT_URL,
    qdrantCollection: process.env.QDRANT_COLLECTION,
    qdrantApiKey: process.env.QDRANT_API_KEY,
  };
  return runIngestion(ingestionParams as Parameters<typeof runIngestion>[0]);
}

export async function ingestStoredUploadNow(
  params: IngestCommon & { storageKey: string }
): Promise<{ chunkCount: number; vectorIds: string[] }> {
  const buffer = await readUpload(params.storageKey);
  return ingestBufferNow({
    buffer,
    docId: params.docId,
    orgId: params.orgId,
    mimeType: params.mimeType,
    filename: params.filename,
  });
}
