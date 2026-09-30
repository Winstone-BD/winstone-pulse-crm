import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { buildProjectReport, dhakaPeriodBounds } from "@/lib/project-reports";

const Input = z.object({
  adminToken: z.string().nullable().optional(),
  period: z.enum(["day", "month"]),
  key: z.string().min(7).max(10),
});

export const getProjectReport = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none") throw new Error("অনুমোদিত অ্যাকাউন্ট দিয়ে সাইন ইন করুন");

    const { startIso, endIso } = dhakaPeriodBounds(data.period, data.key);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const inventoryQuery = supabaseAdmin
      .from("inventory_requirements")
      .select("id, label, active, sort_order")
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });
    let reportsQuery = supabaseAdmin
      .from("call_reports")
      .select("lead_id, requirement, category, customer_response, next_action, submitted_at")
      .eq("status", "submitted")
      .gte("submitted_at", startIso)
      .lt("submitted_at", endIso)
      .not("requirement", "is", null)
      .order("submitted_at", { ascending: true })
      .limit(10000);
    let leadsQuery = supabaseAdmin
      .from("leads")
      .select("id")
      .gte("created_at", startIso)
      .lt("created_at", endIso)
      .limit(10000);

    if (caller.scope === "agent") {
      const profileId = caller.profile?.id;
      if (!profileId) throw new Error("Agent profile পাওয়া যায়নি");
      reportsQuery = reportsQuery.eq("agent_id", profileId);
      leadsQuery = leadsQuery.eq("assigned_to", profileId);
    }

    const [inventoryResult, reportsResult, leadsResult] = await Promise.all([
      inventoryQuery,
      reportsQuery,
      leadsQuery,
    ]);
    if (inventoryResult.error) throw new Error(inventoryResult.error.message);
    if (reportsResult.error) throw new Error(reportsResult.error.message);
    if (leadsResult.error) throw new Error(leadsResult.error.message);

    const createdLeadIds = (leadsResult.data ?? []).map((lead) => lead.id);
    const createdLeadRequirements = new Map<string, string>();
    for (let offset = 0; offset < createdLeadIds.length; offset += 200) {
      const ids = createdLeadIds.slice(offset, offset + 200);
      if (!ids.length) continue;
      let requirementQuery = supabaseAdmin
        .from("call_reports")
        .select("lead_id, requirement, submitted_at")
        .in("lead_id", ids)
        .eq("status", "submitted")
        .not("requirement", "is", null)
        .order("submitted_at", { ascending: false });
      if (caller.scope === "agent") {
        const profileId = caller.profile?.id;
        if (!profileId) throw new Error("Agent profile পাওয়া যায়নি");
        requirementQuery = requirementQuery.eq("agent_id", profileId);
      }
      const requirementResult = await requirementQuery;
      if (requirementResult.error) throw new Error(requirementResult.error.message);
      for (const row of requirementResult.data ?? []) {
        if (row.requirement && !createdLeadRequirements.has(row.lead_id)) {
          createdLeadRequirements.set(row.lead_id, row.requirement);
        }
      }
    }

    const rows = buildProjectReport(
      inventoryResult.data ?? [],
      reportsResult.data ?? [],
      createdLeadRequirements,
    );
    return {
      period: data.period,
      key: data.key,
      scope: caller.scope,
      rows,
      totals: rows.reduce(
        (sum, row) => ({
          leads: sum.leads + row.leads,
          calls: sum.calls + row.calls,
          siteVisits: sum.siteVisits + row.siteVisits,
          bookings: sum.bookings + row.bookings,
        }),
        { leads: 0, calls: 0, siteVisits: 0, bookings: 0 },
      ),
    };
  });