import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * The agent's own desk actions. Everything here is scoped by the signed-in
 * account: an agent may only submit a lead for themselves and only log a
 * WhatsApp message against a lead that is already assigned to them.
 */

const NewLeadInput = z.object({
  adminToken: z.string().nullable().optional(),
  name: z.string().trim().min(1).max(120),
  phoneNumber: z
    .string()
    .trim()
    .regex(/^(?:\+?880|0)1[3-9]\d{8}$/, "Use a Bangladeshi mobile number"),
  company: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  serialNo: z.string().trim().max(40).nullable().optional(),
  referenceBy: z.string().trim().max(120).nullable().optional(),
});

/** Agents (and supervisors) add a lead; agents keep it in their own queue. */
export const submitMyLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => NewLeadInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none") throw new Error("অনুমোদিত অ্যাকাউন্ট দিয়ে সাইন ইন করুন");

    // Same intake path as the phone app — identical number cleanup, duplicate
    // check, ownership and timeline entry, so web and mobile leads look alike.
    const { intakeLead } = await import("@/lib/lead-intake.server");
    const result = await intakeLead({
      name: data.name,
      phoneNumber: data.phoneNumber,
      company: data.company ?? null,
      notes: data.notes ?? null,
      address: data.address ?? null,
      serialNo: data.serialNo ?? null,
      referenceBy: data.referenceBy ?? null,
      ownerId: caller.profile?.id ?? null,
      ownerName: caller.profile?.name ?? null,
    });

    return { leadId: result.leadId, duplicate: result.duplicate };
  });

const OpenLeadsInput = z.object({
  adminToken: z.string().nullable().optional(),
  limit: z.number().int().min(1).max(100).default(50),
});

/** Leads nobody has taken yet — an agent may pull these into their own queue. */
export const listOpenLeads = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => OpenLeadsInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none") throw new Error("অনুমোদিত অ্যাকাউন্ট দিয়ে সাইন ইন করুন");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: leads, error } = await supabaseAdmin
      .from("leads")
      .select("id, name, phone_number, company, status, source, created_at")
      .is("assigned_to", null)
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return leads ?? [];
  });

const ClaimInput = z.object({
  adminToken: z.string().nullable().optional(),
  leadId: z.string().uuid(),
});

/** The agent takes an untaken lead into their own account. No app needed. */
export const claimLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ClaimInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none" || !caller.profile) {
      throw new Error("অনুমোদিত অ্যাকাউন্ট দিয়ে সাইন ইন করুন");
    }
    const me = caller.profile.id;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: updated, error } = await supabaseAdmin
      .from("leads")
      .update({ assigned_to: me, assigned_agent_id: me, assignment_source: "self" })
      .eq("id", data.leadId)
      .is("assigned_to", null)
      .select("id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!updated) throw new Error("এই লিড আগেই অন্য কেউ নিয়ে নিয়েছে");

    const { logLeadEvent } = await import("@/lib/lead-events.server");
    await logLeadEvent({
      leadId: updated.id,
      agentId: me,
      kind: "self_claimed",
      detail: `${caller.profile.name} নিজে লিড নিয়েছেন`,
    });
    await supabaseAdmin
      .from("lead_assignments")
      .insert({ lead_id: updated.id, to_agent_id: me, changed_by: me, source: "self" });

    return { leadId: updated.id };
  });

const MyMessageInput = z.object({
  adminToken: z.string().nullable().optional(),
  leadId: z.string().uuid(),
  senderType: z.enum(["agent", "customer"]).default("agent"),
  messageContent: z.string().trim().min(1).max(4000),
});

/** Log one WhatsApp message in the agent's own lead thread. */
export const logMyWhatsappMessage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => MyMessageInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none") throw new Error("অনুমোদিত অ্যাকাউন্ট দিয়ে সাইন ইন করুন");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (caller.scope === "agent" && caller.profile) {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("id, assigned_to")
        .eq("id", data.leadId)
        .maybeSingle();
      if (!lead || lead.assigned_to !== caller.profile.id) {
        throw new Error("এই লিড আপনার তালিকায় নেই");
      }
    }

    const { error } = await supabaseAdmin.from("whatsapp_interactions").insert({
      lead_id: data.leadId,
      agent_id: caller.profile?.id ?? null,
      sender_type: data.senderType,
      message_type: "text",
      message_content: data.messageContent,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const TriageInput = z.object({
  adminToken: z.string().nullable().optional(),
  leadId: z.string().uuid(),
  action: z.enum(["follow_up", "closed"]),
  note: z.string().trim().max(500).nullable().optional(),
});

/**
 * One-swipe triage from the mobile lead queue: park a lead for follow-up
 * (tomorrow 10:00 Dhaka) or close it. Uses the same ownership rule as every
 * other desk action — an agent may only triage a lead assigned to them.
 */
export const triageMyLead = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => TriageInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none") throw new Error("অনুমোদিত অ্যাকাউন্ট দিয়ে সাইন ইন করুন");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { LEAD_OWNER_COLUMNS, leadHeldByOther, LEAD_NOT_YOURS } = await import(
      "@/lib/lead-access.server"
    );

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select(`id, name, phone_number, temperature, ${LEAD_OWNER_COLUMNS}`)
      .eq("id", data.leadId)
      .maybeSingle();
    if (!lead) throw new Error(LEAD_NOT_YOURS);
    if (caller.scope === "agent" && caller.profile && leadHeldByOther(lead, caller.profile.id)) {
      throw new Error(LEAD_NOT_YOURS);
    }

    const { error } = await supabaseAdmin
      .from("leads")
      .update({ status: data.action, updated_at: new Date().toISOString() })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);

    let scheduledAt: string | null = null;
    if (data.action === "follow_up") {
      const { followUpPriorityFor } = await import("@/lib/follow-up-priority");
      // Tomorrow 10:00 Dhaka (UTC+6) => 04:00 UTC.
      const next = new Date();
      next.setUTCDate(next.getUTCDate() + 1);
      next.setUTCHours(4, 0, 0, 0);
      scheduledAt = next.toISOString();
      await supabaseAdmin.from("follow_up_events").insert({
        lead_id: data.leadId,
        agent_id: caller.profile?.id ?? null,
        category: "follow_up",
        customer_name: lead.name,
        phone_number: lead.phone_number,
        priority: followUpPriorityFor(lead.temperature),
        note: data.note ?? "মোবাইল কিউ থেকে ফলো-আপে রাখা হয়েছে",
        scheduled_at: scheduledAt,
      });
    }

    const { logLeadEvent } = await import("@/lib/lead-events.server");
    await logLeadEvent({
      leadId: data.leadId,
      agentId: caller.profile?.id ?? null,
      kind: "outcome_logged",
      detail:
        data.action === "follow_up"
          ? "মোবাইল কিউ: ফলো-আপে রাখা হয়েছে"
          : "মোবাইল কিউ: লিড বন্ধ করা হয়েছে",
    });

    return { leadId: data.leadId, action: data.action, scheduledAt };
  });

const FollowUpResolveInput = z.object({
  adminToken: z.string().nullable().optional(),
  leadId: z.string().uuid(),
  action: z.enum(["reschedule", "complete"]),
  hours: z.number().int().min(1).max(720).optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

/**
 * Desk follow-up resolution after the agent has contacted the lead:
 *  - "reschedule" keeps the lead in the follow-up queue with a new time
 *  - "complete" closes the follow-up, so the lead leaves the queue by itself
 * Same ownership rule as every other desk action.
 */
export const resolveMyFollowUp = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => FollowUpResolveInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none") throw new Error("অনুমোদিত অ্যাকাউন্ট দিয়ে সাইন ইন করুন");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { LEAD_OWNER_COLUMNS, leadHeldByOther, LEAD_NOT_YOURS } = await import(
      "@/lib/lead-access.server"
    );

    const { data: lead } = await supabaseAdmin
      .from("leads")
      .select(`id, name, phone_number, status, temperature, ${LEAD_OWNER_COLUMNS}`)
      .eq("id", data.leadId)
      .maybeSingle();
    if (!lead) throw new Error(LEAD_NOT_YOURS);
    if (caller.scope === "agent" && caller.profile && leadHeldByOther(lead, caller.profile.id)) {
      throw new Error(LEAD_NOT_YOURS);
    }

    const nowIso = new Date().toISOString();

    if (data.action === "reschedule") {
      const { followUpPriorityFor } = await import("@/lib/follow-up-priority");
      const scheduledAt = new Date(Date.now() + (data.hours ?? 24) * 3_600_000).toISOString();
      const { error } = await supabaseAdmin
        .from("leads")
        .update({ status: "follow_up", retry_after: scheduledAt, updated_at: nowIso })
        .eq("id", data.leadId);
      if (error) throw new Error(error.message);

      await supabaseAdmin.from("follow_up_events").insert({
        lead_id: data.leadId,
        agent_id: caller.profile?.id ?? null,
        category: "follow_up",
        customer_name: lead.name,
        phone_number: lead.phone_number,
        priority: followUpPriorityFor(lead.temperature),
        note: data.note ?? "ডেস্ক থেকে আবার ফলো-আপ সময় দেওয়া হয়েছে",
        scheduled_at: scheduledAt,
      });

      const { logLeadEvent } = await import("@/lib/lead-events.server");
      await logLeadEvent({
        leadId: data.leadId,
        agentId: caller.profile?.id ?? null,
        kind: "outcome_logged",
        detail: "ডেস্ক: আবার ফলো-আপ সময় দেওয়া হয়েছে",
      });

      return { leadId: data.leadId, action: data.action, scheduledAt };
    }

    // complete: the follow-up work is finished, so the lead leaves the queue.
    const { error } = await supabaseAdmin
      .from("leads")
      .update({
        status: "closed",
        work_state: "completed",
        retry_after: null,
        updated_at: nowIso,
      })
      .eq("id", data.leadId);
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("follow_up_events")
      .update({ status: "done", completed_at: nowIso })
      .eq("lead_id", data.leadId)
      .neq("status", "done");

    const { logLeadEvent } = await import("@/lib/lead-events.server");
    await logLeadEvent({
      leadId: data.leadId,
      agentId: caller.profile?.id ?? null,
      kind: "outcome_logged",
      detail: "ডেস্ক: ফলো-আপ সম্পন্ন করা হয়েছে",
    });

    return { leadId: data.leadId, action: data.action, scheduledAt: null };
  });
