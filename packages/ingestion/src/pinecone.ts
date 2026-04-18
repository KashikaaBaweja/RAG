import { Pinecone } from "@pinecone-database/pinecone";

export type VectorMetadata = {
  docId: string;
  orgId: string;
  page: number;
  chunkIndex: number;
  /** Stored for retrieval / citation display; keep under Pinecone metadata limits. */
  text: string;
};

export type UpsertRecord = {
  id: string;
  values: number[];
  metadata: VectorMetadata;
};

/**
 * Upserts vectors into a namespace prefixed by `orgId` so tenants stay isolated.
 */
export async function upsertVectors(
  apiKey: string,
  indexName: string,
  orgId: string,
  records: UpsertRecord[]
): Promise<void> {
  if (records.length === 0) return;

  const pc = new Pinecone({ apiKey });
  const index = pc.index(indexName);
  const namespace = orgId;

  await index.namespace(namespace).upsert(
    records.map((r) => ({
      id: r.id,
      values: r.values,
      metadata: {
        docId: r.metadata.docId,
        orgId: r.metadata.orgId,
        page: r.metadata.page,
        chunkIndex: r.metadata.chunkIndex,
        text: r.metadata.text.slice(0, 35000),
      },
    }))
  );
}
