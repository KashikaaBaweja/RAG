/**
 * BullMQ ingestion worker (Redis-backed). Same implementation as `@rag/ingestion`;
 * run as a **separate process**: `pnpm --filter worker dev` (see `apps/worker`).
 */
export {
  INGESTION_QUEUE,
  createIngestionWorker,
  type IngestionJobData,
} from "@rag/ingestion";
