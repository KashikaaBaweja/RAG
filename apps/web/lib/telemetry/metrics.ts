import { Counter, Histogram, Registry, collectDefaultMetrics } from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry, prefix: "rag_node_" });

export const ragQueriesTotal = new Counter({
  name: "rag_queries_total",
  help: "RAG /api/query invocations",
  labelNames: ["org_id", "stream"],
  registers: [metricsRegistry],
});

export const ragQueryLatencySeconds = new Histogram({
  name: "rag_query_latency_seconds",
  help: "End-to-end /api/query latency (handler wall time)",
  labelNames: ["stream"],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 15, 60, 120],
  registers: [metricsRegistry],
});
