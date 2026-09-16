import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Winstone Connect (Android) support channel — the same tables the web CRM uses.
 *
 * GET  -> the phone's own requests (plus the inbox when this agent is the
 *         Sales Team Admin, so Haidar sees complaints on his phone)
 * POST -> opens a support request, routed to the Sales Team Admin role
 * PATCH-> team admin marks read / changes status / replies
 *
 * Authenticated by the per-device token (`x-device-token`), never a shared secret.
 */
const CreateBody = z.object({
  category: z.string().trim().min(2).max(40),
  subject: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(4000),
  priority: z.enum(["low", "normal", "high", "critical"]).default("normal"),
  attachment_url: z.string().trim().url().max(500).nullable().optional(),
});

const PatchBody = z.discriminatedUnion("action", [
  z.object({ action: z.literal("read"), ticket_id: z.string().uuid() }),
  z.object({
    action: z.literal("status"),
    ticket_id: z.string().uuid(),
    status: z.enum(["open", "acknowledged", "in_progress", "resolved", "closed"]),
    resolution_note: z.string().trim().max(2000).nullable().optional(),
  }),
  z.object({
    action: z.literal("reply"),
    ticket_id: z.string().uuid(),
    body: z.string().trim().min(1).max(4000),
  }),
  z.object({
    action: z.literal("priority"),
    ticket_id: z.string().uuid(),
    priority: z.enum(["low", "normal", "high", "critical"]),
  }),
  // Firebase device token for support alerts on the phone.
  z.object({
    action: z.literal("push_token"),
    token: z.string().trim().min(20).max(400),
  }),
]);

export const Route = createFileRoute("/api/public/agent/support")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { resolveApiCaller, json } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);

        const { isSupportAdmin, listMyTickets, listInboxTickets, listReplies } = await import(
          "@/lib/team-support.server"
        );
        const teamAdmin = await isSupportAdmin(caller.profile.id);
        const tickets = teamAdmin
          ? await listInboxTickets()
          : await listMyTickets(caller.profile.id);
        return json({
          ok: true,
          is_team_admin: teamAdmin,
          unread: teamAdmin ? tickets.filter((t) => t.unread_for_admin).length : 0,
          tickets,
          replies: await listReplies(tickets.map((t) => t.id)),
        });
      },

      POST: async ({ request }) => {
        const { resolveApiCaller, json } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);

        const parsed = CreateBody.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid body" }, 400);

        const { createSupportTicket } = await import("@/lib/team-support.server");
        const ticket = await createSupportTicket({
          agentProfileId: caller.profile.id,
          agentName: caller.profile.name,
          agentRole: caller.profile.role,
          category: parsed.data.category,
          subject: parsed.data.subject,
          message: parsed.data.message,
          priority: parsed.data.priority,
          platform: "android",
          deviceLabel: caller.device.device_label ?? caller.device.model ?? null,
          attachmentUrl: parsed.data.attachment_url ?? null,
        });
        return json({ ok: true, ref: ticket.ref, ticket_id: ticket.id }, 201);
      },

      PATCH: async ({ request }) => {
        const { resolveApiCaller, json } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);

        const parsed = PatchBody.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid body" }, 400);

        const support = await import("@/lib/team-support.server");
        const teamAdmin = await support.isSupportAdmin(caller.profile.id);

        if (parsed.data.action === "push_token") {
          const { savePushToken } = await import("@/lib/push.server");
          await savePushToken({
            profileId: caller.profile.id,
            token: parsed.data.token,
            platform: "android",
            deviceId: caller.device.id,
            label: caller.device.device_label ?? caller.device.model ?? null,
          });
          return json({ ok: true });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: ticket } = await supabaseAdmin
          .from("team_support_tickets")
          .select("id, agent_profile_id")
          .eq("id", parsed.data.ticket_id)
          .maybeSingle();
        if (!ticket) return json({ error: "Not found" }, 404);
        const owner = ticket.agent_profile_id === caller.profile.id;
        if (!teamAdmin && !owner) return json({ error: "Forbidden" }, 403);

        if (parsed.data.action === "read") {
          await support.markTicketRead(ticket.id, teamAdmin ? "admin" : "agent", {
            profileId: caller.profile.id,
            label: caller.profile.name,
          });
          return json({ ok: true });
        }
        if (parsed.data.action === "priority") {
          if (!teamAdmin) return json({ error: "Forbidden" }, 403);
          await support.updateTicketPriority({
            ticketId: ticket.id,
            priority: parsed.data.priority,
            actorProfileId: caller.profile.id,
            actorLabel: caller.profile.name,
          });
          return json({ ok: true });
        }
        if (parsed.data.action === "status") {
          if (!teamAdmin) return json({ error: "Forbidden" }, 403);
          await support.updateTicketStatus({
            ticketId: ticket.id,
            status: parsed.data.status,
            resolutionNote: parsed.data.resolution_note ?? null,
            actorProfileId: caller.profile.id,
            actorLabel: caller.profile.name,
          });
          return json({ ok: true });
        }
        await support.addReply({
          ticketId: ticket.id,
          authorKind: teamAdmin ? "team_admin" : "agent",
          authorProfileId: caller.profile.id,
          authorLabel: caller.profile.name,
          body: parsed.data.body,
        });
        return json({ ok: true });
      },
    },
  },
});
