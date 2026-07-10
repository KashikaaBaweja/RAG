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
 * Best-effort PII redaction before text is embedded or stored in vector metadata.
 */
export function scrubPiiFromText(input: string): string {
  let s = input;
  s = s.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email]");
  s = s.replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone]");
  s = s.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[ssn]");
  s = s.replace(/\b(?:\d[ -]*?){13,19}\d\b/g, "[card]");
  return s;
}

/**
 * Validates user query length and blocks obvious injection scaffolding.
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
