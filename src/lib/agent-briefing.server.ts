export const AGENT_BRIEFING_POLICY_VERSION = "2026-09-30-v1";
export const AGENT_BRIEFING_START_MINUTE = 9 * 60 + 5;

export type AgentBriefingStatus = {
  required: boolean;
  acknowledged: boolean;
  businessDate: string;
  policyVersion: string;
  title: string;
  detail: string;
};

export function dhakaBriefingClock(now: Date | number = Date.now()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const businessDate = `${value("year")}-${value("month")}-${value("day")}`;
  const minuteOfDay = Number(value("hour")) * 60 + Number(value("minute"));
  return { businessDate, minuteOfDay };
}

export function briefingRequiredAt(now: Date | number = Date.now()) {
  return dhakaBriefingClock(now).minuteOfDay >= AGENT_BRIEFING_START_MINUTE;
}

export async function agentBriefingStatus(
  agentId: string,
  now: Date | number = Date.now(),
): Promise<AgentBriefingStatus> {
  const { businessDate } = dhakaBriefingClock(now);
  const required = briefingRequiredAt(now);
  let acknowledged = !required;
  if (required) {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("agent_briefing_acknowledgements")
      .select("id")
      .eq("agent_id", agentId)
      .eq("business_date", businessDate)
      .eq("policy_version", AGENT_BRIEFING_POLICY_VERSION)
      .maybeSingle();
    if (error) throw new Error(`Briefing status failed: ${error.message}`);
    acknowledged = Boolean(data);
  }
  return {
    required,
    acknowledged,
    businessDate,
    policyVersion: AGENT_BRIEFING_POLICY_VERSION,
    title: "সকাল ৯:০৫-এর দৈনিক ব্রিফিং",
    detail:
      "আজকের কাজ শুরু করার আগে নিজের লিড, নির্ধারিত ফলো-আপ এবং বাধ্যতামূলক কল রিপোর্টের নিয়ম দেখে নিন। প্রতিটি কলের সঠিক ফলাফল ও ছয়টি মূল্যায়ন উত্তর সংরক্ষণ করুন।",
    titleEn: "9:05 AM daily briefing",
    detailEn:
      "Before starting today's work, review your leads, scheduled follow-ups and the mandatory call-report rules. Save the correct outcome and all six assessment answers for every call.",
  };
}

export async function requireAgentBriefing(agentId: string, now: Date | number = Date.now()) {
  const status = await agentBriefingStatus(agentId, now);
  if (status.required && !status.acknowledged) {
    return {
      blocked: true as const,
      reason: "সকাল ৯:০৫-এর দৈনিক ব্রিফিং স্বীকার করুন, তারপর কল শুরু করা যাবে",
      briefing: status,
    };
  }
  return null;
}

export async function acknowledgeAgentBriefing(
  agentId: string,
  source: "web" | "android",
  now: Date | number = Date.now(),
) {
  const status = await agentBriefingStatus(agentId, now);
  if (!status.required || status.acknowledged) return { ...status, acknowledged: true };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("agent_briefing_acknowledgements").insert({
    agent_id: agentId,
    business_date: status.businessDate,
    policy_version: status.policyVersion,
    source,
  });
  if (error && error.code !== "23505") throw new Error(`Briefing acknowledgement failed: ${error.message}`);
  return { ...status, acknowledged: true };
}
/** Throws for agents who have not acknowledged today's briefing (after 9:05 Dhaka). */
export async function assertAgentBriefing(agentId: string, now: Date | number = Date.now()) {
  const block = await requireAgentBriefing(agentId, now);
  if (block) throw new Error(block.reason);
}

/** Only agent sessions are gated; HQ/IT/authority callers are not agents. */
export async function assertBriefingForCaller(caller: { scope: string; profile?: { id: string } | null }) {
  if (caller.scope === "agent" && caller.profile) await assertAgentBriefing(caller.profile.id);
}
