import { Queue } from "bullmq";

export const INGESTION_QUEUE = "ingestion" as const;

export type IngestionJobData = {
  storageKey: string;
  docId: string;
  orgId: string;
  mimeType: string;
  filename: string;
};

function bullmqConnectionFromEnv(): {
  host: string;
  port: number;
  maxRetriesPerRequest: null;
  username?: string;
  password?: string;
  tls?: Record<string, never>;
} {
  const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: parsed.port ? Number(parsed.port) : parsed.protocol === "rediss:" ? 6380 : 6379,
      maxRetriesPerRequest: null,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      tls: parsed.protocol === "rediss:" ? {} : undefined,
    };
  } catch {
    return { host: "127.0.0.1", port: 6379, maxRetriesPerRequest: null };
  }
}

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
