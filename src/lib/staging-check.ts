/** Pure helpers shared by the staging checklist (browser) and its server check. */
export const LIVE_BACKEND_REF = "siepfegeubbqwhodyxcg";
const LIVE_HOST_HINTS = ["crm.winstonebd.com", "winstone-pulse-crm.lovable.app", "990267f3-4198-4d83-ae21-7d9c802617f4"];

export type StagingUrlCheck = { ok: true; origin: string; host: string } | { ok: false; reason: string };

export function checkStagingUrl(raw: string): StagingUrlCheck {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return { ok: false, reason: "Not a valid web address." };
  }
  if (u.protocol !== "https:") return { ok: false, reason: "The address must start with https://." };
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || /^[\d.]+$/.test(host) || host.includes(":")) return { ok: false, reason: "Use the staging app's public address." };
  if (LIVE_HOST_HINTS.some((h) => host.includes(h))) return { ok: false, reason: "That is the live CRM (or its preview), not a staging copy." };
  return { ok: true, origin: u.origin, host };
}

export type IsolationVerdict = "separate" | "live" | "unknown";

/** Reads the backend ref out of the app's published sign-in metadata. */
export function isolationFromMetadata(meta: unknown): IsolationVerdict {
  const servers = (meta as { authorization_servers?: unknown })?.authorization_servers;
  if (!Array.isArray(servers) || servers.length === 0) return "unknown";
  const refs = servers.map((s) => {
    try {
      return new URL(String(s)).hostname.match(/^([a-z0-9]{20})\.supabase\.co$/)?.[1] ?? null;
    } catch {
      return null;
    }
  });
  if (refs.includes(LIVE_BACKEND_REF)) return "live";
  return refs.every((r) => r) ? "separate" : "unknown";
}
