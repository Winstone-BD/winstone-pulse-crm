/**
 * Durable CRM → OS booking outbox.
 *
 * This records an authenticated CRM mutation for later delivery without
 * guessing an OS URL or wire contract. A configured OS dispatcher can claim
 * `crm_to_os_booking.*` rows from the existing sync_events ledger. Until then
 * they remain visibly queued and no financial/ERP mutation is implied.
 */
export async function queueBookingForOs(input: {
  bookingId: string;
  leadId: string;
  eventType: "booking.created" | "booking.updated" | "booking.cancelled";
  actorAgentId: string | null;
}): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const idempotencyKey = `crm-booking:${input.bookingId}:${input.eventType}`;
  const { error } = await supabaseAdmin.from("sync_events").upsert(
    {
      agent_id: input.actorAgentId,
      idempotency_key: idempotencyKey,
      event_type: `crm_to_os_${input.eventType}`,
      entity_type: "booking",
      entity_id: input.bookingId,
      payload: { booking_id: input.bookingId, lead_id: input.leadId } as never,
      status: "queued",
      processed_at: null,
      error_message: null,
    },
    { onConflict: "idempotency_key", ignoreDuplicates: true },
  );
  if (error) throw new Error("OS sync queue could not be written");
}