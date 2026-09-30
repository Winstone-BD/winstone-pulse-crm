/** Pure Lead 360 assembly: one lead = one permanent, ordered history. */
import { followUpReasonLabel } from "@/lib/follow-up-reasons";
import { contactCloseReasonLabel } from "@/lib/contact-close-reasons";

export type L360Call = {
  id: string;
  at: string;
  agentId: string | null;
  connected: boolean;
  durationSeconds: number | null;
  category: string | null;
  customerResponse: string | null;
  nextAction: string | null;
  summary: string | null;
  requirement: string | null;
  closeReason?: string | null;
};
export type L360StateChange = { id: string; field: string; oldValue: string | null; newValue: string | null; changedBy: string | null; source: string; at: string };
export type L360FollowUp = {
  id: string;
  agentId: string | null;
  scheduledAt: string;
  status: string;
  reasonCode: string | null;
  note: string | null;
  createdAt: string;
  completedAt: string | null;
  rescheduleCount: number;
};
export type L360Change = {
  id: string;
  followUpId: string;
  action: string;
  oldScheduledAt: string | null;
  newScheduledAt: string | null;
  reasonCode: string | null;
  note: string | null;
  changedBy: string | null;
  changedAt: string;
};
export type L360Event = { id: string; kind: string; detail: string | null; agentId: string | null; at: string };

export type TimelineItem = {
  id: string;
  at: string;
  kind:
    | "lead_created"
    | "call_connected"
    | "call_not_connected"
    | "follow_up_created"
    | "follow_up_rescheduled"
    | "follow_up_completed"
    | "follow_up_updated"
    | "status_changed";
  title: string;
  lines: string[];
  agentId: string | null;
};

const isDone = (s: string) => s === "done" || s === "completed";

export function mmss(sec: number | null) {
  if (!sec || sec <= 0) return "0s";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}m ${s}s` : `${s}s`;
}

const fmt = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-GB", {
        timeZone: "Asia/Dhaka",
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

export function summarize(calls: L360Call[], followUps: L360FollowUp[], now = new Date()) {
  const connected = calls.filter((c) => c.connected).length;
  const open = followUps.filter((f) => !isDone(f.status));
  const overdue = open.filter((f) => new Date(f.scheduledAt) < now);
  const upcoming = open.filter((f) => new Date(f.scheduledAt) >= now);
  const byCreated = [...followUps].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const current =
    [...open].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0] ?? null;
  const lastContact = calls.map((c) => c.at).sort().at(-1) ?? null;
  return {
    totalCalls: calls.length,
    connected,
    notConnected: calls.length - connected,
    totalFollowUps: followUps.length,
    completed: followUps.filter((f) => isDone(f.status)).length,
    upcoming: upcoming.length,
    overdue: overdue.length,
    rescheduled: followUps.reduce((n, f) => n + (f.rescheduleCount || 0), 0),
    firstFollowUpAt: byCreated[0]?.createdAt ?? null,
    lastFollowUpAt: byCreated.at(-1)?.createdAt ?? null,
    nextFollowUpAt: current?.scheduledAt ?? null,
    current,
    lastContactAt: lastContact,
    daysSinceContact: lastContact
      ? Math.floor((now.getTime() - new Date(lastContact).getTime()) / 86_400_000)
      : null,
  };
}

export function buildLeadTimeline(input: {
  lead: { id: string; createdAt: string; source: string | null; assignedTo: string | null };
  calls: L360Call[];
  followUps: L360FollowUp[];
  changes: L360Change[];
  events: L360Event[];
  stateChanges?: L360StateChange[];
  agentName: (id: string | null) => string;
}): TimelineItem[] {
  const items: TimelineItem[] = [];
  const { lead, agentName } = input;
  items.push({
    id: `lead:${lead.id}`,
    at: lead.createdAt,
    kind: "lead_created",
    title: "LEAD CREATED",
    lines: [`Source: ${lead.source ?? "—"}`, `Assigned: ${agentName(lead.assignedTo)}`],
    agentId: null,
  });
  input.calls.forEach((c) => {
    items.push({
      id: `call:${c.id}`,
      at: c.at,
      kind: c.connected ? "call_connected" : "call_not_connected",
      title: c.connected ? "CALL — CONNECTED" : "CALL — NOT CONNECTED",
      lines: c.connected
        ? [
            `Duration: ${mmss(c.durationSeconds)}`,
            c.customerResponse ? `Customer response: ${c.customerResponse}` : "",
            c.summary ? c.summary : "",
            c.nextAction ? `Next Action: ${c.nextAction}` : "",
            c.closeReason ? `যোগাযোগ বন্ধের কারণ: ${contactCloseReasonLabel(c.closeReason)}` : "",
            `Agent: ${agentName(c.agentId)}`,
          ].filter(Boolean)
        : [c.category ? `ফলাফল: ${c.category}` : "No Answer", "System Action: Retry Queue-তে পাঠানো হয়েছে", `Agent: ${agentName(c.agentId)}`],
      agentId: c.agentId,
    });
  });
  const fuById = new Map(input.followUps.map((f) => [f.id, f]));
  const loggedCreate = new Set(input.changes.filter((c) => c.action === "created").map((c) => c.followUpId));
  // Follow-ups older than the audit log: synthesize their creation from the row itself.
  input.followUps.forEach((f) => {
    if (loggedCreate.has(f.id)) return;
    items.push({
      id: `fu:${f.id}`,
      at: f.createdAt,
      kind: "follow_up_created",
      title: "FOLLOW-UP SCHEDULED",
      lines: [`সময়: ${fmt(f.scheduledAt)}`, `কারণ: ${followUpReasonLabel(f.reasonCode, f.note)}`, `Agent: ${agentName(f.agentId)}`],
      agentId: f.agentId,
    });
    if (isDone(f.status) && f.completedAt && !input.changes.some((c) => c.followUpId === f.id && c.action === "completed")) {
      items.push({
        id: `fudone:${f.id}`,
        at: f.completedAt,
        kind: "follow_up_completed",
        title: "FOLLOW-UP COMPLETED",
        lines: [`Agent: ${agentName(f.agentId)}`],
        agentId: f.agentId,
      });
    }
  });
  input.changes.forEach((c) => {
    const fu = fuById.get(c.followUpId);
    const reason = `কারণ: ${followUpReasonLabel(c.reasonCode ?? fu?.reasonCode, c.note ?? fu?.note)}`;
    const by = `Changed By: ${agentName(c.changedBy)}`;
    const map: Record<string, Pick<TimelineItem, "kind" | "title" | "lines">> = {
      created: { kind: "follow_up_created", title: "FOLLOW-UP SCHEDULED", lines: [`সময়: ${fmt(c.newScheduledAt)}`, reason, by] },
      rescheduled: {
        kind: "follow_up_rescheduled",
        title: "FOLLOW-UP RESCHEDULED",
        lines: [`Original: ${fmt(c.oldScheduledAt)}`, `Changed To: ${fmt(c.newScheduledAt)}`, reason, by],
      },
      completed: { kind: "follow_up_completed", title: "FOLLOW-UP COMPLETED", lines: [by] },
    };
    const m = map[c.action] ?? { kind: "follow_up_updated" as const, title: "FOLLOW-UP UPDATED", lines: [reason, by] };
    items.push({ id: `chg:${c.id}`, at: c.changedAt, agentId: c.changedBy, ...m });
  });
  input.events
    .filter((e) => /status|convert|closed|outcome/i.test(e.kind))
    .forEach((e) =>
      items.push({
        id: `ev:${e.id}`,
        at: e.at,
        kind: "status_changed",
        title: /convert|closed_converted/i.test(`${e.kind} ${e.detail ?? ""}`) ? "CONVERTED" : "STATUS CHANGED",
        lines: [e.detail ?? e.kind, `Agent: ${agentName(e.agentId)}`],
        agentId: e.agentId,
      }),
    );
  const FIELD: Record<string, string> = { assigned_to: "ASSIGNMENT CHANGED", status: "STATUS CHANGED", work_state: "WORK STATE CHANGED", temperature: "CATEGORY CHANGED" };
  (input.stateChanges ?? []).forEach((c) => {
    const val = (v: string | null) => (c.field === "assigned_to" ? agentName(v) : v ?? "—");
    items.push({
      id: `sc:${c.id}`,
      at: c.at,
      kind: "status_changed",
      title: FIELD[c.field] ?? "CHANGED",
      lines: [`${val(c.oldValue)} → ${val(c.newValue)}`, `Changed By: ${c.changedBy ? agentName(c.changedBy) : "System"}`, `Source: ${c.source}`],
      agentId: c.changedBy,
    });
  });
  // De-duplicate by id so a retried event can never render twice.
  const seen = new Set<string>();
  return items
    .filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)))
    .sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id));
}

/** CSV for the full Lead 360 history (every event, Dhaka time + UTC). */
export function lead360Csv(meta: { lead: string; phone: string; generatedAt: Date }, items: TimelineItem[]) {
  const esc = (v: string) => {
    const t = /^[=+\-@]/.test(v) ? `'${v}` : v;
    return `"${t.replace(/"/g, '""')}"`;
  };
  const dhaka = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
  const rows = [
    ["Lead 360 history", meta.lead, meta.phone],
    ["Generated at (Asia/Dhaka)", dhaka(meta.generatedAt.toISOString()), `Total events: ${items.length}`],
    [],
    ["Event ID", "Type", "Time (Asia/Dhaka)", "Time (UTC)", "Details"],
    ...items.map((i) => [i.id, i.title, dhaka(i.at), i.at, i.lines.join(" | ")]),
  ];
  return rows.map((r) => r.map((c) => esc(String(c))).join(",")).join("\n");
}
