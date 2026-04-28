import OpenAI from "openai";

export type EmbedderOptions = {
  provider?: "openai" | "ollama";
  apiKey?: string;
  /** @default "text-embedding-3-small" */
  model?: string;
  /** @default "http://127.0.0.1:11434" */
  baseUrl?: string;
  /** @default 64 */
  batchSize?: number;
};

type OllamaEmbeddingResponse = {
  embedding?: number[];
};

/**
 * Calls the configured embedding provider in batches; returns vectors in chunk order.
 */
export async function embedTexts(
  texts: string[],
  options: EmbedderOptions
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const batchSize = options.batchSize ?? 64;
  const provider = options.provider ?? (options.apiKey ? "openai" : "ollama");

  if (provider === "ollama") {
    return embedTextsWithOllama(texts, {
      model: options.model ?? "nomic-embed-text",
      baseUrl: options.baseUrl ?? "http://127.0.0.1:11434",
      batchSize,
    });
  }

  if (!options.apiKey) {
    throw new Error("OPENAI_API_KEY is required when RAG_EMBEDDING_PROVIDER=openai");
  }

  const client = new OpenAI({ apiKey: options.apiKey });
  const model = options.model ?? "text-embedding-3-small";
  const embeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize);
    const res = await client.embeddings.create({ model, input: batch });
    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    for (const row of sorted) {
      embeddings.push(row.embedding);
    }
  }

  return embeddings;
}

async function embedTextsWithOllama(
  texts: string[],
  options: { model: string; baseUrl: string; batchSize: number }
): Promise<number[][]> {
  const embeddings: number[][] = [];
  const baseUrl = options.baseUrl.replace(/\/+$/, "");

  for (let i = 0; i < texts.length; i += options.batchSize) {
    const batch = texts.slice(i, i + options.batchSize);
    const rows = await Promise.all(
      batch.map(async (prompt) => {
        const res = await fetch(`${baseUrl}/api/embeddings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: options.model, prompt }),
        });

        if (!res.ok) {
          throw new Error(`Ollama embedding request failed: ${res.status} ${await res.text()}`);
        }

        const json = (await res.json()) as OllamaEmbeddingResponse;
        if (!Array.isArray(json.embedding)) {
          throw new Error("Ollama embedding response did not include an embedding array");
        }
        return json.embedding;
      })
    );
    embeddings.push(...rows);
  }

  return embeddings;
}
