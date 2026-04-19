export type RagEnv = {
  openaiApiKey: string;
  pineconeApiKey: string;
  pineconeIndexName: string;
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
