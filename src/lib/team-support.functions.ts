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
    const me = await caller(data.adminToken);
    const { supportAccess } = await import("@/lib/team-support-access.server");
    const access = await supportAccess(me);
    if (!access.inbox) return { allowed: false as const, tickets: [], replies: [] };
    const { listInboxTickets, listReplies } = await import("@/lib/team-support.server");
    const tickets = await listInboxTickets();
    return { allowed: true as const, tickets, replies: await listReplies(tickets.map((t) => t.id)) };
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

export const openSupportTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({
      ticketId: z.string().uuid(),
      side: z.enum(["admin", "agent"]),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await caller(data.adminToken);
    const { markTicketRead } = await import("@/lib/team-support.server");
    await markTicketRead(data.ticketId, data.side, {
      profileId: me.profile?.id ?? null,
      label: me.profile?.name ?? null,
    });
    return { ok: true };
  });

export const replyToSupportTicket = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    TokenInput.extend({
      ticketId: z.string().uuid(),
      body: z.string().trim().min(1).max(4000),
      as: z.enum(["agent", "team_admin"]),
    }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await caller(data.adminToken);
    if (!me.profile && data.as === "agent") throw new Error("সাইন ইন করা দরকার");
    if (data.as === "team_admin") await requireInboxOwner(data.adminToken);
    const { addReply } = await import("@/lib/team-support.server");
    await addReply({
      ticketId: data.ticketId,
      authorKind: data.as,
      authorProfileId: me.profile?.id ?? null,
      authorLabel: me.profile?.name ?? "Sales Team Admin",
      body: data.body,
    });
    return { ok: true };
  });
