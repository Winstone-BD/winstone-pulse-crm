import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * The head lead database, reachable from both the IT Console and the Coordinator
 * Deck. The real work (duplicate protection, batched hand-out, shortage alert)
 * lives in lead-pool.server.ts.
 */

const TokenInput = z.object({ adminToken: z.string().nullable().optional() });

async function dispatcher(adminToken: string | null | undefined) {
  const { resolveCaller, requireDispatch } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken ?? null);
  requireDispatch(caller);
  return caller;
}

export type LeadPoolAgent = {
  id: string;
  name: string;
  total: number;
  pending: number;
  today: number;
};

/** What is in the database right now, and what each agent already holds. */
export const leadPoolStatus = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    await dispatcher(data.adminToken);
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
    await dispatcher(data.adminToken);
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
