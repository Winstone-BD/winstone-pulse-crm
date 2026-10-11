/**
 * Safe signed-in CRM staff fixture for live read-only tests.
 *
 * Never creates users, never signs in with passwords and never prints tokens.
 * It only reuses an existing short-lived session, in this order:
 *   1. TEST_STAFF_ACCESS_TOKEN (CI secret)
 *   2. LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN (preview session injected into the sandbox)
 *   3. ~/.cache/lovable-auth/session.json (written by `lovable auth-session --json`)
 * Expired tokens are ignored, so tests skip instead of failing on stale state.
 */
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

function expSeconds(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = JSON.parse(Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return typeof json.exp === "number" ? json.exp : null;
  } catch { return null; }
}

function usable(token: string | undefined | null): token is string {
  if (!token) return false;
  const exp = expSeconds(token);
  return exp !== null && exp * 1000 > Date.now() + 60_000;
}

export function staffAccessToken(): string | null {
  const candidates = [process.env["TEST_STAFF_ACCESS_TOKEN"], process.env["LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN"]];
  const file = join(homedir(), ".cache/lovable-auth/session.json");
  if (existsSync(file)) {
    try { candidates.push(JSON.parse(readFileSync(file, "utf8"))?.session?.access_token); } catch { /* ignore */ }
  }
  return candidates.find(usable) ?? null;
}
