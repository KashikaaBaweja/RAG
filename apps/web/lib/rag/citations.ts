import type { Document } from "@langchain/core/documents";

export type ResolvedCitation = {
  chunkId: string;
  docId: string;
  page: number;
  chunkIndex: number;
  snippet: string;
};

/** Build a lookup table from retrieved LangChain documents. */
export function citationIndexFromDocuments(docs: Document[]): Map<string, ResolvedCitation> {
  const map = new Map<string, ResolvedCitation>();
  for (const d of docs) {
    const chunkId = String(d.metadata.chunkId ?? "");
    if (!chunkId) continue;
    map.set(chunkId, {
      chunkId,
      docId: String(d.metadata.docId ?? ""),
      page: Number(d.metadata.page ?? 1),
      chunkIndex: Number(d.metadata.chunkIndex ?? 0),
      snippet: d.pageContent.slice(0, 400),
    });
  }
  return map;
}

/** Extract unique SOURCE ids from model output. */
export function extractSourceIds(answer: string): string[] {
  const ids = new Set<string>();
  for (const m of answer.matchAll(/\[SOURCE:([^\]\s]+)\]/g)) {
    ids.add(m[1]!);
  }
  return [...ids];
}

/** Map cited ids to doc + page (+ snippet) for UI / SourceDrawer. */
export function resolveCitations(answer: string, index: Map<string, ResolvedCitation>): ResolvedCitation[] {
  const ids = extractSourceIds(answer);
  const out: ResolvedCitation[] = [];
  for (const id of ids) {
    const row = index.get(id);
    if (row) out.push(row);
  }
  return out;
}
