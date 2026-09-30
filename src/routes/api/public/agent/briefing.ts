import { createFileRoute } from "@tanstack/react-router";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/public/agent/briefing")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);
        const { agentBriefingStatus } = await import("@/lib/agent-briefing.server");
        return json(await agentBriefingStatus(caller.profile.id));
      },
      POST: async ({ request }) => {
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);
        const { acknowledgeAgentBriefing } = await import("@/lib/agent-briefing.server");
        return json(await acknowledgeAgentBriefing(caller.profile.id, "android"));
      },
    },
  },
});