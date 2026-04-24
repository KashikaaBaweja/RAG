import { scrubPiiFromText } from "@rag/ingestion";

export { scrubPiiFromText };

const MAX_QUERY_LEN = 16_000;

/** Common prompt-injection / jailbreak phrasing (heuristic, not exhaustive). */
const INJECTION_REGEXES: RegExp[] = [
  /\bignore (all )?(previous|prior|above) instructions\b/i,
  /\bdisregard (the )?(system|developer) (message|prompt)\b/i,
  /\byou are now (a|an|the) \b/i,
  /\bnew instructions?:\b/i,
  /\boverride (your )?rules\b/i,
  /\b<\s*\/\s*system\s*>/i,
  /\b\[INST\]/i,
  /\bDAN mode\b/i,
  /\bdeveloper mode\b/i,
  /\bbase64\s*decode\b/i,
];

export type QuerySanitizeResult =
  | { ok: true; query: string }
  | { ok: false; reason: string; status: 400 };

/**
 * Validates user query length and blocks obvious injection scaffolding.
 * Returns a safe-to-forward `query` string (trimmed); does not remove benign content.
 */
export function sanitizeUserQuery(raw: string): QuerySanitizeResult {
  const query = raw.trim();
  if (!query) {
    return { ok: false, reason: "Query is empty", status: 400 };
  }
  if (query.length > MAX_QUERY_LEN) {
    return {
      ok: false,
      reason: `Query exceeds maximum length (${MAX_QUERY_LEN} characters)`,
      status: 400,
    };
  }
  for (const re of INJECTION_REGEXES) {
    if (re.test(query)) {
      return {
        ok: false,
        reason: "Query was blocked by the security policy",
        status: 400,
      };
    }
  }
  return { ok: true, query };
}
