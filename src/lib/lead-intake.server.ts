/**
 * One single place where a lead enters the CRM — whether the agent typed it on
 * the web desk or on the phone app. Both paths normalise the number the same
 * way, de-duplicate the same way, and land in the same agent's queue with the
 * same timeline entry, so nothing about the lead reveals where it came from.
 */

import { primaryBangladeshPhone } from "@/lib/lead-phone";

export type LeadIntakeResult = {
  leadId: string;
  duplicate: boolean;
  duplicateReason?: "already_worked_or_assigned" | "duplicate";
  assignedTo: string | null;
};

/** Thrown when the number is not a Bangladeshi mobile; callers map it to 4xx. */
export class InvalidLeadPhoneError extends Error {
  readonly code = "invalid_phone";
  constructor() {
    super("সঠিক বাংলাদেশি মোবাইল নম্বর দিন");
    this.name = "InvalidLeadPhoneError";
  }
}

/** Bangladesh-first: 01XXXXXXXXX / +8801XXXXXXXXX / 8801XXXXXXXXX -> 8801XXXXXXXXX. */
export function normalizeLeadPhone(raw: string): string {
  return primaryBangladeshPhone(raw) ?? (raw.replace(/[^\d+]/g, "") || raw.trim());
}

export async function intakeLead(input: {
  name: string;
  phoneNumber: string;
  company?: string | null;
  notes?: string | null;
  address?: string | null;
  serialNo?: string | null;
  /** Who handed this lead over — the agent themselves, or head office. */
  referenceBy?: string | null;
  /** Profile id that should own the lead, or null for unassigned. */
  ownerId: string | null;
  /** Free-form label used only for round-robin webhook traffic. */
  source?: string;
  /** Display name used in the timeline entry. */
  ownerName?: string | null;
  /** Who typed it in, when that is not the owner (e.g. head-database intake). */
  actorProfileId?: string | null;
  actorLabel?: string | null;
}): Promise<LeadIntakeResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const extractedPhones = (await import("@/lib/lead-phone")).extractBangladeshPhones(
    input.phoneNumber,
  );
  const phone = extractedPhones.length > 1 ? input.phoneNumber.trim() : normalizeLeadPhone(input.phoneNumber);
  const { resolveLeadIdByPhone: getLeadPhoneStatus } = await import(
    "@/lib/lead-eligibility.server"
  );
  const phoneStatus = await getLeadPhoneStatus(input.phoneNumber);
  if (phoneStatus.canonicalPhones.length === 0) throw new InvalidLeadPhoneError();
  if (phoneStatus.existingLeadId) {
    const { data: existing } = await supabaseAdmin
      .from("leads")
      .select("assigned_to")
      .eq("id", phoneStatus.existingLeadId)
      .maybeSingle();
    return {
      leadId: phoneStatus.existingLeadId,
      duplicate: true,
      duplicateReason: phoneStatus.alreadyWorked ? "already_worked_or_assigned" : "duplicate",
      assignedTo: existing?.assigned_to ?? null,
    };
  }

  const owner = input.ownerId ?? null;
  const { data: created, error } = await supabaseAdmin
    .from("leads")
    .insert({
      name: input.name,
      phone_number: phone,
      company: input.company?.trim() || null,
      notes: input.notes?.trim() || null,
      address: input.address?.trim() || null,
      serial_no: input.serialNo?.trim() || (await nextSerialNo()),
      // A newly assigned or self-added lead belongs to the day it arrived, and
      // sits last in the serial order — exactly how the floor hands work out.
      work_date: dhakaToday(),
      reference_by: input.referenceBy?.trim() || (owner ? input.ownerName?.trim() || null : null),
      source: owner ? "agent_app" : (input.source ?? "webhook"),
      status: "pending",
      assigned_to: owner,
      assigned_agent_id: owner,
      assignment_source: owner ? "self" : null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      const raced = await getLeadPhoneStatus(input.phoneNumber);
      if (raced.existingLeadId) {
        return {
          leadId: raced.existingLeadId,
          duplicate: true,
          duplicateReason: raced.alreadyWorked ? "already_worked_or_assigned" : "duplicate",
          assignedTo: null,
        };
      }
    }
    throw new Error(error.message);
  }

  if (owner) {
    const { logLeadEvent } = await import("@/lib/lead-events.server");
    await logLeadEvent({
      leadId: created.id,
      agentId: owner,
      kind: "self_claimed",
      detail: `${input.ownerName?.trim() || "এজেন্ট"} নতুন লিড যোগ করেছেন — ${input.name}`,
    });
  }

  const { logAudit } = await import("@/lib/audit.server");
  await logAudit({
    action: "lead_created",
    entityType: "lead",
    entityId: created.id,
    actorProfileId: owner,
    actorLabel: input.ownerName?.trim() || null,
    metadata: { phone, source: owner ? "agent_app" : (input.source ?? "webhook") },
  });

  return { leadId: created.id, duplicate: false, assignedTo: owner };
}

/** Today in Dhaka, as the working day a new lead belongs to. */
function dhakaToday(): string {
  return new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * The next serial in line. A lead added or assigned today lands at the end of
 * the list, so the floor order is never reshuffled by a late arrival.
 */
async function nextSerialNo(): Promise<string> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("leads")
    .select("serial_no")
    .not("serial_no", "is", null)
    .limit(5000);
  let max = 0;
  for (const row of data ?? []) {
    const digits = Number(String(row.serial_no ?? "").replace(/\D/g, ""));
    if (Number.isFinite(digits) && digits > max) max = digits;
  }
  return String(max + 1);
}
