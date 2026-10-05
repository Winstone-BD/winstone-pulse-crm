import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createRateLimiter, requestSourceKey } from "@/lib/rate-limit";

const leadIngestLimiter = createRateLimiter(120, 60_000);

/** Webhook payload from website forms / Facebook lead ads. */
const Payload = z.object({
  name: z.string().trim().min(1).max(120),
  phone_number: z.string().trim().min(6).max(24),
  company: z.string().trim().max(120).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  source: z.string().trim().max(40).default("webhook"),
  assign: z.boolean().default(true),
  /** Profile id of the agent adding their own lead from the phone app. */
  agent_id: z.string().uuid().nullable().optional(),
  /** App version that captured the lead, for the version data ledger. */
  app_version: z.string().trim().max(40).nullable().optional(),
  version_code: z.number().int().nullable().optional(),
  client_ref: z.string().trim().max(80).nullable().optional(),
  captured_offline: z.boolean().optional(),
  captured_at: z.string().datetime({ offset: true }).nullable().optional(),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const normalize = (p: string) => p.replace(/[^\d+]/g, "");

export const Route = createFileRoute("/api/public/ingest/lead")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!leadIngestLimiter(requestSourceKey(request))) {
          return json({ error: "Rate limited", retryable: true }, 429);
        }
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind === "none") return json({ error: "Unauthorized" }, 401);

        const parsed = Payload.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid payload" }, 400);
        const body = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // An agent adding their own lead keeps it — no approval, no round-robin.
        let assignedTo: string | null = null;
        let ownerName: string | null = null;
        // Only an authenticated device may self-own its capture. Any other
        // inbound record lands unassigned: LeadHub Nexus is the only
        // assignment path (no round-robin, no browser-supplied agent_id).
        const requestedAgentId = caller.kind === "device" ? caller.profile.id : null;
        if (requestedAgentId) {
          const { data: agent } = await supabaseAdmin
            .from("profiles")
            .select("id, name")
            .eq("id", requestedAgentId)
            .eq("is_active", true)
            .in("role", ["agent", "team_leader"])
            .maybeSingle();
          if (agent) {
            assignedTo = agent.id;
            ownerName = agent.name;
          }
        }

        // Shared intake with the web desk: identical result either way.
        const { intakeLead } = await import("@/lib/lead-intake.server");
        try {
          const result = await intakeLead({
            name: body.name,
            phoneNumber: body.phone_number,
            company: body.company ?? null,
            notes: body.notes ?? null,
            ownerId: assignedTo,
            ownerName,
            source: body.source,
          });
          // Version data guarantee: remember which app version captured this
          // lead (and whether it was written offline), so the data can be
          // handed back if that version is replaced or reinstalled.
          if (result.leadId && caller.kind === "device") {
            const { recordVersionData } = await import("@/lib/version-ledger.server");
            await recordVersionData({
              entityType: "lead",
              entityId: result.leadId,
              appVersion: body.app_version ?? caller.device.app_version ?? null,
              versionCode: body.version_code ?? null,
              deviceId: caller.device.id,
              agentId: caller.profile.id,
              clientRef: body.client_ref ?? null,
              capturedOffline: body.captured_offline ?? false,
              createdOfflineAt: body.captured_at ?? null,
              payload: {
                name: body.name,
                phone_number: body.phone_number,
                company: body.company ?? null,
                notes: body.notes ?? null,
                duplicate: result.duplicate ?? false,
              },
            });
          }
          if (result.duplicate) {
            return json({ ok: true, duplicate: true, lead_id: result.leadId }, 200);
          }
          return json({ ok: true, lead_id: result.leadId, assigned_to: result.assignedTo }, 201);
        } catch (err) {
          const { InvalidLeadPhoneError } = await import("@/lib/lead-intake.server");
          if (err instanceof InvalidLeadPhoneError)
            return json({ error: err.message, code: "invalid_phone" }, 400);
          console.error("lead intake failed", err);
          return json({ error: "Lead could not be saved" }, 500);
        }
      },
    },
  },
});
