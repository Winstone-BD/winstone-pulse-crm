import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * Coordinator Deck unlock: a Google (Gmail) sign-in plus the Coordinator PIN.
 * The token is bound to that one signed-in user id and expires, and it is a
 * different message than the HQ / IT tokens, so it can never unlock those.
 */
const PREFIX = "coord.";
const TTL_MS = 12 * 60 * 60 * 1000;

function sha(input: string) {
  return createHash("sha256").update(input, "utf8").digest();
}

function secret() {
  const s = process.env["ADMIN_TOKEN_SECRET"];
  if (!s) throw new Error("ADMIN_TOKEN_SECRET is not configured");
  return s;
}

export function coordinatorPinMatches(input: string): boolean {
  const expected = process.env["COORDINATOR_DECK_PIN"];
  if (!expected) return false;
  return timingSafeEqual(sha(input), sha(expected));
}

function sign(userId: string, exp: number) {
  return createHmac("sha256", secret()).update(`winstone-coordinator:v1:${userId}:${exp}`).digest("hex");
}

export function mintCoordinatorToken(userId: string): string {
  const exp = Date.now() + TTL_MS;
  return `${PREFIX}${exp}.${sign(userId, exp)}`;
}

export function isCoordinatorToken(token: string | null | undefined): token is string {
  return typeof token === "string" && token.startsWith(PREFIX);
}

/** True when the token was minted for this exact user and has not expired. */
export function coordinatorTokenValid(token: string, userId: string): boolean {
  const [expRaw, mac] = token.slice(PREFIX.length).split(".");
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < Date.now() || !mac) return false;
  try {
    return timingSafeEqual(sha(mac), sha(sign(userId, exp)));
  } catch {
    return false;
  }
}

/** The signed-in user must come from Google sign-in. Returns their email or null. */
export async function googleEmailFor(userId: string): Promise<string | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.auth.admin.getUserById(userId);
  const user = data?.user;
  if (!user?.email) return null;
  const providers = ((user.app_metadata?.["providers"] as string[] | undefined) ?? [
    String(user.app_metadata?.["provider"] ?? ""),
  ]).map((p) => p.toLowerCase());
  const viaGoogle =
    providers.includes("google") || (user.identities ?? []).some((i) => i.provider === "google");
  return viaGoogle ? user.email : null;
}
