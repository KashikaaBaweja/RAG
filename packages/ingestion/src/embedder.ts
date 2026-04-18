import OpenAI from "openai";

export type EmbedderOptions = {
  apiKey: string;
  /** @default "text-embedding-3-small" */
  model?: string;
  /** @default 64 */
  batchSize?: number;
};

/**
 * Calls OpenAI `text-embedding-3-small` in batches; returns vectors in chunk order.
 */
export async function embedTexts(
  texts: string[],
  options: EmbedderOptions
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const client = new OpenAI({ apiKey: options.apiKey });
  const model = options.model ?? "text-embedding-3-small";
  const batchSize = options.batchSize ?? 64;
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
