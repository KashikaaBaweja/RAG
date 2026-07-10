import OpenAI from "openai";

export type EmbeddingProvider = "openai" | "ollama" | "gemini";

export type EmbedderOptions = {
  provider?: EmbeddingProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  batchSize?: number;
  /** Gemini only — keep 768 to match local Qdrant collection. */
  dimensions?: number;
};

type OllamaEmbeddingResponse = {
  embedding?: number[];
};

type GeminiEmbedResponse = {
  embedding?: { values?: number[] };
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";

/** Embed texts for retrieval — kept in `web` so Turbopack never loads pdf-parse. */
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

  if (provider === "gemini") {
    if (!options.apiKey) {
      throw new Error("GEMINI_API_KEY is required when RAG_EMBEDDING_PROVIDER=gemini");
    }
    return embedTextsWithGemini(texts, {
      apiKey: options.apiKey,
      model: options.model ?? "gemini-embedding-001",
      batchSize,
      dimensions: options.dimensions ?? 768,
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

async function embedTextsWithGemini(
  texts: string[],
  options: { apiKey: string; model: string; batchSize: number; dimensions: number }
): Promise<number[][]> {
  const embeddings: number[][] = [];
  const model = options.model.replace(/^models\//, "");

  for (let i = 0; i < texts.length; i += options.batchSize) {
    const batch = texts.slice(i, i + options.batchSize);
    const rows = await Promise.all(
      batch.map(async (text) => {
        const url = `${GEMINI_API_BASE}/models/${model}:embedContent?key=${encodeURIComponent(options.apiKey)}`;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: { parts: [{ text }] },
            outputDimensionality: options.dimensions,
          }),
        });

        if (!res.ok) {
          throw new Error(`Gemini embedding request failed: ${res.status} ${await res.text()}`);
        }

        const json = (await res.json()) as GeminiEmbedResponse;
        const values = json.embedding?.values;
        if (!Array.isArray(values)) {
          throw new Error("Gemini embedding response did not include values");
        }
        return values;
      })
    );
    embeddings.push(...rows);
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
