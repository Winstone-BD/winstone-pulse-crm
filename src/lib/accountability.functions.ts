import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const TokenInput = z.object({ adminToken: z.string().nullable().optional() });

/** Agent: own accountability state for today (evaluates yesterday lazily). */
export const myAccountability = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope !== "agent" || !caller.profile) return { locked: false, today: null, reviews: [] };
    const { dhakaDate, isLocked } = await import("@/lib/accountability");
    const { evaluateDay } = await import("@/lib/accountability.server");
    const today = dhakaDate(0);
    await evaluateDay(dhakaDate(-1), [caller.profile.id]);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("agent_accountability_reviews")
      .select(
        "id, business_date, unlock_for_date, assigned_count, eligible_count, completed_count, pending_count, pending_percent, overdue_followups, missed_reports, status, reviewed_at, approval_note",
      )
      .eq("agent_id", caller.profile.id)
      .order("business_date", { ascending: false })
      .limit(5);
    const reviews = (rows ?? []).map((r) => ({ ...r, pending_percent: Number(r.pending_percent) }));
    return { locked: isLocked(reviews as never, today), today, reviews };
  });

/** HQ + IT: review queue. Both may read; nobody else. */
export const listAccountabilityReviews = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({ days: z.number().int().min(1).max(90).optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope !== "authority") throw new Error("Executive HQ or IT access required");
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    const canApprove = adminTokenScope(data.adminToken ?? null) === "hq";

    const { dhakaDate } = await import("@/lib/accountability");
    const { evaluateDay } = await import("@/lib/accountability.server");
    const { activeAgents } = await import("@/lib/lead-pool.server");
    const agents = await activeAgents();
    await evaluateDay(dhakaDate(-1), agents.map((a) => a.id));

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("agent_accountability_reviews")
      .select("*, agent:profiles!agent_accountability_reviews_agent_id_fkey(name, employee_id)")
      .gte("business_date", dhakaDate(-(data.days ?? 30)))
      .order("business_date", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return {
      canApprove,
      reviews: (rows ?? []).map((r) => ({ ...r, pending_percent: Number(r.pending_percent) })),
    };
  });

/** Executive HQ only (HQ PIN session). IT and everyone else are refused. */
export const reviewAccountability = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({
      id: z.string().uuid(),
      action: z.enum(["approve", "hold", "note"]),
      note: z.string().trim().max(1000).optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    if (adminTokenScope(data.adminToken ?? null) !== "hq") {
      throw new Error("Only Executive HQ can review or unlock — IT and other roles cannot");
    }
    if (data.action !== "approve" && !data.note) throw new Error("Add a review note");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("agent_accountability_reviews")
      .select("id, agent_id, business_date, unlock_for_date, status, review_history")
      .eq("id", data.id)
      .maybeSingle();
    if (error || !row) throw new Error("Review not found");

    const at = new Date().toISOString();
    const by = "Executive HQ";
    const history = Array.isArray(row.review_history) ? row.review_history : [];
    const status = data.action === "approve" ? "approved" : data.action === "hold" ? "hold" : row.status;
    const patch: Record<string, unknown> = {
      status,
      review_history: [...history, { action: data.action, at, by, note: data.note ?? null }],
    };
    if (data.action !== "note") {
      patch["reviewed_by"] = by;
      patch["reviewed_at"] = at;
      patch["approval_note"] = data.note ?? null;
    }
    const { error: upErr } = await supabaseAdmin
      .from("agent_accountability_reviews")
      .update(patch as never)
      .eq("id", row.id);
    if (upErr) throw new Error(upErr.message);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "accountability_reviewed",
      entityType: "agent_accountability_review",
      entityId: row.id,
      actorLabel: by,
      metadata: {
        agent_id: row.agent_id,
        business_date: row.business_date,
        unlock_for_date: row.unlock_for_date,
        decision: data.action,
        note: data.note ?? null,
      },
    });
    return { ok: true, status };
  });
