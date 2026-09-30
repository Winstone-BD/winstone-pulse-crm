import { createServerFn } from "@tanstack/react-start";

import { leadOwner } from "./lead-owner";
import { z } from "zod";

import { PROFILE_SAFE_COLUMNS } from "@/lib/profile-columns";

const AdminToken = z.string().min(1);
/** PIN token is optional now: coordinators/agents authenticate with their account. */
const OptionalToken = z.string().nullable().optional();

const SnapshotScope = z.object({
  token: z.string().nullable().optional(),
});

/**
 * The Data API caps a single select at 1000 rows, so the board must page or it
 * silently loses every lead past the first thousand (and every count with it).
 */
async function allLeads(
  client: { from: (t: "leads") => any },
): Promise<{ data: any[]; error: { message: string } | null }> {
  const PAGE = 1000;
  const MAX = 50_000;
  const rows: any[] = [];
  for (let from = 0; from < MAX; from += PAGE) {
    const { data, error } = await client
      .from("leads")
      .select("*")
      .order("updated_at", { ascending: false })
      .range(from, from + PAGE - 1);
    if (error) return { data: [], error };
    rows.push(...(data ?? []));
    if ((data?.length ?? 0) < PAGE) break;
  }
  return { data: rows, error: null };
}

/**
 * Board data scoped to who is asking.
 * Authority (HQ / IT PIN) and coordinators get the whole floor; a signed-in
 * agent gets only their own leads, calls and messages. Anyone else gets nothing.
 */
/** Reads every matching row in 1000-row pages — no silent "latest N" cut-off. */
async function pageAll(build: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>) {
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) return { data: null, error };
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return { data: out, error: null };
  }
}

export const getCrmSnapshot = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SnapshotScope.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.token ?? null);

    if (caller.scope === "none")
      return { profiles: [], leads: [], calls: [], messages: [], events: [] };

    // Agents: query only their own rows at the source, so their numbers are
    // never cut short by a floor-wide limit or mixed with other agents' work.
    if (caller.scope === "agent" && caller.profile) {
      const me = caller.profile.id;
      const [profile, ownLeadsA, ownLeadsB] = await Promise.all([
        supabaseAdmin.from("profiles").select(PROFILE_SAFE_COLUMNS).eq("id", me),
        supabaseAdmin.from("leads").select("*").eq("assigned_agent_id", me).limit(5000),
        supabaseAdmin.from("leads").select("*").eq("assigned_to", me).limit(5000),
      ]);
      const leadMap = new Map<string, any>();
      for (const l of [...(ownLeadsA.data ?? []), ...(ownLeadsB.data ?? [])]) {
        if (leadOwner(l) === me) leadMap.set(l.id, l);
      }
      const myLeads = [...leadMap.values()].sort((a, b) =>
        String(b.updated_at).localeCompare(String(a.updated_at)),
      );
      const [calls, messages, events] = await Promise.all([
        pageAll((a, b) => supabaseAdmin.from("call_recordings").select("*").eq("agent_id", me)
          .order("created_at", { ascending: false }).order("id").range(a, b)),
        pageAll((a, b) => supabaseAdmin.from("whatsapp_interactions").select("*").eq("agent_id", me)
          .order("created_at", { ascending: true }).order("id").range(a, b)),
        pageAll((a, b) => supabaseAdmin.from("lead_events").select("*").eq("agent_id", me)
          .order("created_at", { ascending: false }).order("id").range(a, b)),
      ]);
      const failed = [profile, ownLeadsA, ownLeadsB, calls, messages, events].find((r) => r.error);
      if (failed?.error) throw new Error(failed.error.message);
      const dedupe = <T extends { id: string }>(rows: T[]) => [
        ...new Map(rows.map((r) => [r.id, r])).values(),
      ];
      return {
        profiles: profile.data ?? [],
        leads: myLeads,
        calls: dedupe(calls.data ?? []),
        messages: dedupe(messages.data ?? []),
        events: dedupe(events.data ?? []),
      };
    }

    const [profiles, leads, calls, messages, events] = await Promise.all([
      supabaseAdmin.from("profiles").select(PROFILE_SAFE_COLUMNS).order("name"),
      allLeads(supabaseAdmin as never),
      pageAll((a, b) => supabaseAdmin.from("call_recordings").select("*")
        .order("created_at", { ascending: false }).order("id").range(a, b)),
      pageAll((a, b) => supabaseAdmin.from("whatsapp_interactions").select("*")
        .order("created_at", { ascending: true }).order("id").range(a, b)),
      // Floor-wide events: every row of the last 31 days (dashboard windows), fully paged.
      pageAll((a, b) => supabaseAdmin.from("lead_events").select("*")
        .gte("created_at", new Date(Date.now() - 31 * 864e5).toISOString())
        .order("created_at", { ascending: false }).order("id").range(a, b)),
    ]);
    const failed = [profiles, leads, calls, messages, events].find((r) => r.error);
    if (failed?.error) throw new Error(failed.error.message);

    return {
      profiles: profiles.data ?? [],
      leads: leads.data ?? [],
      calls: calls.data ?? [],
      messages: messages.data ?? [],
      events: events.data ?? [],
    };
  });

/** Verifies the master PIN and returns an opaque token the browser keeps locally. */
export const unlockAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        pin: z.string().min(1).max(32),
        // Which board is being unlocked. HQ gets a read-only token.
        surface: z.enum(["hq", "system", "leadhub"]).default("system"),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { pinMatchesLive, leadHubPinMatches, mintAdminToken } = await import("@/lib/admin-gate.server");
    const matches = data.surface === "leadhub" ? await leadHubPinMatches(data.pin) : await pinMatchesLive(data.pin);
    if (!matches) return { ok: false as const };
    return {
      ok: true as const,
      token: mintAdminToken(data.surface === "hq" ? "hq" : data.surface === "leadhub" ? "leadhub" : "full"),
      readOnly: data.surface === "hq",
    };
  });

/** Lets the browser confirm a stored token is still valid (e.g. after a secret rotation). */
export const checkAdminToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const { adminTokenValid } = await import("@/lib/admin-gate.server");
    return { valid: adminTokenValid(data.token) };
  });

const AudioInput = z.object({
  adminToken: OptionalToken,
  recordingId: z.string().uuid(),
});

/** Short-lived playback link for a stored call recording. */
export const getAudioUrl = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AudioInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none") throw new Error("Sign in or enter the master PIN first");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: recording, error: lookupError } = await supabaseAdmin
      .from("call_recordings")
      .select("audio_url, agent_id")
      .eq("id", data.recordingId)
      .maybeSingle();
    if (lookupError) throw new Error("Could not load this recording");
    if (!recording?.audio_url) throw new Error("This recording has no audio");
    if (caller.scope === "agent" && recording.agent_id !== caller.profile?.id) {
      throw new Error("This recording belongs to another agent");
    }
    const { data: signed, error } = await supabaseAdmin.storage
      .from("call-audio")
      .createSignedUrl(recording.audio_url, 5 * 60);
    if (error || !signed) throw new Error("Could not create playback link");
    return { url: signed.signedUrl };
  });

/** Splits every unassigned lead evenly across the active agents. Coordinator or PIN. */
export const autoDistributeLeads = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: OptionalToken }).parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller, requireDispatch, requireWrite } = await import("@/lib/access.server");
    const mutator = await resolveCaller(data.adminToken ?? null);
    requireDispatch(mutator);
    requireWrite(mutator);
    // Same idempotent daily rule as the Coordinator Deck: per-agent quota
    // (default 50), oldest eligible first, today's allocations preserved.
    const { distributeDailyLeads, dailyPlan } = await import("@/lib/lead-pool.server");
    const plan = await dailyPlan();
    const result = await distributeDailyLeads({
      perAgent: plan.perAgent,
      actorProfileId: mutator.profile?.id ?? null,
      actorLabel: mutator.profile?.name ?? "IT Console",
      trigger: "manual",
    });
    return { assigned: result.moved, agents: result.agents };
  });

const ImportRow = z.object({
  name: z.string().trim().min(1).max(120),
  phone_number: z.string().trim().min(6).max(24),
  company: z.string().trim().max(120).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  outreach_en: z.string().trim().max(2000).optional().nullable(),
  outreach_bn: z.string().trim().max(2000).optional().nullable(),
});

/** Bulk-inserts leads from a CSV (parsed in the browser). Skips numbers already in the pipeline. */
export const importLeads = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        adminToken: OptionalToken,
        rows: z.array(ImportRow).min(1).max(5000),
        autoAssign: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireLeadHub } = await import("@/lib/access.server");
    await requireLeadHub(data.adminToken);
    const importer = { profile: null as null, label: "LeadHub Nexus" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getLeadPhoneStatus } = await import("@/lib/lead-eligibility.server");
    const { appendCompanyLeadMetadata, extractBangladeshPhones } = await import(
      "@/lib/lead-phone"
    );

    // Canonical flow: imports land in LeadHub as UNASSIGNED. The
    // legacy autoAssign flag is accepted for old clients but ignored.
    let agents: { id: string }[] = [];
    if (false as boolean) {
      const { data: activeAgents, error } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("is_active", true)
        .in("role", ["agent", "team_leader"])
        .order("name");
      if (error) throw new Error(error.message);
      agents = activeAgents ?? [];
    }

    const toInsert: {
      name: string;
      phone_number: string;
      company: string | null;
      notes: string | null;
      source: string;
      assigned_to: string | null;
      assignment_source: string | null;
    }[] = [];
    const incoming = data.rows.length;
    let excludedAlreadyWorkedOrAssigned = 0;
    let excludedDuplicate = 0;
    const seen = new Set<string>();

    // Eligibility is one DB round trip per row, so run them in small parallel
    // batches — a few thousand rows checked strictly one by one would outlive
    // the request and leave a half-finished import.
    const CHECK_CONCURRENCY = 25;
    const statuses: { existingLeadId: string | null; alreadyWorked: boolean }[] = [];
    for (let i = 0; i < data.rows.length; i += CHECK_CONCURRENCY) {
      const slice = data.rows.slice(i, i + CHECK_CONCURRENCY);
      statuses.push(
        ...(await Promise.all(slice.map((row) => getLeadPhoneStatus(row.phone_number)))),
      );
    }

    data.rows.forEach((row, index) => {
      const status = statuses[index]!;
      const phones = extractBangladeshPhones(row.phone_number);
      if (status.alreadyWorked) {
        excludedAlreadyWorkedOrAssigned += 1;
        return;
      }
      if (phones.length === 0 || status.existingLeadId || phones.some((p) => seen.has(p))) {
        excludedDuplicate += 1;
        return;
      }
      phones.forEach((phone) => seen.add(phone));
      toInsert.push({
        name: row.name,
        phone_number: phones.length > 1 ? row.phone_number.trim() : phones[0]!,
        company: row.company || null,
        notes: appendCompanyLeadMetadata({
          notes: row.notes ?? null,
          outreachEn: row.outreach_en ?? null,
          outreachBn: row.outreach_bn ?? null,
        }),
        source: "Winstone Company",
        // Imports always land unassigned; only LeadHub quantity assignment
        // moves leads to agents.
        assigned_to: null,
        assignment_source: null,
      });
    });

    // Bulk insert in chunks; if a chunk trips a duplicate-phone guard, retry
    // that chunk row by row so one bad number cannot drop the rest.
    let eligibleNew = 0;
    const INSERT_CHUNK = 100;
    for (let i = 0; i < toInsert.length; i += INSERT_CHUNK) {
      const chunk = toInsert.slice(i, i + INSERT_CHUNK);
      const { error } = await supabaseAdmin.from("leads").insert(chunk);
      if (!error) {
        eligibleNew += chunk.length;
        continue;
      }
      for (const lead of chunk) {
        const { error: rowError } = await supabaseAdmin.from("leads").insert(lead);
        if (!rowError) eligibleNew += 1;
        else if (rowError.code === "23505" || rowError.code === "22023") excludedDuplicate += 1;
        else throw new Error(rowError.message);
      }
    }
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "lead_imported",
      entityType: "lead",
      actorProfileId: null,
      actorLabel: importer.label,
      metadata: {
        incoming,
        excludedAlreadyWorkedOrAssigned,
        excludedDuplicate,
        eligibleNew,
        autoAssign: false,
        destination: "canonical_lead_database",
        source: "Winstone Company",
        leadType: "Company Lead",
      },
    });
    return {
      imported: eligibleNew,
      skipped: excludedAlreadyWorkedOrAssigned + excludedDuplicate,
      incoming,
      excludedAlreadyWorkedOrAssigned,
      excludedDuplicate,
      eligibleNew,
    };
  });

const ManualCallInput = z.object({
  adminToken: OptionalToken,
  leadId: z.string().uuid(),
  agentId: z.string().uuid().nullable(),
  audioBase64: z.string().min(1),
  fileExtension: z.string().min(1).max(5),
  durationSeconds: z.number().int().min(0),
  direction: z.enum(["outgoing", "incoming_callback"]),
  isTwoSided: z.boolean(),
});

/** Manual log: upload a recording by hand and run the AI analysis on it. */
export const uploadCallRecording = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ManualCallInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller, requireDispatch, requireWrite } = await import("@/lib/access.server");
    const mutator = await resolveCaller(data.adminToken ?? null);
    requireDispatch(mutator);
    requireWrite(mutator);
    const { adminToken: _token, ...payload } = data;
    const { ingestRecording, processRecording } = await import("@/lib/call-intel.server");
    const recordingId = await ingestRecording(payload);
    await processRecording(recordingId);
    return { recordingId };
  });

const ManualMessageInput = z.object({
  adminToken: OptionalToken,
  leadId: z.string().uuid(),
  agentId: z.string().uuid().nullable(),
  senderType: z.enum(["agent", "customer"]),
  messageType: z.enum(["text", "voice_note", "image", "document"]),
  messageContent: z.string().min(1),
});

/** Manual log: record a WhatsApp message against a lead. */
export const logWhatsappMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ManualMessageInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller, requireDispatch, requireWrite } = await import("@/lib/access.server");
    const mutator = await resolveCaller(data.adminToken ?? null);
    requireDispatch(mutator);
    requireWrite(mutator);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("whatsapp_interactions").insert({
      lead_id: data.leadId,
      agent_id: data.agentId,
      sender_type: data.senderType,
      message_type: data.messageType,
      message_content: data.messageContent,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ReanalyzeInput = z.object({ adminToken: AdminToken, recordingId: z.string().uuid() });

/** Re-runs transcription and AI analysis for one recording. Admin PIN required. */
export const reanalyzeRecording = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ReanalyzeInput.parse(input))
  .handler(async ({ data }) => {
    const { requireAdminToken } = await import("@/lib/admin-gate.server");
    requireAdminToken(data.adminToken);
    const { processRecording } = await import("@/lib/call-intel.server");
    await processRecording(data.recordingId);
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "recording_reprocessed",
      entityType: "call_recording",
      entityId: data.recordingId,
    });
    return { ok: true };
  });

const AssignInput = z.object({
  adminToken: OptionalToken,
  agentId: z.string().uuid(),
  count: z.number().int().min(1).max(2000),
  onlyUnassigned: z.boolean().default(true),
});

/** Coordinator dispatcher: push a batch of pending leads under one agent. */
export const assignLeadsToAgent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => AssignInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller, requireDispatch } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireDispatch(caller);
    (await import("@/lib/access.server")).requireWrite(caller);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("leads")
      .select("id, assigned_to")
      .eq("status", "pending")
      .order("created_at")
      .limit(data.count);
    if (data.onlyUnassigned) {
      const { assertDistributionDay } = await import("@/lib/business-day");
      assertDistributionDay();
      query = query.is("assigned_to", null);
    }
    else query = query.neq("assigned_to", data.agentId);

    const { data: candidates, error } = await query;
    if (error) throw new Error(error.message);
    const { eligibleLeadIds } = await import("@/lib/lead-eligibility.server");
    const eligible = new Set(await eligibleLeadIds((candidates ?? []).map((lead) => lead.id)));
    const pool = (candidates ?? []).filter((lead) => eligible.has(lead.id));
    if (!pool?.length) return { assigned: 0 };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("leads")
      .update({
        assigned_to: data.agentId,
        assigned_agent_id: data.agentId,
        assignment_source: "coordinator",
      })
      .in(
        "id",
        pool.map((l) => l.id),
      )
      .is("assigned_to", null)
      .is("assigned_agent_id", null)
      .select("id");
    if (updateError) throw new Error(updateError.message);
    const updatedIds = new Set((updated ?? []).map((lead) => lead.id));
    const assignedRows = pool.filter((lead) => updatedIds.has(lead.id));

    // Audit trail so the Coordinator Deck can show who moved what.
    await supabaseAdmin.from("lead_assignments").insert(
      assignedRows.map((l) => ({
        lead_id: l.id,
        from_agent_id: l.assigned_to ?? null,
        to_agent_id: data.agentId,
        source: "coordinator",
      })),
    );

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "lead_assigned",
      entityType: "lead",
      entityId: null,
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: caller.profile?.name ?? "Authority PIN",
      metadata: { agentId: data.agentId, count: assignedRows.length, source: "coordinator" },
    });
    return { assigned: assignedRows.length };
  });
