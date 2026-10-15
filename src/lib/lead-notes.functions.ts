import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Base = z.object({ adminToken: z.string().nullable().optional() });

// The server-side access helpers live in lead-notes.server.ts and are loaded
// dynamically inside the handlers below, so no server-only module ever enters
// the browser bundle (the build's import protection enforces this).

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
    const { leadAccess } = await import("@/lib/lead-notes.server");
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
    const { leadAccess } = await import("@/lib/lead-notes.server");
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

export const updateLeadNote = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    NoteEdit.extend({ body: z.string().trim().min(1).max(4000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { ownNote } = await import("@/lib/lead-notes.server");
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
    const { ownNote } = await import("@/lib/lead-notes.server");
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
    const { leadAccess } = await import("@/lib/lead-notes.server");
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
