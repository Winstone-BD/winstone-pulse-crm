import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function sha(input: string) {
  return createHash("sha256").update(input, "utf8").digest();
}

/**
 * Two unlock scopes come out of the same PIN:
 *   - "full"  : IT Console. May read AND change system state.
 *   - "hq"    : Executive HQ. Read-only — management visibility, no coordinator
 *               or IT mutations, enforced on the server (see requireWrite).
 * The surface the browser unlocked from decides which token is minted, so an HQ
 * session cannot be replayed against a mutating endpoint.
 */
export type AdminScope = "full" | "hq" | "leadhub";

const SCOPE_MESSAGE: Record<AdminScope, string> = {
  full: "winstone-admin:v1",
  hq: "winstone-hq:v1",
  leadhub: "winstone-leadhub:v1",
};

/**
 * Constant-time comparison of the submitted PIN against the master ADMIN_PIN
 * or the IT console PIN. Either one unlocks the boards on this device.
 */
export function pinMatches(input: string): boolean {
  const master = process.env["ADMIN_PIN"];
  const itConsole = process.env["IT_CONSOLE_PIN"];
  if (!master && !itConsole) throw new Error("ADMIN_PIN is not configured");
  const candidate = sha(input);
  let ok = false;
  for (const expected of [master, itConsole]) {
    if (expected && timingSafeEqual(candidate, sha(expected))) ok = true;
  }
  return ok;
}

/**
 * Same check, but also accepts a PIN that IT stored/rotated in the secure vault.
 * Env PINs keep working, so a rotation never locks anyone out by surprise.
 */
export async function pinMatchesLive(input: string): Promise<boolean> {
  try {
    if (pinMatches(input)) return true;
  } catch {
    /* no env PIN configured — fall through to the vault */
  }
  const { vaultPins } = await import("@/lib/pin-vault.server");
  const candidate = sha(input);
  let ok = false;
  for (const stored of await vaultPins()) {
    if (timingSafeEqual(candidate, sha(stored))) ok = true;
  }
  return ok;
}

/** Dedicated LeadHub PIN, kept server-side and never shared with other boards. */
export async function leadHubPinMatches(input: string): Promise<boolean> {
  const expected = process.env["LEADHUB_PIN"] ?? process.env["COORDINATOR_DECK_PIN"];
  const { vaultPinFor } = await import("@/lib/pin-vault.server");
  const stored = await vaultPinFor("leadhub");
  if (!expected && !stored) throw new Error("LEADHUB_PIN is not configured");
  return [expected, stored].some((value) => Boolean(value) && timingSafeEqual(sha(input), sha(value as string)));
}

/** Opaque token handed to the browser after a successful PIN unlock. */
export function mintAdminToken(scope: AdminScope = "full"): string {
  const secret = process.env["ADMIN_TOKEN_SECRET"];
  if (!secret) throw new Error("ADMIN_TOKEN_SECRET is not configured");
  return createHmac("sha256", secret).update(SCOPE_MESSAGE[scope]).digest("hex");
}

/** Which scope this token carries, or null when it is not one of ours. */
export function adminTokenScope(token: string | null | undefined): AdminScope | null {
  if (!token) return null;
  if (itAccountTokenUser(token)) return "full";
  try {
    for (const scope of ["hq", "leadhub"] as AdminScope[]) {
      if (timingSafeEqual(sha(token), sha(mintAdminToken(scope)))) return scope;
    }
  } catch {
    return null;
  }
  return null;
}

export function adminTokenValid(token: string | null | undefined): boolean {
  return adminTokenScope(token) !== null;
}

/** Throws unless the caller presents a full (IT Console) admin token. */
export async function requireAdminToken(token: string | null | undefined): Promise<void> {
  const { resolveCaller, requireAuthority, requireWrite } = await import("@/lib/access.server");
  const caller = await resolveCaller(token);
  if (!itAccountTokenUser(token) || !caller.userId) throw new Error("IT PIN and personal account sign-in required");
  requireAuthority(caller);
  requireWrite(caller);
}

function signedItPayload(kind: "challenge" | "account", userId: string | null, duration: number) {
  const secret = process.env["ADMIN_TOKEN_SECRET"];
  if (!secret) throw new Error("ADMIN_TOKEN_SECRET is not configured");
  const payload = Buffer.from(JSON.stringify({ kind, userId, expires: Date.now() + duration })).toString("base64url");
  return `${payload}.${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

function readItPayload(token: string | null | undefined): { kind: string; userId: string | null; expires: number } | null {
  if (!token || token.length > 1000) return null;
  try {
    const [payload, signature] = token.split(".");
    const secret = process.env["ADMIN_TOKEN_SECRET"];
    if (!payload || !signature || !secret) return null;
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    if (!timingSafeEqual(sha(signature), sha(expected))) return null;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof value.expires !== "number" || value.expires <= Date.now()) return null;
    return value;
  } catch { return null; }
}

export function mintItChallenge() { return signedItPayload("challenge", null, 10 * 60_000); }
export function itChallengeValid(token: string) { return readItPayload(token)?.kind === "challenge"; }
export function mintItAccountToken(userId: string) { return signedItPayload("account", userId, 8 * 60 * 60_000); }
export function itAccountTokenUser(token: string | null | undefined): string | null {
  const value = readItPayload(token);
  return value?.kind === "account" && typeof value.userId === "string" ? value.userId : null;
}
