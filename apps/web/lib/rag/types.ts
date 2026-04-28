export type RagEnv = {
  embeddingProvider: "openai" | "ollama";
  vectorProvider: "pinecone" | "qdrant";
  openaiApiKey?: string;
  pineconeApiKey?: string;
  pineconeIndexName?: string;
  ollamaBaseUrl?: string;
  ollamaEmbeddingModel?: string;
  ollamaChatModel?: string;
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
