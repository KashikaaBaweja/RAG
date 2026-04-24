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
  openaiApiKey: string;
  pineconeApiKey: string;
  pineconeIndexName: string;
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

  const chunks = (await chunkText(text)).map((c) => scrubPiiFromText(c));
  const embeddings = await embedTexts(chunks, {
    apiKey: params.openaiApiKey,
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
    },
  }));

  await upsertVectors(
    params.pineconeApiKey,
    params.pineconeIndexName,
    params.orgId,
    records
  );

  return {
    chunkCount: records.length,
    vectorIds: records.map((r) => r.id),
  };
}
