import { createHmac, randomUUID } from "node:crypto";
import { getCookie, setCookie, setResponseHeader } from "@tanstack/react-start/server";

type Begin = { allowed: boolean; lease?: string; retryAfterSeconds: number };
type Finish = { accepted: boolean; retryAfterSeconds: number };

/** Verified accounts share a counter across devices; anonymous PIN sessions do not share IP counters. */
export async function guardedPinUnlock(surface: "hq" | "system" | "leadhub", pin: string) {
  setResponseHeader("Cache-Control", "no-store");
  const { resolveCaller } = await import("@/lib/access.server");
  const caller = await resolveCaller(null, { skipMaintenance: true });
  const secret = process.env["ADMIN_TOKEN_SECRET"];
  if (!secret) throw new Error("PIN authentication is unavailable");
  let sessionId = getCookie("winstone-pin-session");
  if (!sessionId || !/^[a-f0-9-]{36}\.[a-f0-9]{64}$/.test(sessionId)) sessionId = undefined;
  if (sessionId) {
    const [id, signature] = sessionId.split(".");
    const expected = createHmac("sha256", secret).update(`pin-session:${id}`).digest("hex");
    if (signature !== expected) sessionId = undefined;
  }
  if (!sessionId) {
    const id = randomUUID();
    sessionId = `${id}.${createHmac("sha256", secret).update(`pin-session:${id}`).digest("hex")}`;
    setCookie("winstone-pin-session", sessionId, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: 86400 });
  }
  const subject = createHmac("sha256", secret).update(caller.userId ? `account:${caller.userId}` : `session:${sessionId}`).digest("hex");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("begin_pin_auth_attempt", { _subject: subject, _surface: surface });
  if (error) throw new Error("PIN protection is unavailable; try again later");
  const begin = data as unknown as Begin;
  if (!begin.allowed || !begin.lease) return { ok: false as const, retryAfterSeconds: begin.retryAfterSeconds };
  const { pinMatchesLive, leadHubPinMatches, mintAdminToken } = await import("@/lib/admin-gate.server");
  const matches = surface === "leadhub" ? await leadHubPinMatches(pin) : await pinMatchesLive(pin);
  const finished = await supabaseAdmin.rpc("finish_pin_auth_attempt", { _subject: subject, _surface: surface, _lease: begin.lease, _success: matches });
  if (finished.error) throw new Error("PIN protection is unavailable; try again later");
  const result = finished.data as unknown as Finish;
  if (!result.accepted || !matches) return { ok: false as const, retryAfterSeconds: result.retryAfterSeconds };
  return { ok: true as const, token: mintAdminToken(surface === "hq" ? "hq" : surface === "leadhub" ? "leadhub" : "full"), readOnly: surface === "hq" };
}