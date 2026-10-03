/**
 * Winstone OS bridge persistence + mapping (server only).
 * Records verified events against existing CRM entities only. Never creates
 * leads, bookings, customers or amounts; absent targets are a safe no-op.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/lib/audit.server";
import type { OsEvent } from "@/lib/os-bridge";

export type ClaimResult =
  | { kind: "fresh" }
  | { kind: "duplicate"; status: string; outcome: string | null }
  | { kind: "conflict" };

export async function claimOsEvent(input: {
  key: string;
  event: OsEvent;
  apiVersion: string | null;
  payloadHash: string;
}): Promise<ClaimResult> {
  const { error } = await supabaseAdmin.from("os_event_receipts" as never).insert({
    idempotency_key: input.key,
    event_id: input.event.event_id,
    event_type: input.event.event_type,
    api_version: input.apiVersion,
    payload_sha256: input.payloadHash,
  } as never);
  if (!error) return { kind: "fresh" };
  if (error.code !== "23505") throw error;
  const { data } = await supabaseAdmin
    .from("os_event_receipts" as never)
    .select("payload_sha256, status, outcome, attempts")
    .eq("idempotency_key", input.key)
    .maybeSingle();
  const row = data as { payload_sha256: string; status: string; outcome: string | null; attempts: number } | null;
  if (!row) throw error;
  await supabaseAdmin
    .from("os_event_receipts" as never)
    .update({ attempts: row.attempts + 1 } as never)
    .eq("idempotency_key", input.key);
  if (row.payload_sha256 !== input.payloadHash) return { kind: "conflict" };
  return { kind: "duplicate", status: row.status, outcome: row.outcome };
}

export async function applyOsEvent(key: string, event: OsEvent): Promise<string> {
  const d = event.data;
  let leadId: string | null = null;
  let bookingId: string | null = null;
  let outcome = "no_target";

  if (d.crm_booking_id) {
    const { data: b } = await supabaseAdmin
      .from("bookings")
      .select("id, lead_id, status")
      .eq("id", d.crm_booking_id)
      .maybeSingle();
    if (b) {
      bookingId = b.id;
      leadId = b.lead_id;
      if (event.event_type === "booking.cancelled" && b.status !== "cancelled") {
        const { error } = await supabaseAdmin
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("id", b.id);
        if (error) throw error;
        outcome = "booking_cancelled";
      } else {
        outcome = "recorded_on_booking";
      }
    }
  }
  if (!leadId && d.lead_id) {
    const { data: l } = await supabaseAdmin.from("leads").select("id").eq("id", d.lead_id).maybeSingle();
    if (l) {
      leadId = l.id;
      outcome = outcome === "no_target" ? "recorded_on_lead" : outcome;
    }
  }

  if (leadId) {
    const { error } = await supabaseAdmin.from("lead_events").insert({
      lead_id: leadId,
      kind: `os_${event.event_type.replace(".", "_")}`,
      detail: JSON.stringify({ source: "winstone_os", event_id: event.event_id, idempotency_key: key, occurred_at: event.occurred_at, ...d }),
    });
    if (error) throw error;
  }

  await supabaseAdmin
    .from("os_event_receipts" as never)
    .update({ status: "processed", outcome, lead_id: leadId, booking_id: bookingId, processed_at: new Date().toISOString() } as never)
    .eq("idempotency_key", key);

  await logAudit({
    action: "os_event_received",
    entityType: bookingId ? "booking" : leadId ? "lead" : "os_event",
    entityId: bookingId ?? leadId ?? null,
    actorLabel: "Winstone OS",
    metadata: { event_type: event.event_type, event_id: event.event_id, outcome },
  });
  return outcome;
}

export async function markOsEventFailed(key: string, error: unknown) {
  await supabaseAdmin
    .from("os_event_receipts" as never)
    .update({ status: "failed", outcome: String(error).slice(0, 300) } as never)
    .eq("idempotency_key", key);
}

export async function releaseFailedClaim(key: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("os_event_receipts" as never)
    .update({ status: "received" } as never)
    .eq("idempotency_key", key)
    .eq("status", "failed")
    .select("idempotency_key");
  return Array.isArray(data) && data.length > 0;
}
