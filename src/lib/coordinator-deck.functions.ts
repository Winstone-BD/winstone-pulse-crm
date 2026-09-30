import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const MAX_FAILS = 5;
const WINDOW_MS = 15 * 60 * 1000;

/** Gmail-signed-in user enters the Coordinator PIN; returns a deck-only token. */
export const unlockCoordinatorDeck = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ pin: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(null);
    if (!caller.userId) return { ok: false as const, reason: "signin" as const };
    // Approved agent/HQ accounts keep their own access — this shortcut never widens them.
    if (caller.scope !== "none") return { ok: false as const, reason: "account" as const };
    const gate = await import("@/lib/coordinator-gate.server");
    const email = await gate.googleEmailFor(caller.userId);
    if (!email) return { ok: false as const, reason: "gmail" as const };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { count } = await supabaseAdmin
      .from("audit_logs")
      .select("id", { count: "exact", head: true })
      .eq("action", "coordinator_pin_failed")
      .eq("entity_id", caller.userId)
      .gte("created_at", since);
    if ((count ?? 0) >= MAX_FAILS) return { ok: false as const, reason: "locked" as const };

    const { logAudit } = await import("@/lib/audit.server");
    if (!gate.coordinatorPinMatches(data.pin)) {
      await logAudit({
        action: "coordinator_pin_failed",
        entityType: "coordinator_deck",
        entityId: caller.userId,
        actorLabel: email,
      });
      return { ok: false as const, reason: "pin" as const };
    }
    await logAudit({
      action: "coordinator_pin_unlocked",
      entityType: "coordinator_deck",
      entityId: caller.userId,
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: email,
    });
    return { ok: true as const, token: gate.mintCoordinatorToken(caller.userId), email };
  });

/** Is this device's deck token still good for the signed-in user? */
export const coordinatorDeckStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, deckAccess } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    return { deck: deckAccess(caller), signedIn: Boolean(caller.userId), label: caller.label ?? caller.profile?.name ?? null };
  });

async function fullDeck(adminToken: string | null | undefined) {
  const { requireLeadHub } = await import("@/lib/access.server");
  requireLeadHub(adminToken);
  return { caller: { profile: null, label: "LeadHub Nexus" } };
}

/** Available pool + each active approved agent's allocation today. */
export const coordinatorAllocation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    await fullDeck(data.adminToken);
    const pool = await import("@/lib/lead-pool.server");
    const today = pool.dhakaToday();
    const { isDistributionDay, FRIDAY_BLOCK_MESSAGE } = await import("@/lib/business-day");
    const distributionOpen = isDistributionDay(today);
    const [available, agents, held, plan] = await Promise.all([
      pool.usablePoolCount(),
      pool.activeAgents(),
      pool.assignedTodayByAgent(today),
      pool.dailyPlan(),
    ]);
    return {
      today,
      distributionOpen,
      distributionNotice: distributionOpen ? null : FRIDAY_BLOCK_MESSAGE,
      available,
      perAgent: plan.perAgent,
      agents: agents.map((a) => ({
        id: a.id,
        name: a.name,
        employeeId: a.employee_id,
        today: held.get(a.id) ?? 0,
      })),
    };
  });

const BatchInput = z.object({
  adminToken: z.string().nullable().optional(),
  requestId: z.string().uuid(),
  rows: z
    .array(z.object({ agentId: z.string().uuid(), count: z.number().int().min(1).max(500) }))
    .min(1)
    .max(40),
}).superRefine((value, ctx) => {
  const ids = value.rows.map((row) => row.agentId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", message: "একই এজেন্ট একাধিকবার দেওয়া যাবে না", path: ["rows"] });
});

/**
 * Assigns an exact number of the oldest eligible unassigned leads to each
 * agent. Idempotent per requestId, guarded so a lead can reach only one agent,
 * never touches leads already assigned (today's allocations stay as they are).
 */
export const assignLeadCounts = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => BatchInput.parse(input))
  .handler(async ({ data }) => {
    const { caller } = await fullDeck(data.adminToken);
    const { assertDistributionDay } = await import("@/lib/business-day");
    assertDistributionDay();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const pool = await import("@/lib/lead-pool.server");
    const { eligibleLeadIds } = await import("@/lib/lead-eligibility.server");
    const { logAudit } = await import("@/lib/audit.server");

    // Same requestId already ran (double click / retry) → return that result.
    const { data: prior } = await supabaseAdmin
      .from("audit_logs")
      .select("metadata")
      .eq("action", "lead_assigned")
      .contains("metadata", { requestId: data.requestId });
    if (prior && prior.length) {
      const results = prior.map((p) => {
        const m = (p.metadata ?? {}) as { agentId?: string; count?: number; requested?: number };
        return { agentId: m.agentId ?? "", requested: m.requested ?? 0, assigned: m.count ?? 0 };
      });
      return { replay: true, results, available: await pool.usablePoolCount() };
    }

    const agents = new Map((await pool.activeAgents()).map((a) => [a.id, a]));
    const today = pool.dhakaToday();
    const held = await pool.assignedTodayByAgent(today);
    const plan = await pool.dailyPlan();
    const results: { agentId: string; requested: number; assigned: number }[] = [];

    for (const row of data.rows) {
      const agent = agents.get(row.agentId);
      if (!agent) {
        results.push({ agentId: row.agentId, requested: row.count, assigned: 0 });
        continue;
      }
      const capacity = Math.max(0, plan.perAgent - (held.get(agent.id) ?? 0));
      const targetCount = Math.min(row.count, capacity);
      let moved: string[] = [];
      for (let attempt = 0; attempt < 4 && moved.length < targetCount; attempt++) {
        const need = targetCount - moved.length;
        const { data: candidates, error } = await supabaseAdmin
          .from("leads")
          .select("id, phone_number")
          .is("assigned_to", null)
          .is("assigned_agent_id", null)
          .eq("status", "pending")
          .or("assignment_source.is.null,assignment_source.neq.duplicate_skipped")
          .order("created_at", { ascending: true })
          .limit(Math.min(1000, need * 3 + 20));
        if (error) throw new Error(error.message);
        const { extractBangladeshPhones } = await import("@/lib/lead-phone");
        const valid = (candidates ?? []).filter((l) => extractBangladeshPhones(l.phone_number ?? "").length > 0);
        if (!valid.length) break;
        const eligible = new Set(await eligibleLeadIds(valid.map((l) => l.id)));
        const ids = valid.filter((l) => eligible.has(l.id)).slice(0, need).map((l) => l.id);
        if (!ids.length) break;
        const { data: updated, error: updateError } = await supabaseAdmin
          .from("leads")
          .update({
            assigned_to: agent.id,
            assigned_agent_id: agent.id,
            assignment_source: "leadhub",
            work_date: today,
          })
          .in("id", ids)
          .is("assigned_to", null)
          .is("assigned_agent_id", null)
          .select("id");
        if (updateError) throw new Error(updateError.message);
        moved = moved.concat((updated ?? []).map((r) => r.id));
        if ((updated ?? []).length === 0 && valid.length < need) break;
      }
      if (moved.length) {
        await supabaseAdmin.from("lead_assignments").insert(
          moved.map((id) => ({ lead_id: id, from_agent_id: null, to_agent_id: agent.id, source: "leadhub_count" })),
        );
      }
      await logAudit({
        action: "lead_assigned",
        entityType: "lead",
        entityId: null,
        actorProfileId: caller.profile?.id ?? null,
          actorLabel: caller.label ?? caller.profile?.name ?? "LeadHub Nexus",
        metadata: {
          requestId: data.requestId,
          agentId: agent.id,
          requested: row.count,
          count: moved.length,
          source: "leadhub_count",
          leadIds: moved,
        },
      });
      results.push({ agentId: agent.id, requested: row.count, assigned: moved.length });
    }
    return { replay: false, results, available: await pool.usablePoolCount() };
  });
