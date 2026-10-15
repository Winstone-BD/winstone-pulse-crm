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
  kind: "report" | "follow_up" | "site_visit" | "handover";
  leadId: string | null;
  title: string;
  detail: string;
  /** English copies for the English UI; the Bengali fields stay for pushes and older clients. */
  titleEn: string;
  detailEn: string;
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

function enTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Asia/Dhaka",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
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
export async function remindersFor(profileId: string, now = new Date(), opts: { allVisits?: boolean } = {}): Promise<Reminder[]> {
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
      titleEn: "Call report not submitted",
      detailEn: `${lead?.name ?? row.phone_number ?? "Call"} — report pending for the call at ${enTime(row.created_at)}`,
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
      titleEn: nowMs > dueMs ? "Follow-up overdue" : "Follow-up call is due",
      detailEn: `${row.customer_name ?? row.phone_number ?? "Customer"} — ${enTime(row.scheduled_at)}${
        row.note ? ` · ${row.note}` : ""
      }`,
      phone: row.phone_number,
      dueAt: row.scheduled_at,
      overdue: nowMs > dueMs,
      priority: row.priority,
    });
  }

  // Site visits: due within 24h / late and not updated, or completed with no outcome.
  // Agents get their own; coordinators (HQ/IT) get every agent's.
  let vq = supabaseAdmin.from("site_visits")
    .select("id, lead_id, project, visit_at, status, outcome_at, leads(name, phone_number)")
    .in("status", ["scheduled", "confirmed", "completed"])
    .lte("visit_at", new Date(nowMs + 24 * 3600_000).toISOString())
    .gte("visit_at", new Date(nowMs - 14 * 86400_000).toISOString())
    .order("visit_at", { ascending: true }).limit(50);
  if (!opts.allVisits) vq = vq.eq("agent_id", profileId);
  const { data: visits } = await vq;
  const { visitReminderStage } = await import("@/lib/site-visit-rules");
  for (const v of visits ?? []) {
    const stage = visitReminderStage(v, nowMs);
    if (!stage) continue;
    const lead = (v as { leads?: { name?: string; phone_number?: string } | null }).leads;
    const who = lead?.name ?? "ক্রেতা";
    const proj = v.project ? ` · ${v.project}` : "";
    const late = stage === "late" || stage === "outcome";
    const titles: Record<typeof stage, [string, string]> = {
      "24h": ["২৪ ঘণ্টার মধ্যে সাইট ভিজিট", "Site visit within 24 hours"],
      "2h": ["২ ঘণ্টার মধ্যে সাইট ভিজিট", "Site visit within 2 hours"],
      late: ["সাইট ভিজিটের অবস্থা আপডেট করুন", "Update the site visit status"],
      outcome: ["সাইট ভিজিটের ফলাফল লিখুন", "Log the site visit outcome"],
    };
    out.push({
      id: v.id,
      kind: "site_visit",
      leadId: v.lead_id,
      title: titles[stage][0],
      detail: `${who} — ${bnTime(v.visit_at)}${proj}`,
      titleEn: titles[stage][1],
      detailEn: `${lead?.name ?? "Customer"} — ${enTime(v.visit_at)}${proj}`,
      phone: lead?.phone_number ?? null,
      dueAt: v.visit_at,
      overdue: late,
      priority: stage,
    });
  }

  // Handover due dates (fixed rules in handover-due.ts): only items due within 2 days or overdue.
  {
    const { handoverDue, dueText, DUE_LABEL } = await import("@/lib/handover-due");
    let hv = supabaseAdmin.from("site_visits").select("lead_id, status, outcome, outcome_at, visit_at, leads!inner(name, phone_number, assigned_to)")
      .gte("visit_at", new Date(nowMs - 60 * 86400_000).toISOString()).limit(300);
    if (!opts.allVisits) hv = hv.eq("leads.assigned_to", profileId);
    let hb = supabaseAdmin.from("bookings").select("lead_id, booked_at, approval_status, leads!inner(name, phone_number, assigned_to)")
      .neq("approval_status", "approved").gte("booked_at", new Date(nowMs - 60 * 86400_000).toISOString()).limit(300);
    if (!opts.allVisits) hb = hb.eq("leads.assigned_to", profileId);
    const [{ data: hvs }, { data: hbs }] = await Promise.all([hv, hb]);
    type L = { name?: string; phone_number?: string } | null;
    const per = new Map<string, { lead: L; visits: { status: string; outcome: string | null; outcome_at: string | null; visit_at: string }[]; booking: { booked_at: string | null; approval_status: string | null } | null }>();
    for (const v of hvs ?? []) {
      const e = per.get(v.lead_id) ?? { lead: (v as { leads?: L }).leads ?? null, visits: [], booking: null };
      e.visits.push(v); per.set(v.lead_id, e);
    }
    for (const b of hbs ?? []) {
      if (!b.lead_id) continue;
      const e = per.get(b.lead_id) ?? { lead: (b as { leads?: L }).leads ?? null, visits: [], booking: null };
      if (!e.booking) e.booking = { booked_at: b.booked_at, approval_status: String(b.approval_status) };
      per.set(b.lead_id, e);
    }
    for (const [leadId, e] of per) {
      for (const d of handoverDue(e, now)) {
        if (d.state === "upcoming") continue;
        out.push({
          id: `${d.kind}:${leadId}:${d.dueDate}:${d.state}`,
          kind: "handover",
          leadId,
          title: `${DUE_LABEL[d.kind].bn} — ${d.state === "overdue" ? "সময় পেরিয়েছে" : "শেষ তারিখ কাছে"}`,
          detail: `${e.lead?.name ?? "ক্রেতা"} — ${dueText(d)}`,
          titleEn: `${DUE_LABEL[d.kind].en} ${d.state === "overdue" ? "overdue" : "due soon"}`,
          detailEn: `${e.lead?.name ?? "Customer"} — due ${d.dueDate}`,
          phone: e.lead?.phone_number ?? null,
          dueAt: `${d.dueDate}T00:00:00+06:00`,
          overdue: d.state === "overdue",
          priority: d.state,
        });
      }
    }
  }

  const { compareFollowUpPriority } = await import("@/lib/follow-up-priority");
  return out.sort((a, b) => {
    // Unfinished reports remain mandatory and stay pinned before follow-ups.
    if (a.kind !== b.kind) {
      if (a.kind === "report") return -1;
      if (b.kind === "report") return 1;
    }
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

/** Profile ids of HQ/IT coordinators (admin role) — same rule as the web bell's authority scope. */
export async function coordinatorProfileIds(): Promise<Set<string>> {
  const supabaseAdmin = await admin();
  const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id").eq("role", "admin");
  const userIds = (roles ?? []).map((r) => r.user_id);
  if (userIds.length === 0) return new Set();
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id").in("user_id", userIds);
  return new Set((profiles ?? []).map((p) => p.id));
}

export async function isCoordinatorProfile(profileId: string): Promise<boolean> {
  return (await coordinatorProfileIds()).has(profileId);
}

/**
 * Sends the due reminders to every active agent's devices. Safe to run on a
 * schedule: an item already notified is skipped. Coordinators also get every
 * agent's site-visit reminders, matching the web bell.
 */
export async function sweepReminders(now = new Date()) {
  const supabaseAdmin = await admin();
  const { sendPush } = await import("@/lib/push.server");
  const { visitReminderKey } = await import("@/lib/site-visit-rules");
  type VisitReminderStage = import("@/lib/site-visit-rules").VisitReminderStage;

  const { data: agents } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("is_active", true)
    .eq("approval_status", "approved");
  const coordinators = await coordinatorProfileIds();

  const hourBucket = now.toISOString().slice(0, 13);
  let followUpPushes = 0;
  let reportPushes = 0;

  for (const agent of agents ?? []) {
    const all = await remindersFor(agent.id, now, { allVisits: coordinators.has(agent.id) });
    // Only fresh items buzz the phone: a follow-up older than the window is
    // backlog, and it is still listed in the app. Cap the burst per sweep.
    const fresh = all.filter(
      (item) =>
        item.kind === "report" ||
        now.getTime() - new Date(item.dueAt).getTime() <= FOLLOW_UP_PUSH_WINDOW_HOURS * 3_600_000,
    );
    for (const item of fresh.slice(0, MAX_PUSH_PER_SWEEP)) {
      // Upcoming follow-ups buzz once when the reminder window opens; a missed
      // (overdue) follow-up buzzes again every 3 hours until done or backlog.
      const overdueBucket = Math.floor(now.getTime() / (3 * 3_600_000));
      const eventKey = item.kind === "handover" ? `handover:${item.id}:${agent.id}` : item.kind === "site_visit"
        ? visitReminderKey({ id: item.id, visit_at: item.dueAt }, item.priority as VisitReminderStage, agent.id, now.getTime()) :
        item.kind === "follow_up"
          ? item.overdue
            ? `follow_up_overdue:${item.id}:${overdueBucket}`
            : `follow_up_due:${item.id}`
          : `report_pending:${item.id}:${hourBucket}`;
      const result = await sendPush({
        eventKey,
        kind: item.kind === "follow_up" ? "follow_up_reminder" : "report_reminder",
        entityId: item.id,
        profileIds: [agent.id],
        payload: {
          title: item.kind === "follow_up" && item.overdue ? `⚠️ ${item.title}` : item.title,
          body: item.detail,
          path: item.kind === "site_visit" ? "/site-visits" : item.kind === "handover" && item.leadId ? `/leads/${item.leadId}` : "/desk",
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
