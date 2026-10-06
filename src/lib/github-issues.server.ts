/**
 * Booking-failure alerts → GitHub issue in Winstone-BD/winstone-os.
 *
 * Fired once when a CRM → OS booking event is parked as "dead". The issue
 * carries only technical IDs (sync event, booking id, HTTP status, attempts) —
 * never customer names, phones or amounts. One issue per sync event: a second
 * failure of the same event after a manual retry adds no duplicate.
 */
const GATEWAY_URL = "https://connector-gateway.lovable.dev/github";
export const BOOKING_ALERT_REPO = "Winstone-BD/winstone-os";

export async function openBookingFailureIssue(input: {
  syncEventId: string;
  bookingId: string | null;
  eventType: string;
  httpStatus: number | null;
  attempts: number;
}): Promise<void> {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const githubKey = process.env["GITHUB_API_KEY"];
  if (!lovableKey || !githubKey) {
    console.warn("GitHub issue skipped: connector not configured");
    return;
  }
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: already } = await supabaseAdmin
      .from("audit_logs")
      .select("id")
      .eq("action", "github_issue_created")
      .eq("entity_id", input.syncEventId)
      .limit(1);
    if (already?.length) return;

    const res = await fetch(`${GATEWAY_URL}/repos/${BOOKING_ALERT_REPO}/issues`, {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": githubKey,
      },
      body: JSON.stringify({
        title: `CRM booking sync failed: ${input.eventType.replace("crm_to_os_", "")} (${input.syncEventId.slice(0, 8)})`,
        body: [
          "Winstone CRM could not deliver a booking event to Winstone OS and stopped retrying.",
          "",
          `- Sync event: \`${input.syncEventId}\``,
          `- Booking id: \`${input.bookingId ?? "—"}\``,
          `- Event: \`${input.eventType}\``,
          `- Last HTTP status: \`${input.httpStatus ?? "network error / timeout"}\``,
          `- Attempts: ${input.attempts}`,
          "",
          "Fix the cause, then press **Retry** in CRM → IT Console → Winstone OS বুকিং সিঙ্ক (same idempotency key, no duplicate booking).",
          "",
          "_No customer data is included in this issue._",
        ].join("\n"),
        labels: ["crm-booking-sync"],
      }),
    });
    if (!res.ok) {
      console.error(`GitHub issue failed [${res.status}]: ${await res.text()}`);
      return;
    }
    const issue = (await res.json()) as { number?: number; html_url?: string };
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "github_issue_created",
      entityType: "sync_event",
      entityId: input.syncEventId,
      actorLabel: "CRM → OS dispatcher",
      metadata: { repo: BOOKING_ALERT_REPO, number: issue.number ?? null, url: issue.html_url ?? null },
    });
  } catch (error) {
    console.error("GitHub issue error", error instanceof Error ? error.message : error);
  }
}
