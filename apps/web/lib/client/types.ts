/** Client-safe shapes (avoid pulling server-only deps into the browser bundle). */
export type CitationPayload = {
  chunkId: string;
  docId: string;
  page: number;
  chunkIndex: number;
  snippet: string;
};

export type UploadedDocRecord = {
  docId: string;
  orgId: string;
  filename: string;
  storageKey: string;
  mimeType: string;
  createdAt: string;
};

export type RecentQueryRecord = {
  id: string;
  query: string;
  preview: string;
  at: string;
};
