import { createHash } from "node:crypto";
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

export type VectorStoreOptions = {
  provider?: "pinecone" | "qdrant";
  pineconeApiKey?: string;
  pineconeIndexName?: string;
  qdrantUrl?: string;
  qdrantCollection?: string;
  qdrantApiKey?: string;
};

/**
 * Upserts vectors into a tenant-isolated namespace/collection.
 */
export async function upsertVectors(options: VectorStoreOptions & {
  orgId: string;
  records: UpsertRecord[];
}): Promise<void> {
  const { orgId, records } = options;
  if (records.length === 0) return;
  const provider = options.provider ?? (options.pineconeApiKey ? "pinecone" : "qdrant");

  if (provider === "qdrant") {
    await upsertQdrantVectors(options);
    return;
  }

  if (!options.pineconeApiKey || !options.pineconeIndexName) {
    throw new Error("PINECONE_API_KEY and PINECONE_INDEX_NAME are required when RAG_VECTOR_PROVIDER=pinecone");
  }

  const pc = new Pinecone({ apiKey: options.pineconeApiKey });
  const index = pc.index(options.pineconeIndexName);
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

function qdrantPointId(id: string): string {
  const hex = createHash("sha256").update(id).digest("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20)}`;
}

function qdrantHeaders(apiKey?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    ...(apiKey ? { "api-key": apiKey } : {}),
  };
}

async function qdrantRequest(
  options: VectorStoreOptions,
  path: string,
  init: { method: string; body?: string }
): Promise<Response> {
  const baseUrl = (options.qdrantUrl ?? "http://127.0.0.1:6333").replace(/\/+$/, "");
  return fetch(`${baseUrl}${path}`, {
    ...init,
    headers: qdrantHeaders(options.qdrantApiKey),
  });
}

async function upsertQdrantVectors(
  options: VectorStoreOptions & { orgId: string; records: UpsertRecord[] }
): Promise<void> {
  const collection = options.qdrantCollection ?? "rag_chunks";
  const vectorSize = options.records[0]?.values.length;
  if (!vectorSize) return;

  const createCollection = await qdrantRequest(options, `/collections/${collection}`, {
    method: "PUT",
    body: JSON.stringify({
      vectors: {
        size: vectorSize,
        distance: "Cosine",
      },
    }),
  });

  if (!createCollection.ok && createCollection.status !== 409) {
    throw new Error(`Qdrant collection setup failed: ${createCollection.status} ${await createCollection.text()}`);
  }

  const upsert = await qdrantRequest(options, `/collections/${collection}/points?wait=true`, {
    method: "PUT",
    body: JSON.stringify({
      points: options.records.map((r) => ({
        id: qdrantPointId(r.id),
        vector: r.values,
        payload: {
          chunkId: r.id,
          docId: r.metadata.docId,
          orgId: r.metadata.orgId,
          page: r.metadata.page,
          chunkIndex: r.metadata.chunkIndex,
          text: r.metadata.text,
        },
      })),
    }),
  });

  if (!upsert.ok) {
    throw new Error(`Qdrant upsert failed: ${upsert.status} ${await upsert.text()}`);
  }
}
