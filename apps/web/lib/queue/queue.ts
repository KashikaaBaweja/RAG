import { Queue } from "bullmq";
import {
  INGESTION_QUEUE,
  bullmqConnectionFromEnv,
  type IngestionJobData,
} from "@rag/ingestion";

export { INGESTION_QUEUE, type IngestionJobData };

let queue: Queue<IngestionJobData> | null = null;

/** Lazily created so `next build` does not require a running Redis. */
export function getIngestionQueue(): Queue<IngestionJobData> {
  if (!queue) {
    queue = new Queue(INGESTION_QUEUE, {
      connection: bullmqConnectionFromEnv(),
    });
  }
  return queue;
}
