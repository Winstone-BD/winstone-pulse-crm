/** Exact source support, after whitespace normalization; no model-invented citations. */
export function supportedEvidence(evidence: string, source: string): boolean {
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const quote = normalize(evidence);
  return quote.length >= 2 && normalize(source).includes(quote);
}