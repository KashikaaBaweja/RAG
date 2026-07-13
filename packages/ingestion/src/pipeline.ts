import { chunkText } from "./chunker.js";
import { embedTexts } from "./embedder.js";
import { loadDocument } from "./loader.js";
import { scrubPiiFromText } from "./pii-scrub.js";
import { upsertVectors, type UpsertRecord } from "./pinecone.js";

export type RunIngestionParams = {
  buffer: Buffer;
  mimeType: string;
  filename: string;
  docId: string;
  orgId: string;
  embeddingProvider?: "openai" | "ollama" | "gemini";
  vectorProvider?: "pinecone" | "qdrant";
  openaiApiKey?: string;
  geminiApiKey?: string;
  pineconeApiKey?: string;
  pineconeIndexName?: string;
  ollamaBaseUrl?: string;
  ollamaEmbeddingModel?: string;
  geminiEmbeddingModel?: string;
  qdrantUrl?: string;
  qdrantCollection?: string;
  qdrantApiKey?: string;
  /** PDF/DOCX without page map: use 1 for all chunks until per-page loaders exist. */
  defaultPage?: number;
};

export type RunIngestionResult = {
  chunkCount: number;
  vectorIds: string[];
};

/**
 * End-to-end: parse → chunk → embed → Pinecone upsert (namespace = orgId).
 */
export async function runIngestion(
  params: RunIngestionParams
): Promise<RunIngestionResult> {
  const page = params.defaultPage ?? 1;

  const text = await loadDocument({
    buffer: params.buffer,
    mimeType: params.mimeType,
    filename: params.filename,
  });

  // Prefix each chunk with the filename so users can ask about a document by name.
  const chunks = (await chunkText(text)).map(
    (c) => `[File: ${params.filename}]\n${scrubPiiFromText(c)}`
  );
  const embeddings = await embedTexts(chunks, {
    provider: params.embeddingProvider,
    apiKey:
      params.embeddingProvider === "gemini"
        ? params.geminiApiKey
        : params.embeddingProvider === "openai"
          ? params.openaiApiKey
          : undefined,
    baseUrl: params.ollamaBaseUrl,
    model:
      params.embeddingProvider === "gemini"
        ? params.geminiEmbeddingModel
        : params.embeddingProvider === "ollama"
          ? params.ollamaEmbeddingModel
          : undefined,
  });

  const records: UpsertRecord[] = chunks.map((chunkText, chunkIndex) => ({
    id: `${params.docId}:${chunkIndex}`,
    values: embeddings[chunkIndex]!,
    metadata: {
      docId: params.docId,
      orgId: params.orgId,
      page,
      chunkIndex,
      text: chunkText,
      filename: params.filename,
    },
  }));

  await upsertVectors({
    provider: params.vectorProvider,
    pineconeApiKey: params.pineconeApiKey,
    pineconeIndexName: params.pineconeIndexName,
    qdrantUrl: params.qdrantUrl,
    qdrantCollection: params.qdrantCollection,
    qdrantApiKey: params.qdrantApiKey,
    orgId: params.orgId,
    records,
  });

  return {
    chunkCount: records.length,
    vectorIds: records.map((r) => r.id),
  };
}
