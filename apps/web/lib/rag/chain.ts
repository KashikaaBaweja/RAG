import { ChatOpenAI } from "@langchain/openai";
import type { Document } from "@langchain/core/documents";
import type { BaseMessage } from "@langchain/core/messages";
import { createRetrievalChain } from "langchain/chains/retrieval";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import OpenAI from "openai";
import { flushLangfuse, startRagChainTrace } from "@/lib/telemetry/langfuse";
import { createRagCombineChatPrompt, ragDocumentPrompt, RAG_SYSTEM_PROMPT } from "./prompt";
import { HybridSearchRetriever } from "./retriever";
import type { RagEnv } from "./types";
import { transcriptToMessages } from "./memory";

const DOC_SEP = "\n\n";
const NO_CONTEXT_FALLBACK =
  "I could not find relevant uploaded content yet. Please wait for ingestion to finish or upload a document with extractable text, then try again.";

const GEMINI_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/";

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

export type RagChainEnv = RagEnv & {
  fetchK?: number;
  topK?: number;
  /** Chat model id */
  model?: string;
};

function createChatModel(env: RagChainEnv, streaming = false): ChatOpenAI {
  const chatProvider = env.chatProvider ?? env.embeddingProvider;

  if (chatProvider === "openai") {
    if (!env.openaiApiKey) {
      throw new Error("OPENAI_API_KEY is required when RAG_CHAT_PROVIDER=openai");
    }

    return new ChatOpenAI({
      model: env.model ?? "gpt-4o-mini",
      temperature: 0,
      openAIApiKey: env.openaiApiKey,
      streaming,
    });
  }

  if (chatProvider === "gemini") {
    if (!env.geminiApiKey) {
      throw new Error("GEMINI_API_KEY is required when RAG_CHAT_PROVIDER=gemini");
    }

    // Prefer OpenAI-compatible Gemini endpoint. Avoid LangChain defaults that
    // send frequency_penalty/logit_bias (Gemini returns empty HTTP 400).
    return new ChatOpenAI({
      model: env.model ?? env.geminiChatModel ?? "gemini-2.5-flash",
      temperature: 0,
      openAIApiKey: env.geminiApiKey,
      configuration: { baseURL: GEMINI_OPENAI_BASE },
      streaming,
    });
  }

  const baseURL = `${(env.ollamaBaseUrl ?? "http://127.0.0.1:11434").replace(/\/+$/, "")}/v1`;
  return new ChatOpenAI({
    model: env.model ?? env.ollamaChatModel ?? "llama3.1",
    temperature: 0,
    openAIApiKey: "ollama",
    configuration: { baseURL },
    streaming,
  });
}

function geminiClient(apiKey: string): OpenAI {
  return new OpenAI({ apiKey, baseURL: GEMINI_OPENAI_BASE });
}

/** Stream chat via OpenAI SDK (Gemini-compatible) — strips LangChain-only failure modes. */
async function* streamGeminiTokens(
  env: RagChainEnv,
  context: string,
  query: string,
  history?: { role: "user" | "assistant"; content: string }[]
): AsyncGenerator<string> {
  if (!env.geminiApiKey) {
    throw new Error("GEMINI_API_KEY is required when RAG_CHAT_PROVIDER=gemini");
  }

  const client = geminiClient(env.geminiApiKey);
  const model = env.model ?? env.geminiChatModel ?? "gemini-2.5-flash";
  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `${RAG_SYSTEM_PROMPT}\n\nChunks:\n${context}`,
    },
  ];

  for (const turn of history ?? []) {
    if (!turn.content?.trim()) continue;
    messages.push({
      role: turn.role === "assistant" ? "assistant" : "user",
      content: turn.content,
    });
  }
  messages.push({ role: "user", content: query });

  const stream = await client.chat.completions.create({
    model,
    temperature: 0,
    stream: true,
    messages,
  });

  for await (const chunk of stream) {
    const piece = chunk.choices?.[0]?.delta?.content;
    if (piece) yield piece;
  }
}


/**
 * LangChain retrieval QA pattern: retrieve → stuff documents → answer.
 * (Successor to `RetrievalQAChain`: `createRetrievalChain` + `createStuffDocumentsChain`.)
 */
export async function createRagRetrievalQAChain(env: RagChainEnv) {
  const llm = createChatModel(env);

  const retriever = new HybridSearchRetriever({
    ...env,
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
  const t0 = Date.now();
  const trace = startRagChainTrace({
    query: input.query,
    orgId: env.orgId,
    model: env.model,
  });
  try {
    const chain = await createRagRetrievalQAChain(env);
    const out = await chain.invoke({
      input: input.query,
      chat_history: input.chat_history ?? [],
    });
    const answer = typeof out.answer === "string" ? out.answer : String(out.answer ?? "");
    trace?.end({ output: answer, latencyMs: Date.now() - t0 });
    return out;
  } catch (e) {
    trace?.end({
      output: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - t0,
      metadata: { error: true },
    });
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    await flushLangfuse();
  }
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
  const t0 = Date.now();
  const trace = startRagChainTrace({
    query: params.query,
    orgId: params.orgId,
    model: params.model,
  });
  const llm = createChatModel(params, true);

  const retriever = new HybridSearchRetriever({
    ...params,
    fetchK: params.fetchK,
    topK: params.topK,
  });

  try {
    const docs = await retriever.invoke(params.query);
    if (docs.length === 0) {
      yield { type: "done", answer: NO_CONTEXT_FALLBACK, documents: [] };
      trace?.end({ output: NO_CONTEXT_FALLBACK, latencyMs: Date.now() - t0 });
      return;
    }
    const context = await formatContextDocuments(docs);

    let accumulated = "";
    const chatProvider = params.chatProvider ?? params.embeddingProvider;

    if (chatProvider === "gemini") {
      for await (const piece of streamGeminiTokens(
        params,
        context,
        params.query,
        params.history
      )) {
        accumulated += piece;
        yield { type: "token", content: piece };
      }
    } else {
      const prompt = createRagCombineChatPrompt();
      const messages = await prompt.formatMessages({
        context,
        input: params.query,
        chat_history: transcriptToMessages(params.history),
      });

      const stream = await llm.stream(messages);
      for await (const chunk of stream) {
        let piece = "";
        if (typeof chunk.content === "string") {
          piece = chunk.content;
        } else if (Array.isArray(chunk.content)) {
          piece = chunk.content
            .map((p) =>
              typeof p === "object" && p && "text" in p
                ? String((p as { text?: string }).text)
                : ""
            )
            .join("");
        }
        if (!piece) continue;
        accumulated += piece;
        yield { type: "token", content: piece };
      }
    }

    const finalAnswer = accumulated.trim().length > 0 ? accumulated : NO_CONTEXT_FALLBACK;
    yield { type: "done", answer: finalAnswer, documents: docs };
    trace?.end({ output: finalAnswer, latencyMs: Date.now() - t0 });
  } catch (e) {
    trace?.end({
      output: e instanceof Error ? e.message : String(e),
      latencyMs: Date.now() - t0,
      metadata: { error: true },
    });
    throw e instanceof Error ? e : new Error(String(e));
  } finally {
    await flushLangfuse();
  }
}
