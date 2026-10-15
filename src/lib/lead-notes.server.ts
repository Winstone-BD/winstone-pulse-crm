import { noteOwnedBy } from "@/lib/lead-notes.functions";

/**
 * Server-only access helpers for lead personal notes and reports.
 *
 * These live in a .server.ts module so the browser bundle never touches
 * access.server / client.server. The lead-notes.functions.ts handlers load
 * this module dynamically inside their handler bodies, which the build's
 * import protection strips from the client graph.
 */

/** Resolve the caller and confirm they may see this lead (agents: own leads only). */
export async function leadAccess(adminToken: string | null | undefined, leadId: string) {
  const { resolveCaller } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken ?? null);
  if (caller.scope === "none") return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  if (caller.scope === "agent") {
    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select("assigned_to, assigned_agent_id")
      .eq("id", leadId)
      .maybeSingle();
    const me = caller.profile?.id;
    if (!lead || !me || (lead.assigned_to !== me && lead.assigned_agent_id !== me)) return null;
  }
  return { caller, db: supabaseAdmin };
}

/** Load a note the caller may edit or delete (author only). */
export async function ownNote(data: { adminToken?: string | null; leadId: string; noteId: string }) {
  const access = await leadAccess(data.adminToken, data.leadId);
  if (!access || access.caller.readOnly) throw new Error("অনুমতি নেই");
  const { data: row } = await access.db
    .from("lead_personal_notes")
    .select("id, author_profile_id, lead_id, deleted_at")
    .eq("id", data.noteId)
    .maybeSingle();
  if (!row || row.lead_id !== data.leadId || row.deleted_at) throw new Error("নোট পাওয়া যায়নি");
  if (!noteOwnedBy(row, access.caller.profile?.id ?? null, access.caller.scope))
    throw new Error("শুধু নিজের নোট বদলানো যায়");
  return access;
}
