import Redis from "ioredis";

/** Rough token estimate (~4 chars per token) plus assumed retrieval + answer overhead. */
export function estimateQueryCostTokens(query: string): number {
  const fromText = Math.max(1, Math.ceil(query.length / 4));
  const overhead = Number(process.env.RAG_QUERY_OVERHEAD_TOKENS ?? "4000");
  return fromText + overhead;
}

function dailyBudgetLimit(): number {
  const v = process.env.RAG_USER_DAILY_TOKEN_BUDGET;
  if (v && /^\d+$/.test(v)) return Number(v);
  return 300_000;
}

function minuteQueryLimit(): number {
  const v = process.env.RAG_USER_QUERIES_PER_MINUTE;
  if (v && /^\d+$/.test(v)) return Number(v);
  return 30;
}

let redisSingleton: Redis | null | undefined;

function getRedis(): Redis | null {
  if (redisSingleton === undefined) {
    const url = process.env.REDIS_URL?.trim();
    if (!url) {
      redisSingleton = null;
    } else {
      redisSingleton = new Redis(url, { maxRetriesPerRequest: 2, enableReadyCheck: true });
    }
  }
  return redisSingleton;
}

export type BudgetResult =
  | { ok: true }
  | { ok: false; status: 429 | 503; message: string; retryAfterSec?: number };

/**
 * Enforces per-user daily estimated-token budget and per-minute query count using Redis.
 * If `REDIS_URL` is unset, enforcement is skipped (local dev); set `RAG_RATE_LIMIT_STRICT=1` to reject instead.
 */
export async function tryConsumeUserQueryBudget(userId: string, query: string): Promise<BudgetResult> {
  const strict = process.env.RAG_RATE_LIMIT_STRICT === "1";
  const redis = getRedis();
  if (!redis) {
    if (strict) {
      return {
        ok: false,
        status: 503,
        message: "Rate limiting requires REDIS_URL",
      };
    }
    return { ok: true };
  }

  const cost = estimateQueryCostTokens(query);
  const dayKey = new Date().toISOString().slice(0, 10);
  const tokenKey = `rag:budget:tokens:${userId}:${dayKey}`;
  const minuteBucket = Math.floor(Date.now() / 60_000);
  const rpmKey = `rag:budget:rpm:${userId}:${minuteBucket}`;

  const limit = dailyBudgetLimit();
  const rpm = minuteQueryLimit();

  const lua = `
    local tokenKey = KEYS[1]
    local rpmKey = KEYS[2]
    local cost = tonumber(ARGV[1])
    local limit = tonumber(ARGV[2])
    local rpm = tonumber(ARGV[3])
    local ttlDay = tonumber(ARGV[4])
    local ttlMin = tonumber(ARGV[5])

    local current = tonumber(redis.call("GET", tokenKey) or "0")
    if current + cost > limit then
      return {0, current}
    end

    local qpm = redis.call("INCR", rpmKey)
    if qpm == 1 then
      redis.call("EXPIRE", rpmKey, ttlMin)
    end
    if qpm > rpm then
      redis.call("DECR", rpmKey)
      return {2, qpm}
    end

    local after = redis.call("INCRBY", tokenKey, cost)
    if after == cost then
      redis.call("EXPIRE", tokenKey, ttlDay)
    end
    return {1, after}
  `;

  try {
    const res = (await redis.eval(
      lua,
      2,
      tokenKey,
      rpmKey,
      String(cost),
      String(limit),
      String(rpm),
      String(86400 * 2),
      String(120)
    )) as unknown;

    const tuple = Array.isArray(res) ? res : [];
    const code = Number(tuple[0]);
    if (code === 1) return { ok: true };
    if (code === 2) {
      return {
        ok: false,
        status: 429,
        message: "Too many requests. Try again in a minute.",
        retryAfterSec: 60,
      };
    }
    return {
      ok: false,
      status: 429,
      message: "Daily query token budget exceeded. Try again tomorrow or contact your admin.",
      retryAfterSec: 3600,
    };
  } catch {
    if (strict) {
      return { ok: false, status: 503, message: "Rate limiter unavailable" };
    }
    return { ok: true };
  }
}
