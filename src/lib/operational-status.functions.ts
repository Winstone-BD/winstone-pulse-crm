import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { summarizeUsage, UsageEvent } from "./usage-ledger";
const Input = z.object({
  adminToken: z.string().nullable().optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
});
export const operationalStatus = createServerFn({ method: "POST" })
  .inputValidator((v: unknown) => Input.parse(v))
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("./access.server");
    requireAuthority(await resolveCaller(data.adminToken));
    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const events = [];
    for (let offset = 0; ; offset += 1000) {
      const r = await db
        .from("crm_usage_events")
        .select("*")
        .eq("month_bucket", data.month)
        .order("id")
        .range(offset, offset + 999);
      if (r.error) throw new Error("Cost telemetry unavailable");
      events.push(...(r.data ?? []));
      if ((r.data?.length ?? 0) < 1000) break;
      if (offset >= 99000) throw new Error("Cost report exceeds safe export size");
    }
    const [age, billing, subscription, sheets] = await Promise.all([
      db.rpc("pending_lead_age_report"),
      db
        .from("service_invoices")
        .select("period,status,service_active_until")
        .order("period", { ascending: false })
        .limit(3),
      db.from("subscriptions").select("status,environment,current_period_end"),
      db
        .from("sheet_sync_events")
        .select("surface,outcome,http_status,created_at")
        .order("created_at", { ascending: false })
        .limit(30),
    ]);
    for (const r of [age, billing, subscription, sheets])
      if (r.error) throw new Error("Operational evidence unavailable");
    return {
      events,
      summary: summarizeUsage(events.map((e) => UsageEvent.parse(e))),
      aging: age.data as unknown as {
        denominator: number;
        unknownAge: number;
        agedCount: number;
        rows: {
          id: string;
          name: string;
          agent_name: string | null;
          agent_id: string;
          assigned_at: string;
          call_count: number | null;
          last_call_at: string | null;
        }[];
      },
      billing: billing.data ?? [],
      subscriptions: subscription.data ?? [],
      sheets: sheets.data ?? [],
      sources: {
        build:
          "Lovable account usage connection not linked; platform Build credits remain unallocated.",
        run: "Runtime observations only; legacy configured estimates are not provider invoices.",
        cash: "Actual cash costs unavailable without provider invoice evidence.",
      },
    };
  });
