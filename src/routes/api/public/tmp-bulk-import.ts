import { createFileRoute } from "@tanstack/react-router";

// Temporary one-off import endpoint — removed right after use.
export const Route = createFileRoute("/api/public/tmp-bulk-import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (request.headers.get("x-token") !== "wz-9f3k2-onceonly-7731") {
          return new Response("no", { status: 401 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const body = (await request.json()) as { rows: Record<string, string | null>[] };
        const phones = body.rows.map((r) => r.phone_number as string);
        const existing = new Set<string>();
        for (let i = 0; i < phones.length; i += 200) {
          const { data } = await supabaseAdmin
            .from("leads")
            .select("phone_number")
            .in("phone_number", phones.slice(i, i + 200));
          for (const d of data ?? []) existing.add(d.phone_number);
        }
        let inserted = 0;
        const errors: string[] = [];
        const fresh = body.rows.filter((r) => !existing.has(r.phone_number as string));
        for (const r of fresh) {
          const { error } = await supabaseAdmin.from("leads").insert({
            ...(r as never),
            source: "head_database",
            status: "pending",
            work_state: "pending",
          });
          if (error) errors.push(error.message);
          else inserted += 1;
        }
        const { data: cfg } = await supabaseAdmin
          .from("app_config")
          .select("data")
          .eq("id", "lead_pool_daily")
          .maybeSingle();
        const cur = (cfg?.data ?? {}) as Record<string, unknown>;
        await supabaseAdmin
          .from("app_config")
          .upsert({ id: "lead_pool_daily", data: { ...cur, perAgent: 50 } as never, updated_at: new Date().toISOString() });
        const errSummary: Record<string, number> = {};
        for (const e of errors) errSummary[e.slice(0, 80)] = (errSummary[e.slice(0, 80)] ?? 0) + 1;
        return Response.json({ received: body.rows.length, alreadyInCrm: existing.size, inserted, errSummary });
      },
    },
  },
});
