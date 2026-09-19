import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import {
  BOOKING_CATEGORY,
  DONE_FOLLOW_UP_STATES,
  OPEN_FOLLOW_UP_STATES,
  SITE_VISIT_CATEGORIES,
  dhakaDateKey,
  dhakaDayWindow,
} from "@/lib/daily-performance";
import type { FloorMetrics } from "@/lib/crm-metrics";

const Scope = z.object({ token: z.string().nullable().optional() });

/**
 * The one server computation behind every floor-level number in the CRM.
 * Conditions are documented in src/lib/crm-metrics.ts and used nowhere else.
 */
export const getFloorMetrics = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Scope.parse(input ?? {}))
  .handler(async ({ data }): Promise<FloorMetrics | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.token ?? null);
    // Floor-wide figures are for authority and coordinators; agents read their own desk.
    if (caller.scope === "none" || caller.scope === "agent") return null;

    const dateKey = dhakaDateKey();
    const { start, end } = dhakaDayWindow(dateKey);
    const nowIso = new Date().toISOString();

    const count = async (build: () => PromiseLike<{ count: number | null; error: unknown }>) => {
      const { count: n, error } = await build();
      if (error) throw new Error(String((error as { message?: string }).message ?? error));
      return n ?? 0;
    };
    const leads = () => supabaseAdmin.from("leads").select("id", { count: "exact", head: true });
    const reports = () =>
      supabaseAdmin.from("call_reports").select("id", { count: "exact", head: true });
    const followUps = () =>
      supabaseAdmin.from("follow_up_events").select("id", { count: "exact", head: true });

    const [
      totalLeads,
      contactedByAttempts,
      contactedByLastCall,
      pendingLeads,
      hotLeads,
      warmLeads,
      coldLeads,
      assignedLeads,
      closedWon,
      callAttempts,
      connectedCalls,
      attemptsToday,
      connectedToday,
      followUpDue,
      followUpOverdue,
      visitsCompleted,
      recordingSync,
    ] = await Promise.all([
      count(() => leads()),
      count(() => leads().gt("call_attempts", 0)),
      count(() => leads().not("last_call_at", "is", null)),
      count(() => leads().neq("work_state", "completed")),
      count(() => leads().eq("temperature", "hot")),
      count(() => leads().eq("temperature", "warm")),
      count(() => leads().eq("temperature", "cold")),
      count(() => leads().not("assigned_to", "is", null)),
      count(() => leads().eq("status", "closed").eq("outcome_category", "deal_won")),
      count(() => reports().eq("status", "submitted")),
      count(() => reports().eq("status", "submitted").eq("connected", true)),
      count(() =>
        followUps()
          .in("status", OPEN_FOLLOW_UP_STATES)
          .gte("scheduled_at", start)
          .lt("scheduled_at", end),
      ),
      count(() =>
        followUps().in("status", OPEN_FOLLOW_UP_STATES).lt("scheduled_at", nowIso),
      ),
      count(() =>
        followUps().in("status", DONE_FOLLOW_UP_STATES).in("category", SITE_VISIT_CATEGORIES),
      ),
      count(() =>
        supabaseAdmin.from("call_recordings").select("id", { count: "exact", head: true }),
      ),
    ]);

    // "contacted" is a lead-shaped metric, so it must not double count a lead that
    // has both an attempt counter and a last-call stamp: ask the OR condition once.
    const contactedLeads = await count(() =>
      leads().or("call_attempts.gt.0,last_call_at.not.is.null"),
    );

    // Trend + per-agent board come from submitted reports, paged so the 1000-row
    // Data API cap can never silently truncate the floor.
    const windowStart = dhakaDayWindow(
      dhakaDateKey(new Date(Date.now() - 13 * 86_400_000)),
    ).start;
    const page = 1000;
    const rows: {
      lead_id: string | null;
      agent_id: string | null;
      connected: boolean | null;
      category: string | null;
      call_ended_at: string | null;
      submitted_at: string | null;
    }[] = [];
    for (let from = 0; from < 40_000; from += page) {
      const chunk = await supabaseAdmin
        .from("call_reports")
        .select("lead_id, agent_id, connected, category, call_ended_at, submitted_at")
        .eq("status", "submitted")
        .order("submitted_at", { ascending: false })
        .range(from, from + page - 1);
      if (chunk.error) throw new Error(chunk.error.message);
      rows.push(...(chunk.data ?? []));
      if ((chunk.data ?? []).length < page) break;
    }

    const byDay = new Map<string, { attempts: number; connected: number }>();
    for (let i = 13; i >= 0; i -= 1) {
      byDay.set(dhakaDateKey(new Date(Date.now() - i * 86_400_000)), {
        attempts: 0,
        connected: 0,
      });
    }
    const agentAgg = new Map<
      string,
      { attempts: number; connected: number; bookingLeads: Set<string> }
    >();
    for (const row of rows) {
      const at = row.call_ended_at ?? row.submitted_at;
      if (at && at >= windowStart) {
        const key = dhakaDateKey(new Date(at));
        const bucket = byDay.get(key);
        if (bucket) {
          bucket.attempts += 1;
          if (row.connected) bucket.connected += 1;
        }
      }
      if (!row.agent_id) continue;
      const agg =
        agentAgg.get(row.agent_id) ??
        { attempts: 0, connected: 0, bookingLeads: new Set<string>() };
      agg.attempts += 1;
      if (row.connected) agg.connected += 1;
      if (row.category === BOOKING_CATEGORY && row.lead_id) agg.bookingLeads.add(row.lead_id);
      agentAgg.set(row.agent_id, agg);
    }

    const profiles = await supabaseAdmin.from("profiles").select("id, name, employee_id");
    if (profiles.error) throw new Error(profiles.error.message);
    const nameOf = new Map((profiles.data ?? []).map((p) => [p.id, p]));

    const agents = [...agentAgg.entries()]
      .map(([agentId, agg]) => ({
        agentId,
        name: nameOf.get(agentId)?.name ?? "অজানা",
        employeeId: nameOf.get(agentId)?.employee_id ?? null,
        attempts: agg.attempts,
        connected: agg.connected,
        bookings: agg.bookingLeads.size,
      }))
      .sort((a, b) => b.connected - a.connected || b.attempts - a.attempts);

    return {
      dateKey,
      timeZone: "Asia/Dhaka",
      generatedAt: nowIso,
      totalLeads,
      newLeads: Math.max(0, pendingLeads - Math.max(contactedByAttempts, contactedByLastCall)),
      contactedLeads,
      pendingLeads,
      qualifiedLeads: hotLeads + warmLeads,
      hotLeads,
      warmLeads,
      coldLeads,
      assignedLeads,
      unassignedLeads: Math.max(0, totalLeads - assignedLeads),
      closedWon,
      callAttempts,
      connectedCalls,
      attemptsToday,
      connectedToday,
      followUpDue,
      followUpOverdue,
      visitsCompleted,
      recordingSync,
      trend: [...byDay.entries()].map(([key, v]) => ({ dateKey: key, ...v })),
      agents,
    };
  });
