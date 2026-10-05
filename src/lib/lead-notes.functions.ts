import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Base = z.object({ adminToken: z.string().nullable().optional() });

/** Resolve the caller and confirm they may see this lead (agents: own leads only). */
async function leadAccess(adminToken: string | null | undefined, leadId: string) {
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

export type LeadNote = {
  id: string;
  body: string;
  authorName: string;
  mine: boolean;
  created_at: string;
  updated_at: string;
};

export const listLeadNotes = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.extend({ leadId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<LeadNote[]> => {
    const access = await leadAccess(data.adminToken, data.leadId);
    if (!access) return [];
    const { data: rows, error } = await access.db
      .from("lead_personal_notes")
      .select("id, body, author_profile_id, author_label, created_at, updated_at")
      .eq("lead_id", data.leadId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const ids = [...new Set((rows ?? []).map((r) => r.author_profile_id).filter(Boolean))] as string[];
    const { data: people } = ids.length
      ? await access.db.from("profiles").select("id, name").in("id", ids)
      : { data: [] as { id: string; name: string }[] };
    const nameById = new Map((people ?? []).map((p) => [p.id, p.name]));
    const me = access.caller.profile?.id ?? null;
    return (rows ?? []).map((r) => ({
      id: r.id,
      body: r.body,
      authorName: (r.author_profile_id && nameById.get(r.author_profile_id)) || r.author_label || "HQ",
      mine: noteOwnedBy(r, me, access.caller.scope),
      created_at: r.created_at,
      updated_at: r.updated_at,
    }));
  });

/** A note belongs to its author profile; PIN-only HQ notes (no profile) belong to HQ. */
export function noteOwnedBy(
  row: { author_profile_id: string | null },
  me: string | null,
  scope: string,
): boolean {
  if (row.author_profile_id) return row.author_profile_id === me;
  return !me && scope === "authority";
}

export const addLeadNote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({ leadId: z.string().uuid(), body: z.string().trim().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const access = await leadAccess(data.adminToken, data.leadId);
    if (!access || access.caller.readOnly) throw new Error("এই লিডে নোট লেখার অনুমতি নেই");
    const { error } = await access.db.from("lead_personal_notes").insert({
      lead_id: data.leadId,
      body: data.body,
      author_profile_id: access.caller.profile?.id ?? null,
      author_label: access.caller.profile ? null : "HQ",
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const NoteEdit = Base.extend({ leadId: z.string().uuid(), noteId: z.string().uuid() });

async function ownNote(data: z.infer<typeof NoteEdit>) {
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

export const updateLeadNote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    NoteEdit.extend({ body: z.string().trim().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const access = await ownNote(data);
    const { error } = await access.db
      .from("lead_personal_notes")
      .update({ body: data.body })
      .eq("id", data.noteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Soft delete: the row stays for audit, it just stops showing. */
export const deleteLeadNote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => NoteEdit.parse(input))
  .handler(async ({ data }) => {
    const access = await ownNote(data);
    const { error } = await access.db
      .from("lead_personal_notes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", data.noteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Full call/contact reports for one lead, including every manually written field. */
export const listLeadReports = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.extend({ leadId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const access = await leadAccess(data.adminToken, data.leadId);
    if (!access) return [];
    const { data: rows, error } = await access.db
      .from("call_reports")
      .select(
        "id, agent_id, status, category, summary, note, reason, interest, requirement, customer_response, next_action, follow_up_at, connected, duration_seconds, call_ended_at, submitted_at, created_at, temperature",
      )
      .eq("lead_id", data.leadId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    const ids = [...new Set((rows ?? []).map((r) => r.agent_id).filter(Boolean))] as string[];
    const { data: people } = ids.length
      ? await access.db.from("profiles").select("id, name").in("id", ids)
      : { data: [] as { id: string; name: string }[] };
    const nameById = new Map((people ?? []).map((p) => [p.id, p.name]));
    return (rows ?? []).map((r) => ({ ...r, agentName: nameById.get(r.agent_id ?? "") ?? null }));
  });
