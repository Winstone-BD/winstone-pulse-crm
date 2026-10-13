/**
 * Fail-closed staging guard. Anything that writes test accounts or fixtures
 * must call assertStaging() first. It only passes when it can positively
 * identify an isolated, non-live backend that the operator confirmed by ref.
 */
export const LIVE_REF = "siepfegeubbqwhodyxcg";
export const LIVE_HOSTS = ["crm.winstonebd.com", "winstone-pulse-crm.lovable.app"];

type Env = Record<string, string | undefined>;

function refFromUrl(raw: string): string | null {
  try {
    const host = new URL(raw).hostname;
    const m = host.match(/^([a-z0-9]{20})\.supabase\.co$/);
    return m ? m[1] : null; // unknown host shapes fail closed
  } catch {
    return null;
  }
}

export function stagingBlocker(env: Env = process.env): string | null {
  if (env["STAGING_E2E"] !== "1") return "STAGING_E2E=1 not set";
  const url = env["SUPABASE_URL"] ?? "";
  if (!url) return "SUPABASE_URL missing";
  if (url.includes(LIVE_REF)) return "Refusing: SUPABASE_URL points at the LIVE CRM";
  const ref = refFromUrl(url);
  if (!ref) return "Cannot identify the backend from SUPABASE_URL — refusing (unknown environment)";
  if (ref === LIVE_REF) return "Refusing: live backend";
  if (env["STAGING_CONFIRM"] !== ref) return "STAGING_CONFIRM must equal the staging backend ref exactly";
  const app = env["STAGING_APP_URL"];
  if (app) {
    try {
      if (LIVE_HOSTS.includes(new URL(app).hostname)) return "Refusing: STAGING_APP_URL is the live site";
    } catch {
      return "STAGING_APP_URL is not a valid URL";
    }
  }
  return null;
}

export function assertStaging(env: Env = process.env): string {
  const b = stagingBlocker(env);
  if (b) throw new Error(`[staging] ${b}`);
  return env["SUPABASE_URL"]!;
}
