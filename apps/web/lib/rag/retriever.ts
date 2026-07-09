import { BaseRetriever } from "@langchain/core/retrievers";
import type { CallbackManagerForRetrieverRun } from "@langchain/core/callbacks/manager";
import { Document } from "@langchain/core/documents";
import { Pinecone } from "@pinecone-database/pinecone";
import { embedTexts } from "@rag/ingestion";
import type { RagEnv, RetrievedChunk } from "./types";

const RRF_K = 60;

function tokenize(s: string): string[] {
  return s.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [];
}

/** Lightweight lexical signal over chunk text (sparse leg of hybrid search). */
export function lexicalOverlap(query: string, text: string): number {
  const q = new Set(tokenize(query));
  if (q.size === 0) return 0;
  let hits = 0;
  for (const t of tokenize(text)) {
    if (q.has(t)) hits += 1;
  }
  return hits;
}

/** Reciprocal Rank Fusion across ordered id lists. */
export function reciprocalRankFusion(rankLists: string[][], k = RRF_K): Map<string, number> {
  const scores = new Map<string, number>();
  for (const list of rankLists) {
    list.forEach((id, rank) => {
      scores.set(id, (scores.get(id) ?? 0) + 1 / (k + rank + 1));
    });
  }
  return scores;
}

function asString(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v);
}

function asNumber(v: unknown): number {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 1;
}

type QdrantPoint = {
  id?: string | number;
  score?: number;
  payload?: Record<string, unknown>;
};

type QdrantSearchResponse = {
  result?: QdrantPoint[];
};

export type HybridRetrieveParams = RagEnv & {
  query: string;
  /** Pinecone dense candidates before fusion. */
  fetchK?: number;
  /** Final chunks after fusion + rerank. */
  topK?: number;
};

export type HybridRetrieverConfig = Omit<HybridRetrieveParams, "query">;

/**
 * Dense Pinecone query + lexical re-ranking on returned texts, fused with RRF,
 * then a small weighted rerank (dense + lexical + RRF).
 */
export async function hybridRetrieve(params: HybridRetrieveParams): Promise<RetrievedChunk[]> {
  const fetchK = params.fetchK ?? 32;
  const topK = params.topK ?? 8;

  const [embedding] = await embedTexts([params.query], {
    provider: params.embeddingProvider,
    apiKey: params.openaiApiKey,
    baseUrl: params.ollamaBaseUrl,
    model: params.ollamaEmbeddingModel,
  });

  const matches =
    params.vectorProvider === "qdrant"
      ? await queryQdrant(params, embedding, fetchK)
      : await queryPinecone(params, embedding, fetchK);

  const byId = new Map<
    string,
    { text: string; docId: string; page: number; chunkIndex: number; dense: number }
  >();

  const denseOrder: string[] = [];
  for (const m of matches) {
    const id = m.id;
    if (!id) continue;
    byId.set(id, {
      text: m.text,
      docId: m.docId,
      page: m.page,
      chunkIndex: m.chunkIndex,
      dense: m.score,
    });
    denseOrder.push(id);
  }

  if (denseOrder.length === 0) return [];

  const lexicalOrder = [...denseOrder].sort(
    (a, b) => lexicalOverlap(params.query, byId.get(b)!.text) - lexicalOverlap(params.query, byId.get(a)!.text)
  );

  const rrf = reciprocalRankFusion([denseOrder, lexicalOrder]);
  const maxDense = Math.max(1e-9, ...[...byId.values()].map((v) => v.dense));
  const maxLex = Math.max(
    1,
    ...denseOrder.map((id) => lexicalOverlap(params.query, byId.get(id)!.text))
  );

  const scored = denseOrder.map((id) => {
    const row = byId.get(id)!;
    const rrfScore = rrf.get(id) ?? 0;
    const lexN = lexicalOverlap(params.query, row.text) / maxLex;
    const denseN = row.dense / maxDense;
    const rerank = 0.45 * rrfScore + 0.35 * denseN + 0.2 * lexN;
    return { id, rerank, row };
  });

  scored.sort((a, b) => b.rerank - a.rerank);
  const picked = scored.slice(0, topK);

  return picked.map(({ id, row, rerank }) => ({
    id,
    text: row.text,
    docId: row.docId,
    page: row.page,
    chunkIndex: row.chunkIndex,
    denseScore: rerank,
  }));
}

type VectorMatch = {
  id: string;
  text: string;
  docId: string;
  page: number;
  chunkIndex: number;
  score: number;
};

async function queryPinecone(
  params: HybridRetrieveParams,
  embedding: number[],
  fetchK: number
): Promise<VectorMatch[]> {
  if (!params.pineconeApiKey || !params.pineconeIndexName) {
    throw new Error("PINECONE_API_KEY and PINECONE_INDEX_NAME are required when RAG_VECTOR_PROVIDER=pinecone");
  }

  const pc = new Pinecone({ apiKey: params.pineconeApiKey });
  const ns = pc.index(params.pineconeIndexName).namespace(params.orgId);

  const res = await ns.query({
    vector: embedding,
    topK: fetchK,
    includeMetadata: true,
  });

  return (res.matches ?? []).flatMap((m) => {
    if (!m.id) return [];
    const meta = m.metadata ?? {};
    return [{
      id: m.id,
      text: asString(meta.text),
      docId: asString(meta.docId),
      page: asNumber(meta.page),
      chunkIndex: asNumber(meta.chunkIndex),
      score: typeof m.score === "number" ? m.score : 0,
    }];
  });
}

async function queryQdrant(
  params: HybridRetrieveParams,
  embedding: number[],
  fetchK: number
): Promise<VectorMatch[]> {
  const baseUrl = (params.qdrantUrl ?? "http://127.0.0.1:6333").replace(/\/+$/, "");
  const collection = params.qdrantCollection ?? "rag_chunks";
  const res = await fetch(`${baseUrl}/collections/${collection}/points/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(params.qdrantApiKey ? { "api-key": params.qdrantApiKey } : {}),
    },
    body: JSON.stringify({
      vector: embedding,
      limit: fetchK,
      with_payload: true,
      filter: {
        must: [
          {
            key: "orgId",
            match: { value: params.orgId },
          },
        ],
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (res.status === 404 && body.includes("doesn't exist")) {
      return [];
    }
    throw new Error(`Qdrant search failed: ${res.status} ${body}`);
  }

  const json = (await res.json()) as QdrantSearchResponse;
  return (json.result ?? []).flatMap((point) => {
    const payload = point.payload ?? {};
    const id = asString(payload.chunkId || point.id);
    if (!id) return [];
    return [{
      id,
      text: asString(payload.text),
      docId: asString(payload.docId),
      page: asNumber(payload.page),
      chunkIndex: asNumber(payload.chunkIndex),
      score: typeof point.score === "number" ? point.score : 0,
    }];
  });
}

/** LangChain retriever: hybrid search + rerank, exposed as `Document[]`. */
export class HybridSearchRetriever extends BaseRetriever {
  lc_namespace = ["web", "rag"];

  constructor(private readonly cfg: Omit<HybridRetrieveParams, "query">) {
    super();
  }

  async _getRelevantDocuments(
    query: string,
    _runManager?: CallbackManagerForRetrieverRun
  ): Promise<Document[]> {
    void _runManager;
    const chunks = await hybridRetrieve({ ...this.cfg, query });
    return chunks.map(
      (c) =>
        new Document({
          pageContent: c.text,
          metadata: {
            chunkId: c.id,
            docId: c.docId,
            page: c.page,
            chunkIndex: c.chunkIndex,
          },
        })
    );
  }
}
