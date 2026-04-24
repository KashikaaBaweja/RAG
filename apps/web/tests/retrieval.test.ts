import { describe, expect, it } from "vitest";
import { lexicalOverlap, reciprocalRankFusion } from "@/lib/rag/retriever";

/** Recall@k: fraction of runs where any relevant id appears in top-k (here single list, binary). */
export function recallAtK(relevantIds: Set<string>, rankedIds: string[], k: number): number {
  const top = rankedIds.slice(0, k);
  return top.some((id) => relevantIds.has(id)) ? 1 : 0;
}

/** Precision@k: |relevant ∩ top-k| / k */
export function precisionAtK(relevantIds: Set<string>, rankedIds: string[], k: number): number {
  const top = rankedIds.slice(0, k);
  const hits = top.filter((id) => relevantIds.has(id)).length;
  return hits / Math.min(k, top.length || 1);
}

describe("retrieval — fusion & lexical", () => {
  it("RRF boosts ids that rank well in both lists", () => {
    const dense = ["a", "b", "c", "d"];
    const lexical = ["c", "a", "e", "b"];
    const scores = reciprocalRankFusion([dense, lexical]);
    expect(scores.get("a")! > 0).toBe(true);
    expect(scores.get("c")! > scores.get("d")!).toBe(true);
  });

  it("lexicalOverlap counts overlapping tokens", () => {
    const q = "quick brown fox";
    const t = "the quick brown jumps";
    expect(lexicalOverlap(q, t)).toBeGreaterThan(0);
  });
});

describe("retrieval — recall@k / precision@k", () => {
  it("recall@2 is 1 when relevant item is second", () => {
    const rel = new Set(["x"]);
    const ranked = ["a", "x", "b"];
    expect(recallAtK(rel, ranked, 2)).toBe(1);
  });

  it("recall@1 is 0 when relevant item is outside top-1", () => {
    const rel = new Set(["x"]);
    const ranked = ["a", "b", "x"];
    expect(recallAtK(rel, ranked, 1)).toBe(0);
  });

  it("precision@2 counts hits in top-2", () => {
    const rel = new Set(["a", "c"]);
    const ranked = ["a", "b", "c", "d"];
    expect(precisionAtK(rel, ranked, 2)).toBe(0.5);
  });
});
