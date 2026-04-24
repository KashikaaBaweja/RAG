/**
 * Best-effort PII redaction before text is embedded or stored in vector metadata.
 * Not a compliance guarantee — tune patterns for your jurisdiction.
 */
export function scrubPiiFromText(input: string): string {
  let s = input;

  s = s.replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[email]");
  s = s.replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[phone]");
  s = s.replace(/\b\d{3}-\d{2}-\d{4}\b/g, "[ssn]");
  s = s.replace(/\b(?:\d[ -]*?){13,19}\d\b/g, "[card]");

  return s;
}
