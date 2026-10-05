import { logAudit } from "@/lib/audit.server";
import { hmacHex } from "@/lib/os-bridge";
import {
  OS_OUTBOUND_PREFIX,
  buildEnvelope,
  classifyResponse,
  isDue,
  nextStatus,
  validEndpoint,
} from "@/lib/os-outbound";

const BATCH = 25;
const TIMEOUT_MS = 10_000;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Only secret NAMES are ever reported. */
export function outboundConfig() {
  const endpoint = validEndpoint(process.env["OS_BOOKING_ENDPOINT"]);
  const secret = process.env["CRM_BRIDGE_SECRET"];
  const missing: string[] = [];
  if (!endpoint) missing.push("OS_BOOKING_ENDPOINT");
  if (!secret) missing.push("CRM_BRIDGE_SECRET");
  return { endpoint, secret, missing };
}

type Row = {
  id: string;
  idempotency_key: string | null;
  event_type: string;
  entity_id: string | null;
  created_at: string;
  payload: unknown;
  status: string;
  retry_count: number;
  processed_at: string | null;
};

async function sendOne(row: Row, endpoint: string, secret: string) {
  const db = await admin();
  // Atomic claim: only one worker may move this row to "sending".
  const { data: claimed } = await db
    .from("sync_events")
    .update({ status: "sending" })
    .eq("id", row.id)
    .eq("status", row.status)
    .select("id");
  if (!claimed?.length) return "skipped" as const;

  const body = JSON.stringify(buildEnvelope(row));
  const ts = String(Math.floor(Date.now() / 1000));
  const signature = await hmacHex(secret, `${ts}.${body}`);
  let status: number | null = null;
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-idempotency-key": row.idempotency_key ?? row.id,
        "x-winstone-timestamp": ts,
        "x-winstone-signature": `sha256=${signature}`,
        "x-winstone-api-version": "1",
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    status = res.status;
  } catch {
    status = null;
  }
  const attempts = row.retry_count + 1;
  const next = nextStatus(classifyResponse(status), attempts);
  await db
    .from("sync_events")
    .update({
      status: next,
      retry_count: attempts,
      processed_at: new Date().toISOString(),
      error_message: next === "sent" ? null : status === null ? "network_error_or_timeout" : `http_${status}`,
    })
    .eq("id", row.id);
  if (next !== "failed") {
    await logAudit({
      action: next === "sent" ? "os_booking_sync_sent" : "os_booking_sync_dead",
      entityType: "booking",
      entityId: row.entity_id,
      actorLabel: "CRM → OS dispatcher",
      metadata: { sync_event_id: row.id, attempts, http_status: status },
    });
  }
  return next;
}

/** Sends due queued/failed booking events. Safe to run repeatedly and concurrently. */
export async function dispatchOsQueue(now = Date.now()) {
  const cfg = outboundConfig();
  if (cfg.missing.length) return { configured: false as const, missing: cfg.missing, sent: 0, failed: 0, dead: 0 };
  const db = await admin();
  const { data, error } = await db
    .from("sync_events")
    .select("id, idempotency_key, event_type, entity_id, created_at, payload, status, retry_count, processed_at")
    .like("event_type", `${OS_OUTBOUND_PREFIX}%`)
    .in("status", ["queued", "failed"])
    .order("created_at", { ascending: true })
    .limit(BATCH * 4);
  if (error) throw new Error("Sync queue unavailable");
  const due = ((data ?? []) as Row[]).filter((r) => isDue(r, now)).slice(0, BATCH);
  const tally = { sent: 0, failed: 0, dead: 0 };
  for (const row of due) {
    const r = await sendOne(row, cfg.endpoint!, cfg.secret!);
    if (r !== "skipped") tally[r] += 1;
  }
  return { configured: true as const, missing: [], ...tally };
}

export async function osSyncStatus() {
  const db = await admin();
  const { data } = await db
    .from("sync_events")
    .select("id, event_type, entity_id, status, retry_count, error_message, created_at, processed_at")
    .like("event_type", `${OS_OUTBOUND_PREFIX}%`)
    .order("created_at", { ascending: false })
    .limit(50);
  const rows = data ?? [];
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
  const { serviceBillEmailConfiguration } = await import("@/lib/service-bill-review.server");
  const has = (n: string) => Boolean(process.env[n]?.trim());
  const emailIssues = serviceBillEmailConfiguration();
  const health = [
    { name: "OS booking endpoint", ok: !outboundConfig().missing.includes("OS_BOOKING_ENDPOINT"), setting: "OS_BOOKING_ENDPOINT" },
    { name: "CRM bridge secret", ok: has("CRM_BRIDGE_SECRET"), setting: "CRM_BRIDGE_SECRET" },
    { name: "Bill email relay", ok: emailIssues.length === 0, setting: emailIssues.join(", ") || "OK" },
    { name: "Bill review PIN", ok: has("SERVICE_BILL_UNLOCK_PIN"), setting: "SERVICE_BILL_UNLOCK_PIN" },
    { name: "Automatic timer", ok: true, setting: "off (manual Send Now only)" },
  ];
  return { missing: outboundConfig().missing, counts, rows, health };
}

/** Manual retry of a dead/failed event: resets attempts, never duplicates the event (same idempotency key). */
export async function requeueOsEvent(id: string, actor: string) {
  const db = await admin();
  const { data } = await db
    .from("sync_events")
    .update({ status: "queued", retry_count: 0, error_message: null })
    .eq("id", id)
    .like("event_type", `${OS_OUTBOUND_PREFIX}%`)
    .in("status", ["failed", "dead"])
    .select("id, entity_id");
  if (!data?.length) throw new Error("Only failed or stopped events can be retried");
  await logAudit({
    action: "os_booking_sync_requeued",
    entityType: "booking",
    entityId: data[0]!.entity_id,
    actorLabel: actor,
    metadata: { sync_event_id: id },
  });
}
