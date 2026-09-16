/**
 * Least-privilege RBAC for the Sales Team Admin desk.
 *
 * The Sell Team Admin (Abu Haidar) is an ordinary agent PLUS one extra power:
 * the team support inbox. That is all. He does not gain IT Console powers, lead
 * dispatch, quota editing, account approval, or any authority-only surface —
 * those still require `requireAuthority` / `requireDispatch`, which key off the
 * caller scope and never off support-admin membership.
 */

import type { Caller } from "@/lib/access.server";

export type SupportAccess = {
  /** May open the shared inbox at all. */
  inbox: boolean;
  /** May reply / change status / change priority on any ticket. */
  manage: boolean;
  /** How this session earned the inbox — used for audit labels. */
  via: "team_admin" | "authority" | "coordinator" | "none";
};

const NO_ACCESS: SupportAccess = { inbox: false, manage: false, via: "none" };

/** Resolves inbox rights for one caller. Never widens any other permission. */
export async function supportAccess(caller: Caller): Promise<SupportAccess> {
  const { isSupportAdmin } = await import("@/lib/team-support.server");
  if (await isSupportAdmin(caller.profile?.id)) {
    // Team admin: inbox owner. Write rights still respect read-only sessions.
    return { inbox: true, manage: !caller.readOnly, via: "team_admin" };
  }
  if (caller.scope === "authority") {
    return { inbox: true, manage: !caller.readOnly, via: "authority" };
  }
  if (caller.scope === "coordinator") {
    return { inbox: true, manage: !caller.readOnly, via: "coordinator" };
  }
  return NO_ACCESS;
}

export async function requireInboxRead(caller: Caller): Promise<SupportAccess> {
  const access = await supportAccess(caller);
  if (!access.inbox) throw new Error("Sales Team Admin access required");
  return access;
}

export async function requireInboxManage(caller: Caller): Promise<SupportAccess> {
  const access = await requireInboxRead(caller);
  if (!access.manage) throw new Error("এই সেশন শুধু দেখার জন্য");
  return access;
}

/**
 * An agent may only touch their OWN ticket. Inbox owners may touch any ticket.
 * Returns which side of the conversation this caller is on.
 */
export async function ticketSide(
  caller: Caller,
  ticketId: string,
): Promise<"admin" | "agent"> {
  const access = await supportAccess(caller);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: ticket } = await supabaseAdmin
    .from("team_support_tickets")
    .select("id, agent_profile_id")
    .eq("id", ticketId)
    .maybeSingle();
  if (!ticket) throw new Error("এই অনুরোধ পাওয়া যায়নি");

  const owner = Boolean(caller.profile?.id) && ticket.agent_profile_id === caller.profile?.id;
  if (owner) return "agent";
  if (access.inbox) return "admin";
  throw new Error("এই অনুরোধে প্রবেশাধিকার নেই");
}
