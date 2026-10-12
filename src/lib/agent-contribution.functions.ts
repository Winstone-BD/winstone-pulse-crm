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
