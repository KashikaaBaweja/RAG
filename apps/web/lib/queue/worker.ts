/**
 * BullMQ ingestion worker lives in `apps/worker` — do not import pdf-parse into Next.
 */
export { INGESTION_QUEUE, type IngestionJobData } from "./queue";
