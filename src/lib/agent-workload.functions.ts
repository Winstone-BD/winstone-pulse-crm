import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const agentWorkload = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().max(4096).nullable().optional(), day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope !== "authority") throw new Error("HQ / IT access required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { dhakaDayBounds, isPendingWork, workloadRow } = await import("@/lib/agent-workload");
    const { newLeadCountsForDay } = await import("@/lib/new-lead-topup.server");
    const bounds = dhakaDayBounds(data.day);
    const [{ data: agents, error }, fresh] = await Promise.all([
      supabaseAdmin.from("profiles").select("id,name,employee_id").eq("role", "agent").eq("is_active", true).eq("approval_status", "approved").order("name"),
      newLeadCountsForDay(data.day),
    ]);
    if (error) throw error;
    const rows = await Promise.all((agents ?? []).map(async (agent) => {
      let pending = 0;
      for (let offset = 0; ; offset += 1000) {
        const result = await supabaseAdmin.from("leads").select("status,work_state").eq("assigned_to", agent.id).eq("status", "pending").order("id").range(offset, offset + 999);
        if (result.error) throw result.error;
        pending += (result.data ?? []).filter((lead) => isPendingWork(lead.status, lead.work_state)).length;
        if ((result.data ?? []).length < 1000) break;
      }
      const calls = await supabaseAdmin.from("call_recordings").select("id", { count: "exact", head: true }).eq("agent_id", agent.id).eq("call_direction", "outgoing").gte("started_at", bounds.start).lt("started_at", bounds.end);
      if (calls.error) throw calls.error;
      return { agentId: agent.id, name: agent.name, employeeId: agent.employee_id, ...workloadRow(fresh.get(agent.id) ?? 0, pending, calls.count ?? 0) };
    }));
    return { day: data.day, checkedAt: new Date().toISOString(), rows };
  });