/** BullMQ / ioredis connection shape from `REDIS_URL`. */
export function bullmqConnectionFromEnv(): {
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
