import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Workday allocation readouts for the web CRM.
 *
 * Both calls return the SAME server-computed state the Android app receives, so
 * a number shown on a phone and the number shown on the web always match. An
 * agent sees their own row; a coordinator, Executive HQ and the IT Console see
 * the whole floor.
 */
const Base = z.object({ adminToken: z.string().nullable().optional() });
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "তারিখ ঠিক নয়");

/**
 * Resolves the caller. Returns null instead of throwing when there is no
 * signed-in session yet (first paint / session still hydrating), so these
 * read-only panels quietly render nothing rather than crashing the page.
 */
async function callerOf(adminToken: string | null) {
  const { resolveCaller } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken);
  if (caller.scope === "none" || !caller.profile) return null;
  return caller;
}


/** This desk's own workday allocation state — carried over, new, excess, gap. */
export const myAllocationStatus = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.extend({ workDate: DATE.optional() }).parse(input))
  .handler(async ({ data }) => {
    const caller = await callerOf(data.adminToken ?? null);
    if (!caller) return null;
    const me = caller.profile!;

    const { dhakaToday } = await import("@/lib/lead-pool.server");
    const { floorAllocationStatus } = await import("@/lib/workday-allocation.server");
    const workDate = data.workDate ?? dhakaToday();
    const status = await floorAllocationStatus(workDate);
    return {
      workDate: status.workDate,
      special: status.special,
      poolAvailable: status.poolAvailable,
      shortage: status.shortage,
      me: status.agents.find((row) => row.agentId === me.id) ?? null,
    };
  });

/** The whole floor — coordinator, Executive HQ and IT Console only. */
export const floorAllocation = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.extend({ workDate: DATE.optional() }).parse(input))
  .handler(async ({ data }) => {
    const caller = await callerOf(data.adminToken ?? null);
    if (!caller) return null;
    if (caller.scope === "agent") throw new Error("এই তথ্য দেখার অনুমতি নেই");

    const { dhakaToday } = await import("@/lib/lead-pool.server");
    const { floorAllocationStatus } = await import("@/lib/workday-allocation.server");
    return floorAllocationStatus(data.workDate ?? dhakaToday());
  });

/**
 * This desk's own day of real work — attempts, connections, qualified leads,
 * follow-ups, visits and bookings — from the same server calculation the
 * Android app and Executive HQ read.
 */
export const myDailyPerformance = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.extend({ dateKey: DATE.optional() }).parse(input))
  .handler(async ({ data }) => {
    const caller = await callerOf(data.adminToken ?? null);
    const { agentDailyPerformance } = await import("@/lib/daily-performance.server");
    const { dhakaDateKey } = await import("@/lib/daily-performance");
    return agentDailyPerformance(caller.profile!.id, data.dateKey ?? dhakaDateKey());
  });

/** The whole floor's day — coordinator, Executive HQ and IT Console only. */
export const floorDailyPerformance = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.extend({ dateKey: DATE.optional() }).parse(input))
  .handler(async ({ data }) => {
    const caller = await callerOf(data.adminToken ?? null);
    if (caller.scope === "agent") throw new Error("এই তথ্য দেখার অনুমতি নেই");
    const { dailyPerformanceBoard } = await import("@/lib/daily-performance.server");
    const { dhakaDateKey } = await import("@/lib/daily-performance");
    const board = await dailyPerformanceBoard(data.dateKey ?? dhakaDateKey());
    // The allocation detail is available through floorAllocation; keep this
    // response focused on performance so the two cannot drift.
    const { allocation, ...rest } = board;
    return { ...rest, poolAvailable: allocation.poolAvailable, poolShortage: allocation.shortage };
  });
