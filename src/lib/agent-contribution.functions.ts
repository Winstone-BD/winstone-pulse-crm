import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** 5:20 PM Dhaka end-of-day contribution report (server-checked). */
export const CONTRIBUTION_START_MINUTE = 17 * 60 + 20;
export const CONTRIBUTION_MAX_SENTENCES = 5;
export const CONTRIBUTION_MAX_WORDS = 120;
export const CONTRIBUTION_MIN_WORDS = 10;

export function countSentences(text: string) {
  return text.split(/[.!?।]+/).map((s) => s.trim()).filter(Boolean).length;
}
export function countWords(text: string) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
export function contributionError(text: string): string | null {
  const w = countWords(text);
  const s = countSentences(text);
  if (w < CONTRIBUTION_MIN_WORDS) return `কমপক্ষে ${CONTRIBUTION_MIN_WORDS}টি শব্দ লিখুন`;
  if (w > CONTRIBUTION_MAX_WORDS) return `সর্বোচ্চ ${CONTRIBUTION_MAX_WORDS}টি শব্দ`;
  if (s > CONTRIBUTION_MAX_SENTENCES) return `সর্বোচ্চ ${CONTRIBUTION_MAX_SENTENCES}টি বাক্য`;
  return null;
}

const Input = z.object({ adminToken: z.string().nullable().optional() });

async function me(adminToken?: string | null) {
  const { resolveCaller } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken ?? null);
  return caller.scope === "agent" && caller.profile ? caller.profile : null;
}

async function clock() {
  const { dhakaBriefingClock } = await import("@/lib/agent-briefing.server");
  const c = dhakaBriefingClock();
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Dhaka", weekday: "short" }).format(new Date());
  return { ...c, friday: weekday === "Fri" };
}

export const getMyContributionStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const profile = await me(data.adminToken);
    const c = await clock();
    const none = { required: false, kind: "daily" as const, businessDate: c.businessDate };
    if (!profile || c.friday || c.minuteOfDay < CONTRIBUTION_START_MINUTE) return none;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("agent_daily_contributions")
      .select("business_date,kind")
      .eq("agent_id", profile.id);
    if (error) throw new Error(error.message);
    const doneToday = (rows ?? []).some((r) => r.business_date === c.businessDate);
    const hasSinceJoining = (rows ?? []).some((r) => r.kind === "since_joining");
    return {
      required: !doneToday,
      kind: hasSinceJoining ? ("daily" as const) : ("since_joining" as const),
      businessDate: c.businessDate,
    };
  });

export const submitMyContribution = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.extend({ summary: z.string().max(1500) }).parse(i))
  .handler(async ({ data }) => {
    const profile = await me(data.adminToken);
    if (!profile) throw new Error("Agent account required");
    const summary = data.summary.trim();
    const err = contributionError(summary);
    if (err) throw new Error(err);
    const c = await clock();
    if (c.minuteOfDay < CONTRIBUTION_START_MINUTE) throw new Error("রিপোর্ট ৫:২০-এর পর জমা দেওয়া যাবে");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("agent_daily_contributions")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", profile.id)
      .eq("kind", "since_joining");
    const { error } = await supabaseAdmin.from("agent_daily_contributions").insert({
      agent_id: profile.id,
      business_date: c.businessDate,
      kind: count ? "daily" : "since_joining",
      summary,
    });
    if (error && !error.message.includes("duplicate")) throw new Error(error.message);
    return { required: false, kind: "daily" as const, businessDate: c.businessDate };
  });

// ---------------------------------------------------------------------------
// HQ/IT review of contribution reports (server-only tables, authority scope).

const ListInput = z.object({
  adminToken: z.string().nullable().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  agentId: z.string().uuid().nullable().optional(),
  kind: z.enum(["since_joining", "daily"]).nullable().optional(),
});

async function authority(adminToken?: string | null) {
  const { resolveCaller } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken ?? null);
  if (caller.scope !== "authority") throw new Error("HQ/IT access required");
  return caller;
}

export const listContributionReports = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ListInput.parse(i))
  .handler(async ({ data }) => {
    await authority(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("agent_daily_contributions")
      .select("id,agent_id,business_date,kind,summary,created_at")
      .gte("business_date", data.from)
      .lte("business_date", data.to)
      .order("business_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(2000);
    if (data.agentId) q = q.eq("agent_id", data.agentId);
    if (data.kind) q = q.eq("kind", data.kind);
    const [{ data: rows, error }, { data: agents, error: aErr }] = await Promise.all([
      q,
      supabaseAdmin
        .from("profiles")
        .select("id,name,employee_id,role,approval_status,is_active")
        .in("role", ["agent", "team_leader"]),
    ]);
    if (error) throw new Error(error.message);
    if (aErr) throw new Error(aErr.message);
    const ids = (rows ?? []).map((r) => r.id);
    const { data: reviews, error: rErr } = ids.length
      ? await supabaseAdmin
          .from("agent_contribution_reviews")
          .select("id,report_id,reviewer,note,created_at")
          .in("report_id", ids)
          .order("created_at", { ascending: false })
      : { data: [], error: null };
    if (rErr) throw new Error(rErr.message);

    // Expected today: active, approved agents once 5:20 PM Dhaka has passed on a business day.
    const c = await clock();
    const active = (agents ?? []).filter((a) => a.is_active && a.approval_status === "approved");
    const { data: todayRows } = await supabaseAdmin
      .from("agent_daily_contributions")
      .select("agent_id")
      .eq("business_date", c.businessDate);
    const submittedToday = new Set((todayRows ?? []).map((r) => r.agent_id));
    const dueNow = !c.friday && c.minuteOfDay >= CONTRIBUTION_START_MINUTE;
    return {
      agents: (agents ?? []).map((a) => ({ id: a.id, name: a.name, employeeId: a.employee_id })),
      reports: (rows ?? []).map((r) => ({
        ...r,
        words: countWords(r.summary),
        sentences: countSentences(r.summary),
        withinLimit: !contributionError(r.summary),
        reviews: (reviews ?? []).filter((v) => v.report_id === r.id),
      })),
      today: {
        businessDate: c.businessDate,
        friday: c.friday,
        dueNow,
        expected: dueNow ? active.length : 0,
        submitted: active.filter((a) => submittedToday.has(a.id)).length,
        missing: dueNow ? active.filter((a) => !submittedToday.has(a.id)).map((a) => a.name) : [],
      },
    };
  });

export const reviewContributionReport = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        adminToken: z.string().nullable().optional(),
        reportId: z.string().uuid(),
        note: z.string().trim().max(500).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const caller = await authority(data.adminToken);
    const reviewer = caller.profile?.name ?? caller.label ?? (caller.readOnly ? "Executive HQ" : "IT Console");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("agent_contribution_reviews").insert({
      report_id: data.reportId,
      reviewer,
      note: data.note ? data.note : null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
