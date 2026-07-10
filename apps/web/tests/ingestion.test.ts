import { describe, expect, it } from "vitest";
import { chunkText } from "@rag/ingestion/chunker";
import { embedTexts } from "@rag/ingestion/embedder";

describe("ingestion — chunker", () => {
  it("splits long text into bounded chunks (~500 target, overlap)", async () => {
    const paragraph = "word ".repeat(400);
    const text = `${paragraph}\n\n${paragraph}\n\n${paragraph}`;
    const chunks = await chunkText(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeGreaterThan(0);
      expect(c.length).toBeLessThanOrEqual(600);
    }
  });
});

describe("ingestion — embedder", () => {
  it("returns no vectors for empty input", async () => {
    await expect(embedTexts([], { apiKey: "unused" })).resolves.toEqual([]);
  });

  it.skipIf(!process.env.OPENAI_API_KEY)(
    "live OpenAI embeddings are length 1536 (text-embedding-3-small)",
    async () => {
      const out = await embedTexts(["dimension check"], {
        apiKey: process.env.OPENAI_API_KEY!,
      });
      expect(out).toHaveLength(1);
      expect(out[0]).toHaveLength(1536);
    }
  );
});
