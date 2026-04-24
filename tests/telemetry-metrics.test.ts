import { describe, expect, it } from "vitest";
import { metricsRegistry } from "@/lib/telemetry/metrics";

describe("telemetry — Prometheus registry", () => {
  it("registers RAG metric names", async () => {
    const text = await metricsRegistry.metrics();
    expect(text).toContain("rag_queries_total");
    expect(text).toContain("rag_query_latency_seconds");
  });
});
