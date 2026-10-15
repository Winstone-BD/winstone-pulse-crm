import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type LiveLeadDay = { day: string; added: number; assigned: number; called: number; reports: number; connected: number };
export type LiveLeads = {
  generatedAt: string;
  days: LiveLeadDay[];
  status: { status: string; count: number }[];
  pool: number;
  today: LiveLeadDay;
};

const DHAKA_MS = 6 * 3600_000;
const dhakaDay = (iso: string | number) => new Date(new Date(iso).getTime() + DHAKA_MS).toISOString().slice(0, 10);

/**
 * Live lead dashboard: leads per Dhaka day (added, assigned, called), report
 * flow and the status mix. Read-only. Open to HQ/IT PIN, the LeadHub PIN and
 * signed-in team leaders — checked here on the server, not in the page.
 */
export const liveLeads = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional(), days: z.number().int().min(1).max(31).optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<LiveLeads> => {
    const token = data.adminToken ?? null;
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    let allowed = adminTokenScope(token) === "leadhub";
    if (!allowed) {
      const { resolveCaller } = await import("@/lib/access.server");
      const caller = await resolveCaller(token);
      allowed = caller.scope === "authority" ||
        (caller.scope !== "none" && caller.approval === "approved" && (caller.profile as { role?: string } | null)?.role === "team_leader");
    }
    if (!allowed) throw new Error("এই ড্যাশবোর্ড শুধু HQ, LeadHub ও টিম লিডারদের জন্য");

    const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
    const n = data.days ?? 14;
    const dayList: string[] = [];
    for (let i = n - 1; i >= 0; i--) dayList.push(dhakaDay(Date.now() - i * 86400_000));
    const sinceIso = new Date(new Date(`${dayList[0]}T00:00:00Z`).getTime() - DHAKA_MS).toISOString();

    // The database returns at most 1000 rows per request, so read in pages.
    const pageAll = async <T,>(build: (f: number, t: number) => PromiseLike<{ data: T[] | null; error: unknown }>) => {
      const out: T[] = [];
      for (let f = 0; f < 100_000; f += 1000) {
        const { data: rows, error } = await build(f, f + 999);
        if (error) throw new Error("লিড ডেটা লোড হয়নি");
        out.push(...(rows ?? []));
        if (!rows || rows.length < 1000) break;
      }
      return out;
    };

    const [added, assigned, reports, statusCounts, pool] = await Promise.all([
      pageAll<{ created_at: string }>((f, t) => db.from("leads").select("created_at").gte("created_at", sinceIso).order("id").range(f, t)),
      pageAll<{ work_date: string | null }>((f, t) =>
        db.from("leads").select("work_date").gte("work_date", dayList[0]).not("assigned_agent_id", "is", null).order("id").range(f, t),
      ),
      pageAll<{ created_at: string; lead_id: string | null; connected: boolean | null }>((f, t) =>
        db.from("call_reports").select("created_at, lead_id, connected").gte("created_at", sinceIso).order("id").range(f, t),
      ),
      Promise.all(
        (["pending", "contacted", "follow_up", "closed"] as const).map(async (s) => {
          const { count } = await db.from("leads").select("id", { count: "exact", head: true }).eq("status", s);
          return { status: s, count: count ?? 0 };
        }),
      ),
      db.from("leads").select("id", { count: "exact", head: true }).is("assigned_agent_id", null),
    ]);

    const map = new Map(dayList.map((d) => [d, { day: d, added: 0, assigned: 0, called: 0, reports: 0, connected: 0 }]));
    for (const r of added) { const e = map.get(dhakaDay(r.created_at)); if (e) e.added++; }
    for (const r of assigned) { const e = r.work_date ? map.get(r.work_date) : undefined; if (e) e.assigned++; }
    const calledSeen = new Map<string, Set<string>>();
    for (const r of reports) {
      const d = dhakaDay(r.created_at);
      const e = map.get(d);
      if (!e) continue;
      e.reports++;
      if (r.connected) e.connected++;
      if (r.lead_id) {
        const set = calledSeen.get(d) ?? new Set<string>();
        set.add(r.lead_id);
        calledSeen.set(d, set);
      }
    }
    for (const [d, set] of calledSeen) map.get(d)!.called = set.size;
    const days = [...map.values()];
    return { generatedAt: new Date().toISOString(), days, status: statusCounts, pool: pool.count ?? 0, today: days[days.length - 1]! };
  });
