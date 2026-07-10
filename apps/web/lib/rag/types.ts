export type LlmProvider = "openai" | "ollama" | "gemini";
export type EmbeddingProvider = LlmProvider;

export type RagEnv = {
  embeddingProvider: EmbeddingProvider;
  /** Chat/completions provider (defaults to embeddingProvider when unset in callers). */
  chatProvider: LlmProvider;
  vectorProvider: "pinecone" | "qdrant";
  openaiApiKey?: string;
  geminiApiKey?: string;
  pineconeApiKey?: string;
  pineconeIndexName?: string;
  ollamaBaseUrl?: string;
  ollamaEmbeddingModel?: string;
  ollamaChatModel?: string;
  geminiChatModel?: string;
  geminiEmbeddingModel?: string;
  qdrantUrl?: string;
  qdrantCollection?: string;
  qdrantApiKey?: string;
  orgId: string;
};

export type RetrievedChunk = {
  id: string;
  text: string;
  docId: string;
  page: number;
  chunkIndex: number;
  denseScore: number;
};
