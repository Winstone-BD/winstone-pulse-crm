import { createClient } from "@supabase/supabase-js";
import { getRequest } from "@tanstack/react-start/server";

import type { Database } from "@/integrations/supabase/types";
import { PROFILE_SAFE_COLUMNS, type SafeProfile } from "@/lib/profile-columns";

export type Profile = SafeProfile;
export type Scope = "authority" | "coordinator" | "agent" | "none";

export type Caller = {
  /** authority = HQ / IT master PIN, coordinator = approved team leader account. */
  scope: Scope;
  profile: Profile | null;
  userId: string | null;
  /** Present when a signed-in account exists but is not approved yet. */
  approval: "pending" | "approved" | "rejected" | null;
  /** True for HQ viewing sessions and unapproved accounts: reads only. */
  readOnly: boolean;
  /** Actor label for audit rows when there is no profile (Coordinator Deck PIN). */
  label?: string;
};

const ANON: Caller = { scope: "none", profile: null, userId: null, approval: null, readOnly: true };

function isNewKey(value: string) {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/** Reads the Supabase user id from the bearer token on the current request, if any. */
async function userIdFromRequest(): Promise<{ userId: string; executiveHq: boolean } | null> {
  const request = getRequest();
  const header = request?.headers?.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (token.split(".").length !== 3) return null;

  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return null;

  const client = createClient<Database>(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      headers: { Authorization: `Bearer ${token}` },
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isNewKey(key) && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });

  const { data, error } = await client.auth.getClaims(token);
  if (error || !data?.claims?.sub) return null;
  const userId = String(data.claims.sub);
  const { data: grant, error: grantError } = await client.from("workspace_role_grants")
    .select("role").eq("user_id", userId).eq("role", "executive_hq").maybeSingle();
  if (grantError) throw new Error("Account permissions unavailable");
  return { userId, executiveHq: Boolean(grant) };
}

/**
 * Single resolver for both ways in: the master/IT PIN token (authority) and a
 * signed-in agent or coordinator account. Everything else is anonymous.
 */
export async function resolveCaller(
  adminToken?: string | null,
  options: { skipMaintenance?: boolean } = {},
): Promise<Caller> {
  const caller = await resolveCallerInner(adminToken);
  if (options.skipMaintenance) return caller;
  // Maintenance lock: only writing authority (IT Console / admin) passes while locked.
  const exempt = caller.scope === "authority" && !caller.readOnly;
  if (!exempt && caller.scope !== "none") {
    const m = await import("@/lib/maintenance.server");
    if (await m.isLockedForOrdinaryUsers()) throw new Error(m.LOCKED_MESSAGE);
  }
  return caller;
}

async function resolveCallerInner(adminToken?: string | null): Promise<Caller> {
  // Loaded on demand so a hot reload of the PIN module never leaves a stale binding.
  const gate = await import("@/lib/admin-gate.server");
  const pinScope = gate.adminTokenScope(adminToken ?? null);
  if (pinScope === "full" || pinScope === "hq") {
    return {
      scope: "authority",
      profile: null,
      userId: null,
      approval: "approved",
      // Executive HQ unlock is a viewing session: reads pass, mutations do not.
      readOnly: pinScope === "hq",
    };
  }

  const identity = await userIdFromRequest();
  if (!identity) return ANON;
  const { userId } = identity;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select(PROFILE_SAFE_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();

  const approval = (profile?.approval_status ?? "pending") as Caller["approval"];
  const approved = Boolean(profile) && approval === "approved" && Boolean(profile?.is_active);

  if (!profile) return { ...ANON, userId };
  if (!approved) {
    return { scope: "none", profile, userId, approval, readOnly: true };
  }

  return {
    scope:
      profile.role === "admin" || identity.executiveHq ? "authority" : "agent",
    profile,
    userId,
    approval,
    readOnly: identity.executiveHq && profile.role !== "admin",
  };
}

/** Authority or coordinator may dispatch leads. */
export function canDispatch(caller: Caller) {
  return caller.scope === "authority" && !caller.readOnly;
}

/** Sell Team Admin desks (Abu Haidar). Agent scope + Coordinator Deck intake only. */
export const SELL_TEAM_ADMIN_IDS = ["WIN2607"] as const;

export function isSellTeamAdmin(caller: Pick<Caller, "scope" | "profile" | "readOnly">) {
  const id = (caller.profile?.employee_id ?? "").toUpperCase().replace(/\s+/g, "");
  return caller.scope === "agent" && !caller.readOnly && (SELL_TEAM_ADMIN_IDS as readonly string[]).includes(id);
}

/**
 * Coordinator Deck access level. "full" = dispatch powers, "intake" = Sell Team
 * Admin: may read pool readiness and add leads to the head database — never
 * distribute, change quotas, or touch IT/account/device settings.
 */
export function deckAccess(caller: Caller): "full" | "intake" | "none" {
  return "none";
}

export function requireDeck(caller: Caller) {
  if (deckAccess(caller) === "none") throw new Error("Coordinator Deck access required");
}

export function requireDispatch(caller: Caller) {
  if (!canDispatch(caller)) throw new Error("Coordinator access required");
}

export function requireAuthority(caller: Caller) {
  if (caller.scope !== "authority") throw new Error("Master PIN required");
}

/** LeadHub has its own PIN scope; ordinary HQ/IT/Coordinator sessions do not inherit it. */
export async function requireLeadHub(token: string | null | undefined) {
  const { adminTokenScope } = await import("@/lib/admin-gate.server");
  if (adminTokenScope(token) !== "leadhub") throw new Error("LeadHub PIN required");
}

export const HQ_READ_ONLY =
  "Executive HQ is view-only — use the coordinator or IT console for this change";

/**
 * Gate for every coordinator/IT mutation. HQ sessions read the whole floor but
 * may never change assignments, classifications, follow-ups or system settings.
 */
export function requireWrite(caller: Caller) {
  if (caller.readOnly) throw new Error(HQ_READ_ONLY);
}

/** Own-work endpoints retain original agent rights; PIN sessions never impersonate staff. */
export async function resolveWorkCaller(adminToken?: string | null): Promise<Caller> {
  const caller = await resolveCaller(adminToken);
  if (caller.scope === "authority" && caller.readOnly && caller.userId && caller.profile?.role === "agent") {
    return { ...caller, scope: "agent", readOnly: false };
  }
  return caller;
}

/** Genuine HQ PIN booking review is an existing exception, unlike supplemental oversight. */
export async function requireBookingReviewer(caller: Caller, token?: string | null) {
  requireAuthority(caller);
  const { adminTokenScope } = await import("@/lib/admin-gate.server");
  if (caller.readOnly && adminTokenScope(token) !== "hq") throw new Error(HQ_READ_ONLY);
}
