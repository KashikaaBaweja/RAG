import { ChatOpenAI } from "@langchain/openai";
import type { Document } from "@langchain/core/documents";
import type { BaseMessage } from "@langchain/core/messages";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { createRagCombineChatPrompt, ragDocumentPrompt } from "./prompt";

const DOC_SEP = "\n\n";

async function formatContextDocuments(docs: Document[]): Promise<string> {
  const parts = await Promise.all(
    docs.map((doc) =>
      ragDocumentPrompt.format({
        page_content: doc.pageContent,
        chunkId: String(doc.metadata.chunkId ?? ""),
        docId: String(doc.metadata.docId ?? ""),
        page: String(doc.metadata.page ?? ""),
      })
    )
  );
  return parts.join(DOC_SEP);
}
import { HybridSearchRetriever } from "./retriever";
import type { RagEnv } from "./types";
import { transcriptToMessages } from "./memory";

export type RagChainEnv = RagEnv & {
  fetchK?: number;
  topK?: number;
  /** Chat model id */
  model?: string;
};

/**
 * LangChain retrieval QA pattern: retrieve → stuff documents → answer.
 * (Successor to `RetrievalQAChain`: `createRetrievalChain` + `createStuffDocumentsChain`.)
 */
export async function createRagRetrievalQAChain(env: RagChainEnv) {
  const llm = new ChatOpenAI({
    model: env.model ?? "gpt-4o-mini",
    temperature: 0,
    openAIApiKey: env.openaiApiKey,
  });

  const retriever = new HybridSearchRetriever({
    openaiApiKey: env.openaiApiKey,
    pineconeApiKey: env.pineconeApiKey,
    pineconeIndexName: env.pineconeIndexName,
    orgId: env.orgId,
    fetchK: env.fetchK,
    topK: env.topK,
  });

  const prompt = createRagCombineChatPrompt();
  const combineDocsChain = await createStuffDocumentsChain({
    llm,
    prompt,
    documentPrompt: ragDocumentPrompt,
  });

  return createRetrievalChain({ retriever, combineDocsChain });
}

export async function invokeRagQuery(
  env: RagChainEnv,
  input: { query: string; chat_history?: BaseMessage[] }
) {
  const chain = await createRagRetrievalQAChain(env);
  return chain.invoke({
    input: input.query,
    chat_history: input.chat_history ?? [],
  });
}

export type StreamRagParams = RagChainEnv & {
  query: string;
  history?: { role: "user" | "assistant"; content: string }[];
};

/**
 * Token stream for SSE: same retriever + stuff chain as `createRagRetrievalQAChain`, with `streaming: true` on the LLM.
 */
export async function* streamRagTokens(
  params: StreamRagParams
): AsyncGenerator<
  | { type: "token"; content: string }
  | { type: "done"; answer: string; documents: Document[] }
> {
  const llm = new ChatOpenAI({
    model: params.model ?? "gpt-4o-mini",
    temperature: 0,
    openAIApiKey: params.openaiApiKey,
    streaming: true,
  });

  const retriever = new HybridSearchRetriever({
    openaiApiKey: params.openaiApiKey,
    pineconeApiKey: params.pineconeApiKey,
    pineconeIndexName: params.pineconeIndexName,
    orgId: params.orgId,
    fetchK: params.fetchK,
    topK: params.topK,
  });

  const docs = await retriever.invoke(params.query);
  const context = await formatContextDocuments(docs);

  const prompt = createRagCombineChatPrompt();
  const messages = await prompt.formatMessages({
    context,
    input: params.query,
    chat_history: transcriptToMessages(params.history),
  });

  let accumulated = "";
  const stream = await llm.stream(messages);
  for await (const chunk of stream) {
    const piece =
      typeof chunk.content === "string"
        ? chunk.content
        : Array.isArray(chunk.content)
          ? chunk.content
              .map((p) => (typeof p === "object" && p && "text" in p ? String((p as { text?: string }).text) : ""))
              .join("")
          : "";
    if (!piece) continue;
    accumulated += piece;
    yield { type: "token", content: piece };
  }

  yield { type: "done", answer: accumulated, documents: docs };
}
