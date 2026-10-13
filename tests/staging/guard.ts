/**
 * Fail-closed staging guard. Anything that writes or deletes test accounts or
 * fixtures must call assertStaging() (sync) and, when an app URL is involved,
 * verifyAppBackend() (async) first.
 *
 * What it proves: the operator explicitly opted in, named the staging backend
 * ref, named an allow-listed staging app host, and (verifyAppBackend) that the
 * app advertises that same backend as its sign-in issuer.
 * What it does NOT prove: that the backend shares no data with production.
 * Isolation must be established by provisioning a separate project.
 */
export const LIVE_REF = "siepfegeubbqwhodyxcg";
export const LIVE_HOSTS = ["crm.winstonebd.com", "winstone-pulse-crm.lovable.app"];
/** Preview hosts of the live project serve the live database too. */
const LIVE_HOST_FRAGMENTS = ["990267f3-4198-4d83-ae21-7d9c802617f4", "winstonebd.com"];

type Env = Record<string, string | undefined>;

function refFromUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return null;
    const m = u.hostname.match(/^([a-z0-9]{20})\.supabase\.co$/);
    return m ? m[1] : null; // unknown host shapes fail closed
  } catch {
    return null;
  }
}

function isLiveHost(host: string): boolean {
  return LIVE_HOSTS.includes(host) || LIVE_HOST_FRAGMENTS.some((f) => host.includes(f));
}

export function stagingBlocker(env: Env = process.env): string | null {
  if (env["STAGING_E2E"] !== "1") return "STAGING_E2E=1 not set";
  const url = env["SUPABASE_URL"] ?? "";
  if (!url) return "SUPABASE_URL missing";
  if (url.includes(LIVE_REF)) return "Refusing: SUPABASE_URL points at the LIVE CRM";
  const ref = refFromUrl(url);
  if (!ref) return "Cannot identify the backend from SUPABASE_URL — refusing (unknown environment)";
  if (env["STAGING_CONFIRM"] !== ref) return "STAGING_CONFIRM must equal the staging backend ref exactly";

  const app = env["STAGING_APP_URL"];
  if (!app) return "STAGING_APP_URL missing — refusing (unknown environment)";
  let host: string;
  try {
    const u = new URL(app);
    if (u.protocol !== "https:") return "STAGING_APP_URL must use https";
    host = u.hostname;
  } catch {
    return "STAGING_APP_URL is not a valid URL";
  }
  if (isLiveHost(host)) return "Refusing: STAGING_APP_URL is the live site or its preview";
  const allow = (env["STAGING_APP_ALLOWLIST"] ?? "").split(",").map((h) => h.trim()).filter(Boolean);
  if (!allow.includes(host)) return "STAGING_APP_URL host is not in STAGING_APP_ALLOWLIST — refusing";
  return null;
}

export function assertStaging(env: Env = process.env): { supabaseUrl: string; ref: string; appUrl: string } {
  const b = stagingBlocker(env);
  if (b) throw new Error(`[staging] ${b}`);
  const supabaseUrl = env["SUPABASE_URL"]!;
  return { supabaseUrl, ref: env["STAGING_CONFIRM"]!, appUrl: env["STAGING_APP_URL"]!.replace(/\/+$/, "") };
}

/**
 * Confirms the staging app's published sign-in issuer is the confirmed staging
 * backend (not the live one). Fails closed on any fetch/shape problem.
 */
export async function verifyAppBackend(appUrl: string, ref: string, f: typeof fetch = fetch): Promise<void> {
  const res = await f(`${appUrl}/.well-known/oauth-protected-resource`);
  if (!res.ok) throw new Error(`[staging] cannot read app sign-in metadata (HTTP ${res.status})`);
  const meta = (await res.json()) as { authorization_servers?: unknown };
  const servers = Array.isArray(meta.authorization_servers) ? meta.authorization_servers.map(String) : [];
  if (servers.some((s) => s.includes(LIVE_REF))) throw new Error("[staging] app signs in against the LIVE backend");
  if (!servers.some((s) => new URL(s).hostname === `${ref}.supabase.co`))
    throw new Error("[staging] app's sign-in issuer does not match STAGING_CONFIRM");
}
