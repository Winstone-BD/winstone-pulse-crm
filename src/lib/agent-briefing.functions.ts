import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Input = z.object({ adminToken: z.string().nullable().optional() });

async function agent(adminToken?: string | null) {
  const { resolveCaller } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken ?? null);
  if (caller.scope !== "agent" || !caller.profile) throw new Error("Agent account required");
  return caller.profile;
}

export const getMyBriefingStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    const { agentBriefingStatus } = await import("@/lib/agent-briefing.server");
    // HQ/IT and signed-out sessions never face the agent briefing gate.
    if (caller.scope !== "agent" || !caller.profile) {
      const base = await agentBriefingStatus("00000000-0000-0000-0000-000000000000", 0);
      return { ...base, required: false, acknowledged: true };
    }
    return agentBriefingStatus(caller.profile.id);
  });

export const acknowledgeMyBriefing = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const me = await agent(data.adminToken);
    const { acknowledgeAgentBriefing } = await import("@/lib/agent-briefing.server");
    return acknowledgeAgentBriefing(me.id, "web");
  });