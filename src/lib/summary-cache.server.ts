/**
 * AI summary cache: a summary is generated (and charged) once per exact
 * content; later requests for identical content return the saved copy.
 * Server-only table; no client grants.
 */
export type SummaryKind = "upload" | "kb" | "drive";

export async function contentHash(...parts: string[]): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(parts.join("\u0000")));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function getCachedSummary<T>(kind: SummaryKind, hash: string): Promise<{ summary: T; createdAt: string } | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("ai_summary_cache").select("summary, created_at")
    .eq("kind", kind).eq("content_hash", hash).maybeSingle();
  return data ? { summary: data.summary as T, createdAt: data.created_at } : null;
}

export async function putCachedSummary(kind: SummaryKind, hash: string, summary: unknown, model: string, createdBy: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // First writer wins; a racing duplicate is simply ignored.
  await supabaseAdmin.from("ai_summary_cache").upsert(
    { kind, content_hash: hash, summary: summary as never, model, created_by: createdBy },
    { onConflict: "kind,content_hash", ignoreDuplicates: true },
  );
}
