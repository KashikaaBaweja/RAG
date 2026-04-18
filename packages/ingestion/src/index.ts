export { chunkText } from "./chunker.js";
export { embedTexts, type EmbedderOptions } from "./embedder.js";
export { loadDocument, type LoaderInput } from "./loader.js";
export {
  upsertVectors,
  type UpsertRecord,
  type VectorMetadata,
} from "./pinecone.js";
export { runIngestion, type RunIngestionParams, type RunIngestionResult } from "./pipeline.js";
