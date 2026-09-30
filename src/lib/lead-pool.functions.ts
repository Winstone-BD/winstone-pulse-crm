import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * The canonical lead database, reachable only through LeadHub Nexus.
 * The real work (duplicate protection, batched hand-out, shortage alert)
 * lives in lead-pool.server.ts.
 */

const TokenInput = z.object({ adminToken: z.string().nullable().optional() });

async function dispatcher(adminToken: string | null | undefined) {
  const { resolveCaller, requireLeadHub } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken ?? null);
  requireLeadHub(caller, adminToken);
  return caller;
}

export type LeadPoolAgent = {
  id: string;
  name: string;
  total: number;
  pending: number;
  today: number;
};

/** Read access is restricted to the dedicated LeadHub PIN. */
async function deckReader(adminToken: string | null | undefined) {
  const { resolveCaller, requireLeadHub } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken ?? null);
  requireLeadHub(caller, adminToken);
  return caller;
}

const HeadLeadInput = z.object({
  adminToken: z.string().nullable().optional(),
  name: z.string().trim().min(1, "নাম লিখুন").max(120),
  phoneNumber: z.string().trim().min(6, "মোবাইল নম্বর দিন").max(40),
  address: z.string().trim().max(300).nullable().optional(),
  company: z.string().trim().max(160).nullable().optional(),
  serialNo: z.string().trim().max(40).nullable().optional(),
  referenceBy: z.string().trim().min(1, "রেফারেন্স লিখুন").max(120),
  notes: z.string().trim().max(1000).nullable().optional(),
});

export type HeadLeadResult =
  | { ok: true; leadId: string }
  | {
      ok: false;
      reason: "duplicate" | "invalid_phone";
      message: string;
      existing?: undefined | {
        id: string;
        name: string;
        serialNo: string | null;
        referenceBy: string | null;
        status: string;
        agentName: string | null;
      };
    };

/**
 * Adds one lead to the HEAD DATABASE (unassigned pool) — never to the caller's
 * own queue. Duplicate protection and phone normalisation are server-side.
 */
export const addHeadLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => HeadLeadInput.parse(input))
  .handler(async ({ data }): Promise<HeadLeadResult> => {
    const caller = await deckReader(data.adminToken);
    const { requireWrite } = await import("@/lib/access.server");
    requireWrite(caller);
    const { intakeLead, InvalidLeadPhoneError } = await import("@/lib/lead-intake.server");
    const { HEAD_DATABASE_SOURCE } = await import("@/lib/head-lead");
    const actorLabel = caller.profile
      ? `${caller.profile.name}${caller.profile.employee_id ? ` (${caller.profile.employee_id})` : ""}`
      : "IT Console";
    try {
      const result = await intakeLead({
        name: data.name,
        phoneNumber: data.phoneNumber,
        company: data.company ?? null,
        address: data.address ?? null,
        serialNo: data.serialNo ?? null,
        referenceBy: data.referenceBy,
        notes: data.notes ?? null,
        ownerId: null,
        source: HEAD_DATABASE_SOURCE,
        actorProfileId: caller.profile?.id ?? null,
        actorLabel,
      });
      if (result.duplicate) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("leads")
          .select("id, name, serial_no, reference_by, status, assigned_to")
          .eq("id", result.leadId)
          .maybeSingle();
        let agentName: string | null = null;
        if (row?.assigned_to) {
          const { data: agent } = await supabaseAdmin
            .from("profiles")
            .select("name")
            .eq("id", row.assigned_to)
            .maybeSingle();
          agentName = agent?.name ?? null;
        }
        return {
          ok: false,
          reason: "duplicate",
          message: "এই নম্বর আগে থেকেই CRM-এ আছে — নতুন লিড তৈরি হয়নি",
          existing: row
            ? {
                id: row.id,
                name: row.name,
                serialNo: row.serial_no,
                referenceBy: row.reference_by,
                status: row.status,
                agentName,
              }
            : undefined,
        };
      }
      return { ok: true, leadId: result.leadId };
    } catch (err) {
      if (err instanceof InvalidLeadPhoneError) {
        return { ok: false, reason: "invalid_phone", message: err.message };
      }
      throw err;
    }
  });

const SearchInput = z.object({
  adminToken: z.string().nullable().optional(),
  q: z.string().trim().max(80).optional(),
  agentId: z.string().uuid().nullable().optional(),
  status: z.enum(["pending", "contacted", "follow_up", "closed"]).nullable().optional(),
  source: z.string().trim().max(40).nullable().optional(),
  scope: z.enum(["pool", "all"]).default("pool"),
});

/** Lead search across the deck: reference, serial, phone or name, plus filters. */
export const searchDeckLeads = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => SearchInput.parse(input))
  .handler(async ({ data }) => {
    const caller = await deckReader(data.adminToken);
    const scope = data.scope;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("leads")
      .select(
        "id, name, phone_number, serial_no, reference_by, source, status, assigned_to, assignment_source, address, company, created_at, work_date",
      )
      .order("created_at", { ascending: false })
      .limit(100);
    if (scope === "pool") {
      query = query
        .is("assigned_to", null)
        .or("assignment_source.is.null,assignment_source.neq.duplicate_skipped");
    } else if (data.agentId) {
      query = query.eq("assigned_to", data.agentId);
    }
    if (data.status) query = query.eq("status", data.status);
    if (data.source) query = query.eq("source", data.source);
    const q = data.q?.replace(/[,()*%]/g, " ").trim();
    if (q) {
      const digits = q.replace(/\D/g, "");
      const parts = [
        `reference_by.ilike.%${q}%`,
        `serial_no.ilike.%${q}%`,
        `name.ilike.%${q}%`,
      ];
      if (digits.length >= 4) parts.push(`phone_number.ilike.%${digits.slice(-10)}%`);
      query = query.or(parts.join(","));
    }
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const ownerIds = [...new Set((rows ?? []).map((r) => r.assigned_to).filter(Boolean))] as string[];
    const names = new Map<string, string>();
    if (ownerIds.length) {
      const { data: owners } = await supabaseAdmin.from("profiles").select("id, name").in("id", ownerIds);
      for (const o of owners ?? []) names.set(o.id, o.name);
    }
    return {
      scope,
      rows: (rows ?? []).map((r) => ({
        ...r,
        agentName: r.assigned_to ? (names.get(r.assigned_to) ?? null) : null,
      })),
    };
  });

/** What is in the database right now, and what each agent already holds. */
export const leadPoolStatus = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    await deckReader(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { dhakaToday, usablePoolCount, activeAgents, dailyPlan } = await import(
      "@/lib/lead-pool.server"
    );
    const today = dhakaToday();

    const [poolCount, agents, plan, { data: previewCandidates }, { data: assigned }, { data: audits }] = await Promise.all([
      usablePoolCount(),
      activeAgents(),
      dailyPlan(),
      supabaseAdmin
        .from("leads")
        .select("id, name, phone_number, serial_no, reference_by, created_at")
        .is("assigned_to", null)
        .or("assignment_source.is.null,assignment_source.neq.duplicate_skipped")
        .order("created_at", { ascending: true })
        .limit(100),
      supabaseAdmin
        .from("leads")
        .select("assigned_to, status, work_date")
        .not("assigned_to", "is", null)
        .limit(20000),
      supabaseAdmin
        .from("audit_logs")
        .select("created_at, metadata")
        .eq("action", "lead_imported")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    const { eligibleLeadIds } = await import("@/lib/lead-eligibility.server");
    const previewIds = new Set(
      await eligibleLeadIds((previewCandidates ?? []).map((lead) => lead.id)),
    );
    const preview = (previewCandidates ?? []).filter((lead) => previewIds.has(lead.id)).slice(0, 12);

    const rows = assigned ?? [];
    const rawImportMetadata = audits?.[0]?.metadata;
    const importMetadata =
      rawImportMetadata && typeof rawImportMetadata === "object" && !Array.isArray(rawImportMetadata)
        ? rawImportMetadata
        : null;
    const perAgent: LeadPoolAgent[] = agents.map((agent) => {
      const mine = rows.filter((row) => row.assigned_to === agent.id);
      return {
        id: agent.id,
        name: agent.name,
        total: mine.length,
        pending: mine.filter((row) => row.status === "pending").length,
        today: mine.filter((row) => row.work_date === today).length,
      };
    });

    const need = agents.length * plan.perAgent;
    return {
      today,
      poolCount,
      preview: preview ?? [],
      agents: perAgent,
      dailyPerAgent: plan.perAgent,
      lastRunDate: plan.lastRunDate,
      shortage: poolCount < need,
      neededForNextRound: Math.max(0, need - poolCount),
      daysLeft: need > 0 ? Math.floor(poolCount / need) : 0,
      latestImport:
        audits?.[0] && importMetadata
          ? {
              createdAt: audits[0].created_at,
              incoming: Number(importMetadata["incoming"] ?? 0),
              excludedAlreadyWorkedOrAssigned: Number(
                importMetadata["excludedAlreadyWorkedOrAssigned"] ?? 0,
              ),
              excludedDuplicate: Number(importMetadata["excludedDuplicate"] ?? 0),
              eligibleNew: Number(importMetadata["eligibleNew"] ?? 0),
            }
          : null,
    };
  });

const DistributeInput = z.object({
  adminToken: z.string().nullable().optional(),
  /** How many database leads each active agent should receive today. */
  perAgent: z.number().int().min(1).max(500),
  /** Also make this the amount the automatic daily run uses. */
  saveAsDaily: z.boolean().optional(),
  /** Desks to skip today — e.g. an account still waiting for HQ approval. */
  excludeEmployeeIds: z.array(z.string().trim().max(32)).max(20).optional(),
  /** Give everyone included exactly `perAgent`, ignoring lighter fixed quotas. */
  ignoreFixedQuota: z.boolean().optional(),
});

/** Hands the same number of database leads to every active agent. */
export const distributeLeadPool = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => DistributeInput.parse(input))
  .handler(async ({ data }) => {
    const caller = await dispatcher(data.adminToken);
    const { requireWrite } = await import("@/lib/access.server");
    requireWrite(caller);

    const { distributeDailyLeads, saveDailyPlan, dhakaToday } = await import(
      "@/lib/lead-pool.server"
    );
    const result = await distributeDailyLeads({
      perAgent: data.perAgent,
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: caller.profile?.name ?? "IT Console",
      trigger: "manual",
      excludeEmployeeIds: data.excludeEmployeeIds,
      ignoreFixedQuota: data.ignoreFixedQuota,
    });
    if (data.saveAsDaily) await saveDailyPlan({ perAgent: data.perAgent });
    await saveDailyPlan({ perAgent: data.perAgent, lastRunDate: dhakaToday() });
    return result;
  });

/** Changes only the daily automatic amount, without handing leads out now. */
export const setDailyLeadPlan = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({ perAgent: z.number().int().min(1).max(500) }).parse(input),
  )
  .handler(async ({ data }) => {
    const caller = await dispatcher(data.adminToken);
    const { requireWrite } = await import("@/lib/access.server");
    requireWrite(caller);
    const { saveDailyPlan } = await import("@/lib/lead-pool.server");
    await saveDailyPlan({ perAgent: data.perAgent });
    return { perAgent: data.perAgent };
  });

const ExtraInput = z.object({
  adminToken: z.string().nullable().optional(),
  agentProfileId: z.string().uuid(),
  quantity: z.number().int().min(1).max(200),
  reason: z.string().trim().max(300).nullable().optional(),
});

/**
 * Extra leads above the base quota — available from the IT Console and the
 * Coordinator Deck. The person's default daily quota is not changed.
 */
export const grantExtraLeadPool = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ExtraInput.parse(input))
  .handler(async ({ data }) => {
    const caller = await dispatcher(data.adminToken);
    const { requireWrite } = await import("@/lib/access.server");
    requireWrite(caller);
    const { grantExtraLeads } = await import("@/lib/lead-pool.server");
    return grantExtraLeads({
      agentProfileId: data.agentProfileId,
      quantity: data.quantity,
      reason: data.reason ?? null,
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: caller.profile?.name ?? "IT Console",
    });
  });

/** Base quota vs extra leads for today, per agent. */
export const quotaOverview = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    await deckReader(data.adminToken);
    const { activeAgents, dailyPlan, extraGrantsToday, dhakaToday } = await import(
      "@/lib/lead-pool.server"
    );
    const { quotaFor } = await import("@/lib/lead-quota");
    const [agents, plan, extra] = await Promise.all([
      activeAgents(),
      dailyPlan(),
      extraGrantsToday(),
    ]);
    return {
      workDate: dhakaToday(),
      floorQuota: plan.perAgent,
      rows: agents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        employeeId: agent.employee_id ?? null,
        baseQuota: quotaFor(agent.employee_id, plan.perAgent),
        extraToday: extra[agent.id] ?? 0,
      })),
    };
  });

// ─── HEAD LEAD STORE ────────────────────────────────────────────────────────

const StoreInput = z.object({
  adminToken: z.string().nullable().optional(),
  q: z.string().trim().max(80).optional(),
  assignment: z.enum(["all", "unassigned", "assigned", "duplicate"]).default("all"),
  agentId: z.string().uuid().nullable().optional(),
  status: z.enum(["pending", "contacted", "follow_up", "closed"]).nullable().optional(),
  source: z.string().trim().max(60).nullable().optional(),
  temperature: z.string().trim().max(20).nullable().optional(),
  quality: z.enum(["any", "missing_reference", "invalid_phone"]).default("any"),
  limit: z.number().int().min(1).max(500).default(200),
});

const BD_MOBILE = /^(?:\+?88)?01[3-9]\d{8}$/;

/**
 * Master Lead Store: every lead, permanently. Coordinator/authority see the
 * whole store; the Sell Team Admin (intake) sees the unassigned pool only.
 * Agents are refused server-side.
 */
export const listLeadStore = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => StoreInput.parse(input))
  .handler(async ({ data }) => {
    const caller = await deckReader(data.adminToken);
    const { deckAccess } = await import("@/lib/access.server");
    const full = deckAccess(caller) === "full";
    const assignment = full ? data.assignment : "unassigned";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let query = supabaseAdmin
      .from("leads")
      .select(
        "id, serial_no, name, phone_number, address, company, notes, reference_by, source, status, temperature, grade, outcome_category, assigned_to, assignment_source, work_date, last_call_at, created_at",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (assignment === "unassigned") {
      query = query
        .is("assigned_to", null)
        .or("assignment_source.is.null,assignment_source.neq.duplicate_skipped");
    } else if (assignment === "assigned") {
      query = query.not("assigned_to", "is", null);
    } else if (assignment === "duplicate") {
      query = query.eq("assignment_source", "duplicate_skipped");
    }
    if (full && data.agentId) query = query.eq("assigned_to", data.agentId);
    if (data.status) query = query.eq("status", data.status);
    if (data.source) query = query.eq("source", data.source);
    if (data.temperature) query = query.ilike("temperature", data.temperature);
    if (data.quality === "missing_reference") query = query.or("reference_by.is.null,reference_by.eq.");
    const q = data.q?.replace(/[,()*%]/g, " ").trim();
    if (q) {
      const digits = q.replace(/\D/g, "");
      const parts = [
        `reference_by.ilike.%${q}%`,
        `serial_no.ilike.%${q}%`,
        `name.ilike.%${q}%`,
        `company.ilike.%${q}%`,
      ];
      if (digits.length >= 4) parts.push(`phone_number.ilike.%${digits.slice(-10)}%`);
      query = query.or(parts.join(","));
    }
    const { data: rows, error, count } = await query;
    if (error) throw new Error(error.message);
    let list = rows ?? [];
    if (data.quality === "invalid_phone") {
      list = list.filter((r) => !BD_MOBILE.test(r.phone_number.replace(/[\s-]/g, "")));
    }
    const ids = list.map((r) => r.id);
    const ownerIds = [...new Set(list.map((r) => r.assigned_to).filter(Boolean))] as string[];
    const [owners, follows] = await Promise.all([
      ownerIds.length
        ? supabaseAdmin.from("profiles").select("id, name, employee_id").in("id", ownerIds)
        : Promise.resolve({ data: [] as { id: string; name: string; employee_id: string | null }[] }),
      ids.length
        ? supabaseAdmin
            .from("follow_up_events")
            .select("lead_id, scheduled_at, status")
            .in("lead_id", ids)
            .order("scheduled_at", { ascending: true })
        : Promise.resolve({ data: [] as { lead_id: string; scheduled_at: string; status: string }[] }),
    ]);
    const names = new Map((owners.data ?? []).map((o) => [o.id, o.name]));
    const nextFollow = new Map<string, string>();
    for (const f of (follows.data ?? []) as { lead_id: string; scheduled_at: string; status: string }[]) {
      if (f.status !== "done" && !nextFollow.has(f.lead_id)) nextFollow.set(f.lead_id, f.scheduled_at);
    }
    return {
      full,
      total: count ?? list.length,
      rows: list.map((r) => ({
        ...r,
        agentName: r.assigned_to ? (names.get(r.assigned_to) ?? null) : null,
        nextFollowUp: nextFollow.get(r.id) ?? null,
        duplicate: r.assignment_source === "duplicate_skipped",
        invalidPhone: !BD_MOBILE.test(r.phone_number.replace(/[\s-]/g, "")),
      })),
    };
  });

/** Coordinator Deck dashboard numbers — live counts, never demo values. */
export const deckKpis = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    await deckReader(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { dhakaToday, usablePoolCount, activeAgents, dailyPlan } = await import(
      "@/lib/lead-pool.server"
    );
    const today = dhakaToday();
    const head = () => supabaseAdmin.from("leads").select("id", { count: "exact", head: true });
    const [total, unassigned, assignedToday, duplicate, missingRef, ready, agents, plan, assignedAll] =
      await Promise.all([
        head(),
        head()
          .is("assigned_to", null)
          .or("assignment_source.is.null,assignment_source.neq.duplicate_skipped"),
        head().not("assigned_to", "is", null).eq("work_date", today),
        head().eq("assignment_source", "duplicate_skipped"),
        head().or("reference_by.is.null,reference_by.eq."),
        usablePoolCount(),
        activeAgents(),
        dailyPlan(),
        head().not("assigned_to", "is", null),
      ]);
    // Invalid phones: scan unassigned rows only (bounded).
    const { data: phones } = await supabaseAdmin
      .from("leads")
      .select("phone_number")
      .is("assigned_to", null)
      .limit(5000);
    const invalid = (phones ?? []).filter(
      (r) => !BD_MOBILE.test(r.phone_number.replace(/[\s-]/g, "")),
    ).length;
    return {
      today,
      totalStore: total.count ?? 0,
      unassigned: unassigned.count ?? 0,
      assigned: assignedAll.count ?? 0,
      readyToday: ready,
      assignedToday: assignedToday.count ?? 0,
      duplicate: duplicate.count ?? 0,
      invalid,
      missingData: missingRef.count ?? 0,
      availableAgents: agents.length,
      perAgent: plan.perAgent,
      neededToday: agents.length * plan.perAgent,
    };
  });

const ManualAssignInput = z.object({
  adminToken: z.string().nullable().optional(),
  agentId: z.string().uuid(),
  leadIds: z.array(z.string().uuid()).min(1).max(200),
});

/**
 * Manual assignment of selected Lead Store rows to one active approved agent.
 * Only unassigned, eligible, non-duplicate rows move; each move is atomic
 * (assigned_to IS NULL guard) so a lead can never reach two agents.
 */
export const assignSelectedLeads = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ManualAssignInput.parse(input))
  .handler(async ({ data }) => {
    const caller = await dispatcher(data.adminToken);
    const { requireWrite } = await import("@/lib/access.server");
    requireWrite(caller);
    const { assertDistributionDay } = await import("@/lib/business-day");
    assertDistributionDay();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { activeAgents, dhakaToday } = await import("@/lib/lead-pool.server");
    const agent = (await activeAgents()).find((a) => a.id === data.agentId);
    if (!agent) throw new Error("এই এজেন্ট সক্রিয়/অনুমোদিত নয়");

    const { data: candidates, error } = await supabaseAdmin
      .from("leads")
      .select("id, assignment_source")
      .in("id", data.leadIds)
      .is("assigned_to", null);
    if (error) throw new Error(error.message);
    const open = (candidates ?? []).filter((l) => l.assignment_source !== "duplicate_skipped");
    const { eligibleLeadIds } = await import("@/lib/lead-eligibility.server");
    const eligible = new Set(await eligibleLeadIds(open.map((l) => l.id)));
    const ids = open.filter((l) => eligible.has(l.id)).map((l) => l.id);
    if (!ids.length) return { assigned: 0, skipped: data.leadIds.length };

    const { data: updated, error: updateError } = await supabaseAdmin
      .from("leads")
      .update({
        assigned_to: agent.id,
        assigned_agent_id: agent.id,
        assignment_source: "coordinator",
        work_date: dhakaToday(),
      })
      .in("id", ids)
      .is("assigned_to", null)
      .is("assigned_agent_id", null)
      .select("id");
    if (updateError) throw new Error(updateError.message);
    const moved = (updated ?? []).map((r) => r.id);
    if (moved.length) {
      await supabaseAdmin.from("lead_assignments").insert(
        moved.map((id) => ({ lead_id: id, from_agent_id: null, to_agent_id: agent.id, source: "coordinator_manual" })),
      );
      const { logAudit } = await import("@/lib/audit.server");
      await logAudit({
        action: "lead_assigned",
        entityType: "lead",
        entityId: null,
        actorProfileId: caller.profile?.id ?? null,
        actorLabel: caller.profile?.name ?? "IT Console",
        metadata: { agentId: agent.id, count: moved.length, source: "coordinator_manual", leadIds: moved },
      });
    }
    return { assigned: moved.length, skipped: data.leadIds.length - moved.length };
  });

/** Import batch history for the Coordinator Deck. */
export const importHistory = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    await deckReader(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("audit_logs")
      .select("id, created_at, actor_label, metadata")
      .eq("action", "lead_imported")
      .order("created_at", { ascending: false })
      .limit(30);
    return (rows ?? []).map((r) => {
      const m = (r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata) ? r.metadata : {}) as Record<string, unknown>;
      return {
        id: r.id,
        createdAt: r.created_at,
        actor: r.actor_label,
        incoming: Number(m["incoming"] ?? 0),
        imported: Number(m["eligibleNew"] ?? 0),
        duplicates: Number(m["excludedDuplicate"] ?? 0),
        alreadyWorked: Number(m["excludedAlreadyWorkedOrAssigned"] ?? 0),
      };
    });
  });
