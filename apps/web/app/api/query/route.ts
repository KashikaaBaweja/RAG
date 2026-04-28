import { getServerSession } from "next-auth";
import { NextResponse, type NextRequest } from "next/server";
import { authOptions, assertOrgInToken } from "@/lib/auth";
import { createQueryLog } from "@/lib/db/knowledgeBase";
import {
  citationIndexFromDocuments,
  resolveCitations,
  streamRagTokens,
  type RagChainEnv,
} from "@/lib/rag";
import { HybridSearchRetriever } from "@/lib/rag/retriever";
import { ragQueriesTotal, ragQueryLatencySeconds } from "@/lib/telemetry/metrics";
import type { Document } from "@langchain/core/documents";

export const runtime = "nodejs";
export const maxDuration = 120;

type Body = {
  query?: string;
  orgId?: string;
  stream?: boolean;
  history?: { role: "user" | "assistant"; content: string }[];
  fetchK?: number;
  topK?: number;
  model?: string;
};

function requireEnv(): RagChainEnv | NextResponse {
  const embeddingProvider = process.env.RAG_EMBEDDING_PROVIDER === "openai" ? "openai" : "ollama";
  const vectorProvider = process.env.RAG_VECTOR_PROVIDER === "pinecone" ? "pinecone" : "qdrant";
  const openaiApiKey = process.env.OPENAI_API_KEY;
  const pineconeApiKey = process.env.PINECONE_API_KEY;
  const pineconeIndexName = process.env.PINECONE_INDEX_NAME;

  if (embeddingProvider === "openai" && !openaiApiKey) {
    return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
  }

  if (vectorProvider === "pinecone" && (!pineconeApiKey || !pineconeIndexName)) {
    return NextResponse.json(
      { error: "Missing PINECONE_API_KEY or PINECONE_INDEX_NAME" },
      { status: 500 }
    );
  }

  return {
    embeddingProvider,
    vectorProvider,
    openaiApiKey,
    pineconeApiKey,
    pineconeIndexName,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
    ollamaEmbeddingModel: process.env.OLLAMA_EMBEDDING_MODEL,
    ollamaChatModel: process.env.OLLAMA_CHAT_MODEL,
    qdrantUrl: process.env.QDRANT_URL,
    qdrantCollection: process.env.QDRANT_COLLECTION,
    qdrantApiKey: process.env.QDRANT_API_KEY,
    orgId: "",
  };
}

function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
  };
}

/** POST JSON → SSE stream of `{ type, content? }` then `[DONE]`, or JSON when `stream: false`. */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const envOrErr = requireEnv();
  if (envOrErr instanceof NextResponse) return envOrErr;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "Field `query` is required" }, { status: 400 });
  }

  const orgId =
    typeof body.orgId === "string" && body.orgId.length > 0
      ? body.orgId
      : req.headers.get("x-org-id") ?? "";

  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  try {
    assertOrgInToken(session.user.memberships, orgId);
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const env: RagChainEnv = {
    ...envOrErr,
    orgId,
    fetchK: body.fetchK,
    topK: body.topK,
    model: body.model,
  };

  const useSse = body.stream !== false;
  const userId = session.user.id;
  const metricStart = process.hrtime.bigint();
  const recordQueryMetrics = (stream: boolean) => {
    const elapsedSec = Number(process.hrtime.bigint() - metricStart) / 1e9;
    ragQueriesTotal.inc({ org_id: orgId, stream: String(stream) });
    ragQueryLatencySeconds.observe({ stream: String(stream) }, elapsedSec);
  };

  if (!useSse) {
    try {
      const { invokeRagQuery } = await import("@/lib/rag/chain");
      const { transcriptToMessages } = await import("@/lib/rag/memory");
      const out = await invokeRagQuery(env, {
        query,
        chat_history: transcriptToMessages(body.history),
      });
      const retriever = new HybridSearchRetriever({
        ...env,
        fetchK: env.fetchK,
        topK: env.topK,
      });
      const docs = await retriever.invoke(query);
      const idx = citationIndexFromDocuments(docs);
      const answer = typeof out.answer === "string" ? out.answer : String(out.answer ?? "");
      const citations = resolveCitations(answer, idx);
      await createQueryLog({
        orgId,
        userId,
        question: query,
        answerPreview: answer.slice(0, 500),
      });
      return NextResponse.json({ answer, citations, context: out.context });
    } finally {
      recordQueryMetrics(false);
    }
  }

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      try {
        let citationDocs: Document[] = [];
        let answer = "";
        for await (const part of streamRagTokens({ ...env, query, history: body.history })) {
          if (part.type === "token") {
            answer += part.content;
            send({ type: "token", content: part.content });
          } else {
            answer = part.answer || answer;
            citationDocs = part.documents;
            const idx = citationIndexFromDocuments(citationDocs);
            send({
              type: "citations",
              citations: resolveCitations(answer, idx),
            });
            send({ type: "done", answer });
            await createQueryLog({
              orgId,
              userId,
              question: query,
              answerPreview: answer.slice(0, 500),
            });
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : String(e) });
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        recordQueryMetrics(true);
        controller.close();
      }
    },
  });

  return new Response(readable, { headers: sseHeaders() });
}
