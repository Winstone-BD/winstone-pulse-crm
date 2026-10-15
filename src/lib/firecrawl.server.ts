/**
 * Firecrawl v2 scrape — server-only. Gateway mode for `lovc_` keys, direct for
 * `fc-` keys (never mixed). URL must pass the SSRF allowlist guard first.
 */
import { checkOutboundUrl, fetchWithTimeout, redact } from "@/lib/outbound-guard";

const MAX_MARKDOWN = 50_000;

export function firecrawlRequest(apiKey: string, lovableKey: string | undefined) {
  if (apiKey.startsWith("lovc_")) {
    if (!lovableKey) return null;
    return {
      base: "https://connector-gateway.lovable.dev/firecrawl/v2",
      headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": apiKey, "Content-Type": "application/json" },
    };
  }
  return { base: "https://api.firecrawl.dev/v2", headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" } };
}

export async function scrapePage(rawUrl: string) {
  const check = checkOutboundUrl(rawUrl);
  if (!check.ok) return { ok: false as const, error: check.reason };
  const key = process.env["FIRECRAWL_API_KEY"];
  if (!key) return { ok: false as const, error: "not_configured" };
  const req = firecrawlRequest(key, process.env["LOVABLE_API_KEY"]);
  if (!req) return { ok: false as const, error: "not_configured" };
  try {
    const res = await fetchWithTimeout(`${req.base}/scrape`, {
      method: "POST",
      headers: req.headers,
      body: JSON.stringify({ url: check.url, formats: ["markdown"], onlyMainContent: true }),
    }, 15_000);
    const text = await res.text();
    if (!res.ok) {
      console.error(`firecrawl scrape failed [${res.status}]: ${redact(text)}`);
      return { ok: false as const, error: `provider_${res.status}` };
    }
    const j = JSON.parse(text) as { markdown?: string; data?: { markdown?: string; metadata?: { title?: string } }; metadata?: { title?: string } };
    const markdown = (j.markdown ?? j.data?.markdown ?? "").slice(0, MAX_MARKDOWN);
    return { ok: true as const, markdown, title: j.metadata?.title ?? j.data?.metadata?.title ?? null };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error && e.name === "AbortError" ? "timeout" : "network_error" };
  }
}
