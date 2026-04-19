/** BullMQ / ioredis connection shape from `REDIS_URL`. */
export function bullmqConnectionFromEnv(): {
  host: string;
  port: number;
  maxRetriesPerRequest: null;
} {
  const url = process.env.REDIS_URL ?? "redis://127.0.0.1:6379";
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || "127.0.0.1",
      port: parsed.port ? Number(parsed.port) : 6379,
      maxRetriesPerRequest: null,
    };
  } catch {
    return { host: "127.0.0.1", port: 6379, maxRetriesPerRequest: null };
  }
}
