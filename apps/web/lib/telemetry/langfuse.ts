import { Langfuse } from "langfuse";

let singleton: Langfuse | null | undefined;

/**
 * Langfuse client (optional). Set `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, optional `LANGFUSE_HOST`.
 */
export function getLangfuse(): Langfuse | null {
  if (singleton === undefined) {
    const pk = process.env.LANGFUSE_PUBLIC_KEY;
    const sk = process.env.LANGFUSE_SECRET_KEY;
    if (!pk || !sk) {
      singleton = null;
    } else {
      singleton = new Langfuse({
        publicKey: pk,
        secretKey: sk,
        baseUrl: process.env.LANGFUSE_HOST ?? "https://cloud.langfuse.com",
      });
    }
  }
  return singleton;
}

export async function flushLangfuse(): Promise<void> {
  await getLangfuse()?.flushAsync();
}

export type RagTraceHandles = {
  end: (payload: { output: string; latencyMs: number; metadata?: Record<string, unknown> }) => void;
};

/**
 * Trace a single RAG chain run (retrieval + generation) with latency metadata.
 */
export function startRagChainTrace(input: {
  name?: string;
  query: string;
  orgId: string;
  model?: string;
}): RagTraceHandles | null {
  const lf = getLangfuse();
  if (!lf) return null;

  const trace = lf.trace({
    name: input.name ?? "rag.chain",
    input: input.query,
    metadata: {
      orgId: input.orgId,
      model: input.model ?? "gpt-4o-mini",
    },
  });

  return {
    end(payload) {
      trace.update({
        output: payload.output,
        metadata: {
          latencyMs: payload.latencyMs,
          ...payload.metadata,
        },
      });
    },
  };
}
