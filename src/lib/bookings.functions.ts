import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Booking records linked to canonical leads. Server-only table: every
 * read/write goes through the server-resolved caller. HQ/IT sees and edits
 * all; agents only bookings on leads assigned to them. Never deleted —
 * cancel via status. Amounts are USD only, never BDT.
 */
export const BOOKING_STATUSES = ["booked", "completed", "cancelled"] as const;
const Token = z.string().nullable().optional();

export const listBookings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken).catch(() => null);
    if (!c) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: Array<{
      id: string;
      lead_id: string;
      agent_id: string | null;
      project: string | null;
      area: string | null;
      amount_usd: number | null;
      booked_at: string;
      status: string;
      notes: string | null;
      created_by: string;
    }> = [];
    for (let a = 0; ; a += 1000) {
      let q = supabaseAdmin
        .from("bookings")
        .select(
          "id, lead_id, agent_id, project, area, amount_usd, booked_at, status, notes, created_by",
        );
      if (c.scope === "agent") q = q.eq("agent_id", c.agentId!);
      const { data: rows, error } = await q
        .order("booked_at", { ascending: false })
        .order("id")
        .range(a, a + 999);
      if (error) throw new Error("বুকিং পড়া যায়নি");
      out.push(...(rows ?? []));
      if (!rows || rows.length < 1000) return out;
    }
  });

export const createBooking = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        adminToken: Token,
        leadId: z.string().uuid(),
        bookedAt: z.string().datetime({ offset: true }).optional(),
        project: z.string().trim().max(120).optional().nullable(),
        area: z.string().trim().max(120).optional().nullable(),
        amountUsd: z.number().min(0).max(100_000_000).optional().nullable(),
        notes: z.string().trim().max(500).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { siCaller, leadForCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const lead = await leadForCaller(supabaseAdmin, c, data.leadId); // ownership check for agents
    const agentId =
      c.scope === "agent"
        ? c.agentId
        : ((lead as { assigned_agent_id?: string | null }).assigned_agent_id ?? null);
    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .insert({
        lead_id: data.leadId,
        agent_id: agentId,
        booked_at: data.bookedAt ?? new Date().toISOString(),
        project: data.project || null,
        area: data.area || null,
        amount_usd: data.amountUsd ?? null,
        notes: data.notes || null,
        created_by: c.actor,
      })
      .select("id, status")
      .single();
    if (error) throw new Error("বুকিং সংরক্ষণ হয়নি");
    // Record the area on the canonical lead too, so area-level demand
    // trends become possible over time. Only fills an empty area — never
    // overwrites an existing one.
    if (data.area) {
      await supabaseAdmin
        .from("leads")
        .update({ area: data.area })
        .eq("id", data.leadId)
        .is("area", null);
    }
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "booking_created",
      entityType: "booking",
      entityId: booking.id,
      actorProfileId: c.agentId,
      actorLabel: c.actor,
      metadata: { lead_id: data.leadId, status: booking.status },
    });
    return { ok: true };
  });

export const setBookingStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({ adminToken: Token, id: z.string().uuid(), status: z.enum(BOOKING_STATUSES) })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("bookings")
      .update({ status: data.status, updated_by: c.actor })
      .eq("id", data.id);
    if (c.scope === "agent") q = q.eq("agent_id", c.agentId!);
    const { data: rows, error } = await q.select("id, lead_id");
    if (error || !rows?.length) throw new Error("অবস্থা বদলানো যায়নি");
    const booking = rows[0]!;
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "booking_status_changed",
      entityType: "booking",
      entityId: booking.id,
      actorProfileId: c.agentId,
      actorLabel: c.actor,
      metadata: { status: data.status },
    });
    return { ok: true };
  });

/** Set the area on a canonical lead. Agents only for their own leads. */
export const setLeadArea = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        adminToken: Token,
        leadId: z.string().uuid(),
        area: z.string().trim().min(1).max(120),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { siCaller, leadForCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await leadForCaller(supabaseAdmin, c, data.leadId); // ownership check for agents
    const { error } = await supabaseAdmin
      .from("leads")
      .update({ area: data.area })
      .eq("id", data.leadId);
    if (error) throw new Error("এলাকা সংরক্ষণ হয়নি");
    return { ok: true };
  });

/** Read-only: pitch events (lead + day) for the pitch → booking funnel. Scope-filtered. */
export const listPitchLeads = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { siCaller } = await import("@/lib/sales-intel.server");
    const c = await siCaller(data.adminToken).catch(() => null);
    if (!c) return [];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const out: Array<{ lead_id: string; agent_id: string | null; created_at: string }> = [];
    for (let a = 0; ; a += 1000) {
      let q = supabaseAdmin.from("pitch_events").select("lead_id, agent_id, created_at");
      if (c.scope === "agent") q = q.eq("agent_id", c.agentId!);
      const { data: rows, error } = await q
        .order("created_at", { ascending: false })
        .order("id")
        .range(a, a + 999);
      if (error) throw new Error("পিচ তথ্য পড়া যায়নি");
      out.push(...(rows ?? []));
      if (!rows || rows.length < 1000) return out;
    }
  });

/**
 * HQ booking review queue. New bookings wait as "pending" and are relayed to
 * Winstone OS only after HQ/IT approves (the DB trigger queues the signed
 * event on approval). Decisions are final and audited.
 */
export const listBookingReviews = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("bookings")
      .select(
        "id, lead_id, agent_id, project, area, amount_usd, booked_at, status, notes, created_by, approval_status, reviewed_by, reviewed_at, review_note, leads(name), profiles(name, employee_id)",
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (error) throw new Error("বুকিং পড়া যায়নি");
    const ids = (rows ?? []).filter((r) => r.approval_status === "approved").map((r) => r.id);
    const { data: ev } = ids.length
      ? await supabaseAdmin
          .from("sync_events")
          .select("entity_id, status, event_type, processed_at")
          .eq("entity_type", "booking")
          .in("entity_id", ids)
      : { data: [] };
    const relay = new Map<string, string>();
    for (const e of ev ?? []) if (e.event_type === "crm_to_os_booking.created") relay.set(e.entity_id!, e.status);
    return (rows ?? []).map((r) => ({
      id: r.id,
      leadName: (r.leads as { name: string | null } | null)?.name ?? null,
      agentName: (r.profiles as { name: string | null } | null)?.name ?? null,
      agentCode: (r.profiles as { employee_id: string | null } | null)?.employee_id ?? null,
      project: r.project,
      area: r.area,
      amountUsd: r.amount_usd,
      bookedAt: r.booked_at,
      status: r.status,
      notes: r.notes,
      createdBy: r.created_by,
      approval: r.approval_status,
      reviewedBy: r.reviewed_by,
      reviewedAt: r.reviewed_at,
      reviewNote: r.review_note,
      relayStatus: relay.get(r.id) ?? null,
    }));
  });

export const reviewBooking = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        adminToken: Token,
        id: z.string().uuid(),
        decision: z.enum(["approved", "rejected"]),
        note: z.string().trim().max(500).optional().nullable(),
      })
      .refine((v) => v.decision === "approved" || (v.note ?? "").length >= 3, {
        message: "বাতিলের কারণ লিখুন",
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireAuthority(caller);
    const actor = caller.readOnly ? "HQ" : "IT Console";
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("bookings")
      .update({
        approval_status: data.decision,
        reviewed_by: actor,
        reviewed_at: new Date().toISOString(),
        review_note: data.note || null,
        updated_by: actor,
      })
      .eq("id", data.id)
      .eq("approval_status", "pending")
      .select("id");
    if (error || !rows?.length) throw new Error("এই বুকিং আগেই রিভিউ হয়েছে বা পাওয়া যায়নি");
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: data.decision === "approved" ? "booking_approved" : "booking_rejected",
      entityType: "booking",
      entityId: data.id,
      actorProfileId: null,
      actorLabel: actor,
      metadata: { note: data.note ?? null },
    });
    return { ok: true };
  });
