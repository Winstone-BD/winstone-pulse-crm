import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Read-only feed for the Sales Command Center: submitted call reports and
 * follow-up events, fully paged (no latest-N truncation) and scoped by the
 * server-resolved caller — agents get only their own rows, HQ the floor.
 */
const Input = z.object({ adminToken: z.string().nullable().optional() });

async function pageAll<T>(fetchPage: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let start = 0; ; start += 1000) {
    const { data, error } = await fetchPage(start, start + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export const getCommandCenterFeed = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input ?? {}))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none") return { reports: [], followUps: [] };
    const me = caller.scope === "agent" ? caller.profile?.id : null;
    if (caller.scope === "agent" && !me) throw new Error("Agent profile পাওয়া যায়নি");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [reports, followUps] = await Promise.all([
      pageAll((a, b) => {
        let q = supabaseAdmin
          .from("call_reports")
          .select("id, lead_id, agent_id, category, customer_response, next_action, requirement, submitted_at, created_at")
          .eq("status", "submitted");
        if (me) q = q.eq("agent_id", me);
        return q.order("created_at", { ascending: true }).order("id").range(a, b);
      }),
      pageAll((a, b) => {
        let q = supabaseAdmin
          .from("follow_up_events")
          .select("id, lead_id, agent_id, status, scheduled_at, completed_at");
        if (me) q = q.eq("agent_id", me);
        return q.order("created_at", { ascending: true }).order("id").range(a, b);
      }),
    ]);
    return { reports, followUps };
  });
