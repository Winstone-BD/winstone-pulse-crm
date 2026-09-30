/**
 * Reminders: the two things an agent must never forget.
 *
 *  1. An unfinished post-call report (`call_reports.status = 'pending'`).
 *  2. A follow-up whose time has arrived (`follow_up_events.status = 'upcoming'`,
 *     reminder window open).
 *
 * Both are read from the same tables the desk already uses, so nothing new has
 * to be kept in sync. The list powers the in-app reminder bell on the web CRM
 * and the Android reminder worker; `sweepReminders` additionally sends one push
 * per item and stamps `notified_at`, so a phone that is closed still buzzes.
 *
 * Idempotency: follow-up pushes are claimed by `notified_at`, report pushes by a
 * `push_deliveries` event key bucketed per hour, so a repeated sweep is silent.
 */

export type Reminder = {
  id: string;
  kind: "report" | "follow_up";
  leadId: string | null;
  title: string;
  detail: string;
  phone: string | null;
  dueAt: string;
  overdue: boolean;
  priority: string | null;
};

const REPORT_GRACE_MINUTES = 5;
/** A follow-up older than this is backlog: listed in the app, not pushed. */
const FOLLOW_UP_PUSH_WINDOW_HOURS = 12;
/** Never buzz a phone more than this many times in one sweep. */
const MAX_PUSH_PER_SWEEP = 6;

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

function bnTime(iso: string): string {
  return new Date(iso).toLocaleString("bn-BD", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Everything one agent should be reminded about right now, soonest first. */
export async function remindersFor(profileId: string, now = new Date()): Promise<Reminder[]> {
  const supabaseAdmin = await admin();
  const nowMs = now.getTime();
  const out: Reminder[] = [];

  const { data: reports } = await supabaseAdmin
    .from("call_reports")
    .select("id, lead_id, phone_number, created_at, leads(name)")
    .eq("agent_id", profileId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  for (const row of reports ?? []) {
    const openedMs = new Date(row.created_at).getTime();
    if (nowMs - openedMs < REPORT_GRACE_MINUTES * 60_000) continue;
    const lead = (row as { leads?: { name?: string } | null }).leads;
    out.push({
      id: row.id,
      kind: "report",
      leadId: row.lead_id,
      title: "কলের রিপোর্ট জমা হয়নি",
      detail: `${lead?.name ?? row.phone_number ?? "কল"} — ${bnTime(row.created_at)}-এর কলের রিপোর্ট বাকি`,
      phone: row.phone_number,
      dueAt: row.created_at,
      overdue: true,
      priority: "high",
    });
  }

  const { data: followUps } = await supabaseAdmin
    .from("follow_up_events")
    .select("id, lead_id, customer_name, phone_number, note, category, priority, scheduled_at, reminder_minutes")
    .eq("agent_id", profileId)
    .eq("status", "upcoming")
    .order("scheduled_at", { ascending: true });

  for (const row of followUps ?? []) {
    const dueMs = new Date(row.scheduled_at).getTime();
    const windowMs = dueMs - (row.reminder_minutes ?? 30) * 60_000;
    if (nowMs < windowMs) continue;
    out.push({
      id: row.id,
      kind: "follow_up",
      leadId: row.lead_id,
      title: nowMs > dueMs ? "ফলো-আপের সময় পার হয়েছে" : "ফলো-আপ কলের সময় হয়েছে",
      detail: `${row.customer_name ?? row.phone_number ?? "গ্রাহক"} — ${bnTime(row.scheduled_at)}${
        row.note ? ` · ${row.note}` : ""
      }`,
      phone: row.phone_number,
      dueAt: row.scheduled_at,
      overdue: nowMs > dueMs,
      priority: row.priority,
    });
  }

  const { compareFollowUpPriority } = await import("@/lib/follow-up-priority");
  return out.sort((a, b) => {
    // Unfinished reports remain mandatory and stay pinned before follow-ups.
    if (a.kind !== b.kind) return a.kind === "report" ? -1 : 1;
    if (a.kind === "follow_up" && b.kind === "follow_up") {
      return compareFollowUpPriority(
        { id: a.id, scheduled_at: a.dueAt, priority: a.priority },
        { id: b.id, scheduled_at: b.dueAt, priority: b.priority },
        nowMs,
      );
    }
    return a.dueAt.localeCompare(b.dueAt);
  });
}

/**
 * Sends the due reminders to every active agent's devices. Safe to run on a
 * schedule: an item already notified is skipped.
 */
export async function sweepReminders(now = new Date()) {
  const supabaseAdmin = await admin();
  const { sendPush } = await import("@/lib/push.server");

  const { data: agents } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("is_active", true)
    .eq("approval_status", "approved");

  const hourBucket = now.toISOString().slice(0, 13);
  let followUpPushes = 0;
  let reportPushes = 0;

  for (const agent of agents ?? []) {
    const all = await remindersFor(agent.id, now);
    // Only fresh items buzz the phone: a follow-up older than the window is
    // backlog, and it is still listed in the app. Cap the burst per sweep.
    const fresh = all.filter(
      (item) =>
        item.kind === "report" ||
        now.getTime() - new Date(item.dueAt).getTime() <= FOLLOW_UP_PUSH_WINDOW_HOURS * 3_600_000,
    );
    for (const item of fresh.slice(0, MAX_PUSH_PER_SWEEP)) {
      const eventKey =
        item.kind === "follow_up"
          ? `follow_up_due:${item.id}`
          : `report_pending:${item.id}:${hourBucket}`;
      const result = await sendPush({
        eventKey,
        kind: item.kind === "follow_up" ? "follow_up_reminder" : "report_reminder",
        entityId: item.id,
        profileIds: [agent.id],
        payload: {
          title: item.title,
          body: item.detail,
          path: item.kind === "follow_up" ? "/desk" : "/desk",
          data: { reminder_kind: item.kind, reminder_id: item.id, lead_id: item.leadId ?? "" },
        },
      });
      if (result.skipped === "already_sent") continue;
      // Push is not live yet: release the claim so the reminder is delivered
      // once Firebase is connected. The in-app bell already shows it.
      if (result.skipped === "firebase_not_connected") {
        await supabaseAdmin.from("push_deliveries").delete().eq("event_key", eventKey);
        continue;
      }
      if (item.kind === "follow_up") {
        followUpPushes += 1;
        await supabaseAdmin
          .from("follow_up_events")
          .update({ notified_at: now.toISOString() })
          .eq("id", item.id)
          .is("notified_at", null);
      } else {
        reportPushes += 1;
      }
    }
  }

  return { agents: agents?.length ?? 0, followUpPushes, reportPushes };
}
