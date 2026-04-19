import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

/**
 * Recursive character splitting with a sliding window: fixed target length
 * (~500) and overlap (~50) so context carries across chunk boundaries.
 */
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 500,
  chunkOverlap: 50,
});

export async function chunkText(text: string): Promise<string[]> {
  const chunks = await splitter.splitText(text);
  return chunks.filter((c) => c.length > 0);
}
