/**
 * Agent → Sales Team Admin support desk.
 *
 * One database, one API, two front doors: the web CRM and the Winstone Connect
 * Android app both write to `team_support_tickets`, so a request opened on the
 * phone shows up in the same inbox as one opened in the browser.
 *
 * The destination is a ROLE, never a personal phone number: whoever sits in
 * `team_support_admins` receives the ticket. Today that is Abu Haidar
 * (Sell Team Admin). Least privilege — being a support admin grants the inbox
 * only, no IT or coordinator powers.
 */

export * from "@/lib/team-support-shared";
import { PRIORITY_LABELS, categoryLabel, type SupportPriority, type SupportStatus } from "@/lib/team-support-shared";
export type { SupportPriority, SupportStatus };

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Profile ids that receive agent support requests. */
export async function supportAdminIds(): Promise<string[]> {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin.from("team_support_admins").select("profile_id");
  return (data ?? []).map((row) => row.profile_id);
}

export async function isSupportAdmin(profileId: string | null | undefined): Promise<boolean> {
  if (!profileId) return false;
  return (await supportAdminIds()).includes(profileId);
}

/** WIN-SUP-0001 style human reference, stable and readable in both apps. */
async function nextRef(): Promise<string> {
  const supabaseAdmin = await admin();
  const { count } = await supabaseAdmin
    .from("team_support_tickets")
    .select("id", { count: "exact", head: true });
  return `WIN-SUP-${String((count ?? 0) + 1).padStart(4, "0")}`;
}

export type CreateTicketInput = {
  agentProfileId: string;
  agentName: string;
  agentRole: string;
  category: string;
  subject: string;
  message: string;
  priority: SupportPriority;
  platform: "web" | "android";
  deviceLabel?: string | null;
  attachmentUrl?: string | null;
};

/**
 * Opens one support request and points it at the Sales Team Admin role.
 * Raises an in-app alert so the admin's inbox badge lights up the moment the
 * request lands, on the phone as well as on the web board.
 */
export async function createSupportTicket(input: CreateTicketInput) {
  const supabaseAdmin = await admin();
  const admins = await supportAdminIds();
  const ref = await nextRef();

  const { data, error } = await supabaseAdmin
    .from("team_support_tickets")
    .insert({
      ref,
      agent_profile_id: input.agentProfileId,
      agent_name: input.agentName,
      agent_role: input.agentRole,
      category: input.category,
      subject: input.subject,
      message: input.message,
      priority: input.priority,
      platform: input.platform,
      device_label: input.deviceLabel ?? null,
      attachment_url: input.attachmentUrl ?? null,
      assigned_profile_id: admins[0] ?? null,
      assigned_role: "sales_team_admin",
      last_message_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  const { logAudit } = await import("@/lib/audit.server");
  await logAudit({
    action: "support_ticket_created",
    entityType: "team_support_ticket",
    entityId: data.id,
    actorProfileId: input.agentProfileId,
    actorLabel: input.agentName,
    metadata: {
      ref,
      category: input.category,
      priority: input.priority,
      platform: input.platform,
      assignedRole: "sales_team_admin",
    },
  });

  // Real, event-backed notification: one alert row per request, shown as an
  // unread badge in the Sales Team Admin inbox on web and Android.
  await supabaseAdmin.from("system_alerts").insert({
    code: "team_support_request",
    severity: input.priority === "critical" ? "critical" : "warning",
    title: `নতুন সাপোর্ট অনুরোধ — ${input.agentName}`,
    detail: `${categoryLabel(input.category)} · ${PRIORITY_LABELS[input.priority]}\n${input.subject}`,
    action: `টিম সাপোর্ট ইনবক্স → ${ref}`,
  });

  // Push to Haidar's phone/browser and to the admins who watch the desk.
  const { sendPush } = await import("@/lib/push.server");
  await sendPush({
    eventKey: `support_ticket_created:${data.id}`,
    kind: "support_ticket_created",
    entityId: data.id,
    profileIds: await notifyRecipients(),
    payload: {
      title: `নতুন সাপোর্ট অনুরোধ — ${input.agentName}`,
      body: `${categoryLabel(input.category)} · ${PRIORITY_LABELS[input.priority]} — ${input.subject}`,
      path: "/desk?tab=support",
      data: { ref, ticket_id: data.id, priority: input.priority },
    },
  });

  return data;
}

/** Who should be alerted about support activity: the desk owners plus admins. */
export async function notifyRecipients(): Promise<string[]> {
  const supabaseAdmin = await admin();
  const ids = new Set(await supportAdminIds());
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .eq("role", "admin")
    .eq("is_active", true)
    .eq("approval_status", "approved");
  (data ?? []).forEach((row) => ids.add(row.id));
  return [...ids];
}

/**
 * Changes a ticket's urgency. A raised priority is a real event: it re-alerts
 * the desk owners so an escalation is never missed.
 */
export async function updateTicketPriority(input: {
  ticketId: string;
  priority: SupportPriority;
  actorProfileId?: string | null;
  actorLabel?: string | null;
}) {
  const supabaseAdmin = await admin();
  const { data: before } = await supabaseAdmin
    .from("team_support_tickets")
    .select("ref, priority, subject, agent_name, category")
    .eq("id", input.ticketId)
    .maybeSingle();
  if (!before) throw new Error("এই অনুরোধ পাওয়া যায়নি");
  if (before.priority === input.priority) return { ref: before.ref, priority: input.priority };

  const { error } = await supabaseAdmin
    .from("team_support_tickets")
    .update({ priority: input.priority, unread_for_admin: true })
    .eq("id", input.ticketId);
  if (error) throw new Error(error.message);

  const { logAudit } = await import("@/lib/audit.server");
  await logAudit({
    action: "support_ticket_priority_changed",
    entityType: "team_support_ticket",
    entityId: input.ticketId,
    actorProfileId: input.actorProfileId ?? null,
    actorLabel: input.actorLabel ?? null,
    metadata: { ref: before.ref, from: before.priority, to: input.priority },
  });

  await supabaseAdmin.from("system_alerts").insert({
    code: "team_support_priority",
    severity: input.priority === "critical" ? "critical" : "warning",
    title: `গুরুত্ব বদলেছে — ${before.ref}`,
    detail: `${before.agent_name} · ${categoryLabel(before.category)}\n${PRIORITY_LABELS[before.priority as SupportPriority]} → ${PRIORITY_LABELS[input.priority]}`,
    action: `টিম সাপোর্ট ইনবক্স → ${before.ref}`,
  });

  const { sendPush } = await import("@/lib/push.server");
  await sendPush({
    eventKey: `support_priority:${input.ticketId}:${input.priority}:${new Date().toISOString().slice(0, 16)}`,
    kind: "support_ticket_priority_changed",
    entityId: input.ticketId,
    profileIds: await notifyRecipients(),
    payload: {
      title: `গুরুত্ব বদলেছে — ${before.ref}`,
      body: `${PRIORITY_LABELS[before.priority as SupportPriority]} → ${PRIORITY_LABELS[input.priority]} · ${before.subject}`,
      path: "/desk?tab=support",
      data: { ref: before.ref, ticket_id: input.ticketId, priority: input.priority },
    },
  });

  return { ref: before.ref, priority: input.priority };
}

export async function listMyTickets(agentProfileId: string) {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("team_support_tickets")
    .select("*")
    .eq("agent_profile_id", agentProfileId)
    .order("created_at", { ascending: false })
    .limit(200);
  return data ?? [];
}

export async function listInboxTickets() {
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("team_support_tickets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(300);
  return data ?? [];
}

export async function listReplies(ticketIds: string[]) {
  if (ticketIds.length === 0) return [];
  const supabaseAdmin = await admin();
  const { data } = await supabaseAdmin
    .from("team_support_replies")
    .select("*")
    .in("ticket_id", ticketIds)
    .order("created_at", { ascending: true })
    .limit(1000);
  return data ?? [];
}

/** Opening a ticket in the inbox marks it read for that side only. */
export async function markTicketRead(
  ticketId: string,
  side: "admin" | "agent",
  actor: { profileId?: string | null; label?: string | null },
) {
  const supabaseAdmin = await admin();
  await supabaseAdmin
    .from("team_support_tickets")
    .update(side === "admin" ? { unread_for_admin: false } : { unread_for_agent: false })
    .eq("id", ticketId);
  const { logAudit } = await import("@/lib/audit.server");
  await logAudit({
    action: "support_ticket_viewed",
    entityType: "team_support_ticket",
    entityId: ticketId,
    actorProfileId: actor.profileId ?? null,
    actorLabel: actor.label ?? null,
    metadata: { side },
  });
}

export async function updateTicketStatus(input: {
  ticketId: string;
  status: SupportStatus;
  resolutionNote?: string | null;
  actorProfileId?: string | null;
  actorLabel?: string | null;
}) {
  const supabaseAdmin = await admin();
  const resolved = input.status === "resolved" || input.status === "closed";
  const { data, error } = await supabaseAdmin
    .from("team_support_tickets")
    .update({
      status: input.status,
      resolution_note: input.resolutionNote ?? null,
      resolved_at: resolved ? new Date().toISOString() : null,
      unread_for_agent: true,
    })
    .eq("id", input.ticketId)
    .select("ref, status")
    .single();
  if (error) throw new Error(error.message);

  const { logAudit } = await import("@/lib/audit.server");
  await logAudit({
    action: resolved ? "support_ticket_resolved" : "support_ticket_status_changed",
    entityType: "team_support_ticket",
    entityId: input.ticketId,
    actorProfileId: input.actorProfileId ?? null,
    actorLabel: input.actorLabel ?? null,
    metadata: { ref: data.ref, status: input.status },
  });
  return data;
}

export async function addReply(input: {
  ticketId: string;
  authorKind: "agent" | "team_admin";
  authorProfileId?: string | null;
  authorLabel?: string | null;
  body: string;
}) {
  const supabaseAdmin = await admin();
  const { error } = await supabaseAdmin.from("team_support_replies").insert({
    ticket_id: input.ticketId,
    author_kind: input.authorKind,
    author_profile_id: input.authorProfileId ?? null,
    author_label: input.authorLabel ?? null,
    body: input.body,
  });
  if (error) throw new Error(error.message);

  const { data: current } = await supabaseAdmin
    .from("team_support_tickets")
    .select("reply_count")
    .eq("id", input.ticketId)
    .maybeSingle();

  await supabaseAdmin
    .from("team_support_tickets")
    .update({
      reply_count: (current?.reply_count ?? 0) + 1,
      last_message_at: new Date().toISOString(),
      unread_for_admin: input.authorKind === "agent",
      unread_for_agent: input.authorKind === "team_admin",
    })
    .eq("id", input.ticketId);
}
