import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Web CRM entry points for the Sales Team Admin support desk. The Android app
 * uses /api/public/agent/support with its device token; both land in the same
 * tables through team-support.server.ts.
 */

const TokenInput = z.object({ adminToken: z.string().nullable().optional() });

async function caller(adminToken: string | null | undefined) {
  const { resolveCaller } = await import("@/lib/access.server");
  return resolveCaller(adminToken ?? null);
}

const CreateInput = z.object({
  category: z.string().trim().min(2).max(40),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(4000),
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  attachmentUrl: z.string().trim().url().max(500).nullable().optional(),
});

/** An agent opens a support request; it routes to the Sales Team Admin role. */
export const submitSupportRequest = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => CreateInput.parse(input))
  .handler(async ({ data }) => {
    const me = await caller(null);
    if (!me.profile) throw new Error("সাইন ইন করা দরকার");
    const { createSupportTicket } = await import("@/lib/team-support.server");
    const ticket = await createSupportTicket({
      agentProfileId: me.profile.id,
      agentName: me.profile.name,
      agentRole: me.profile.role,
      category: data.category,
      subject: data.subject,
      message: data.message,
      priority: data.priority,
      platform: "web",
      attachmentUrl: data.attachmentUrl ?? null,
    });
    return { ref: ticket.ref, id: ticket.id };
  });

/** The signed-in agent's own requests. */
export const mySupportRequests = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const me = await caller(data.adminToken);
    if (!me.profile) return { tickets: [], replies: [] };
    const { listMyTickets, listReplies } = await import("@/lib/team-support.server");
    const tickets = await listMyTickets(me.profile.id);
    return { tickets, replies: await listReplies(tickets.map((t) => t.id)) };
  });

/** The Sales Team Admin inbox (also readable by IT/HQ authority and coordinators). */
export const supportInbox = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    // The inbox polls every 15s: an expired PIN, a dropped request or a brief
    // backend hiccup must come back as a typed "unavailable", not a 500.
    try {
      const me = await caller(data.adminToken);
      const { supportAccess } = await import("@/lib/team-support-access.server");
      const access = await supportAccess(me);
      if (!access.inbox) return { allowed: false as const, tickets: [], replies: [], error: null };
      const { listInboxTickets, listReplies } = await import("@/lib/team-support.server");
      const tickets = await listInboxTickets();
      return {
        allowed: true as const,
        tickets,
        replies: await listReplies(tickets.map((t) => t.id)),
        error: null,
      };
    } catch (err) {
      console.error("[supportInbox] failed:", err instanceof Error ? err.message : err);
      return { allowed: false as const, tickets: [], replies: [], error: "unavailable" as const };
    }
  });

/** True when this account owns the Sales Team Admin inbox. */
export const mySupportRole = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => TokenInput.parse(input))
  .handler(async ({ data }) => {
    const me = await caller(data.adminToken);
    const { supportAccess } = await import("@/lib/team-support-access.server");
    const access = await supportAccess(me);
    return {
      isTeamAdmin: access.via === "team_admin",
      isAuthority: access.via === "authority" || access.via === "coordinator",
      canManage: access.manage,
    };
  });

/** Manage rights on the shared inbox — never widens any other permission. */
async function requireInboxOwner(adminToken: string | null | undefined) {
  const me = await caller(adminToken);
  const { requireInboxManage } = await import("@/lib/team-support-access.server");
  await requireInboxManage(me);
  return me;
}

export const setSupportTicketStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({
      ticketId: z.string().uuid(),
      status: z.enum(["open", "acknowledged", "in_progress", "resolved", "closed"]),
      resolutionNote: z.string().trim().max(2000).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await requireInboxOwner(data.adminToken);
    const { updateTicketStatus } = await import("@/lib/team-support.server");
    return updateTicketStatus({
      ticketId: data.ticketId,
      status: data.status,
      resolutionNote: data.resolutionNote ?? null,
      actorProfileId: me.profile?.id ?? null,
      actorLabel: me.profile?.name ?? "Sales Team Admin",
    });
  });

/** Escalation / de-escalation. Re-alerts the desk owners when urgency changes. */
export const setSupportTicketPriority = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({
      ticketId: z.string().uuid(),
      priority: z.enum(["low", "normal", "high", "critical"]),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await requireInboxOwner(data.adminToken);
    const { updateTicketPriority } = await import("@/lib/team-support.server");
    return updateTicketPriority({
      ticketId: data.ticketId,
      priority: data.priority,
      actorProfileId: me.profile?.id ?? null,
      actorLabel: me.profile?.name ?? "Sales Team Admin",
    });
  });

export const openSupportTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({ ticketId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await caller(data.adminToken);
    // The side is decided by the server from the caller's own rights, never by
    // the client — an agent can only clear their own unread flag.
    const { ticketSide } = await import("@/lib/team-support-access.server");
    const side = await ticketSide(me, data.ticketId);
    const { markTicketRead } = await import("@/lib/team-support.server");
    await markTicketRead(data.ticketId, side, {
      profileId: me.profile?.id ?? null,
      label: me.profile?.name ?? null,
    });
    return { ok: true, side };
  });

export const replyToSupportTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({
      ticketId: z.string().uuid(),
      body: z.string().trim().min(1).max(4000),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await caller(data.adminToken);
    const { ticketSide } = await import("@/lib/team-support-access.server");
    const side = await ticketSide(me, data.ticketId);
    if (side === "admin") await requireInboxOwner(data.adminToken);
    else if (!me.profile) throw new Error("সাইন ইন করা দরকার");

    const { addReply } = await import("@/lib/team-support.server");
    await addReply({
      ticketId: data.ticketId,
      authorKind: side === "admin" ? "team_admin" : "agent",
      authorProfileId: me.profile?.id ?? null,
      authorLabel: me.profile?.name ?? "Sales Team Admin",
      body: data.body,
    });
    return { ok: true, as: side };
  });

/** Registers this browser for support push notifications. */
export const registerWebPushToken = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({
      token: z.string().trim().min(20).max(400),
      label: z.string().trim().max(120).nullable().optional(),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await caller(data.adminToken);
    if (!me.profile) throw new Error("সাইন ইন করা দরকার");
    const { savePushToken } = await import("@/lib/push.server");
    await savePushToken({
      profileId: me.profile.id,
      token: data.token,
      platform: "web",
      label: data.label ?? "Web browser",
    });
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "push_token_registered",
      entityType: "push_token",
      entityId: me.profile.id,
      actorProfileId: me.profile.id,
      actorLabel: me.profile.name,
      metadata: { platform: "web" },
    });
    return { ok: true };
  });
