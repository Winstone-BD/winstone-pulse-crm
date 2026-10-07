/**
 * Daily best performer, computed only from what the agents themselves submitted
 * today (their own call reports and follow-ups). Nothing is invented: if there
 * is no activity, there is no winner.
 *
 * The board is revealed on the homepage at 5:30 pm Dhaka — the same minute the
 * evening shift summary is generated — so the day is actually finished first.
 */
import { dhakaInstant, dhakaParts } from "@/lib/shift.server";

/** Pure ranking used by the daily board: highest displayed score ranks first. */
export function rankPerformers(lines: PerformerLine[]): PerformerLine[] {
  return [...lines].sort(
    (a, b) =>
      // The board sorts by the score everyone sees on the card — biggest first.
      b.score - a.score ||
      // Fixed tie-breakers for equal scores: calls → reports → talk minutes,
      // then agent id so the order never flips between refreshes.
      b.called - a.called ||
      b.reports - a.reports ||
      b.talkMinutes - a.talkMinutes ||
      (a.agentId < b.agentId ? -1 : a.agentId > b.agentId ? 1 : 0),
  );
}


/** Dhaka minute-of-day when the homepage reveals the winner (5:30 pm). */
export const REVEAL_MINUTES = 17 * 60 + 30;

/** Dhaka minute-of-day when the homepage switches to the new working day (9:05 am). */
export const NEW_DAY_MINUTES = 9 * 60 + 5;

export type PerformerLine = {
  agentId: string;
  name: string;
  /** Signed staff-photo link for the public board; null when no photo exists. */
  photoUrl: string | null;
  called: number;
  connected: number;
  reports: number;
  followUps: number;
  talkMinutes: number;
  connectRate: number;
  score: number;
  /** This desk's own daily lead quota (25 by default, 15 for the Sell Team Admin). */
  quota: number;
  /** Base quota plus extra leads granted today — the day's real target. */
  targetQuota: number;
  /** Leads handed to this desk today. */
  assigned: number;
  /** Leads this desk finished today (classified + completed). */
  completed: number;
  /** completed ÷ own quota × 100 — 15/15 and 25/25 are both 100%. */
  completionPercent: number;
  /** Quota-normalised score — how the same effort looks on a standard round. */
  fairScore: number;
};

export type RankedPerformer = PerformerLine & {
  rank: number;
  gapFromLeader: number;
  breakdown: ScorePart[];
  reason: string;
  gap: string;
  advice: string;
};

/**
 * Exactly which rows went into the score — shown in the homepage insight panel
 * so anyone can check the board against the raw data instead of trusting it.
 */
export type TopPerformerSources = {
  /** Dhaka wall-clock window used for call reports and follow-ups. */
  windowStart: string;
  windowEnd: string;
  /** leads.work_date value used for the quota/completion side. */
  workDate: string;
  timeZone: "Asia/Dhaka";
  activeAgents: number;
  callReportRows: number;
  submittedReportRows: number;
  connectedReportRows: number;
  followUpRows: number;
  assignedLeadRows: number;
  completedLeadRows: number;
  talkMinutes: number;
  /** True when nothing at all was counted — the reason a score can be 0. */
  empty: boolean;
};

export type TopPerformerBoard = {
  dateKey: string;
  /** When the board next changes: the 5:30 pm reveal, or the 9:05 am rollover. */
  nextUpdateAt: string;
  /** What happens at nextUpdateAt. */
  nextUpdateKind: "reveal" | "rollover";
  sources: TopPerformerSources;
  /** False before 5:30 pm Dhaka — the homepage then shows a countdown instead. */
  revealed: boolean;
  revealAt: string;
  /** True when the board is still showing the previous working day (midnight → 9:05 am). */
  isPreviousDay: boolean;
  /** Bengali label the UI can use directly: "আজকের" or "গতকের". */
  dayLabel: "আজকের" | "গতকের";
  winner: PerformerLine | null;
  runnerUp: PerformerLine | null;
  topThree: RankedPerformer[];
  otherAgents: RankedPerformer[];
  /** Plain-Bengali lines explaining why this agent won. */
  reasons: string[];
  /** What the whole floor should push on tomorrow, from the same numbers. */
  advice: string[];
  team: { called: number; connected: number; reports: number; talkMinutes: number };
};

/**
 * Score weights: connected conversations matter most, then submitted updates,
 * then talk time and follow-ups booked. Deliberately simple so the reason lines
 * on the homepage can be read straight off the numbers.
 */
export function scoreOf(
  line: Pick<PerformerLine, "connected" | "reports" | "followUps" | "talkMinutes">,
): number {
  return line.connected * 4 + line.reports * 2 + line.followUps * 1.5 + line.talkMinutes * 0.4;
}

export type ScorePart = { label: string; count: number; weight: number; points: number };

/** How the displayed score was built — same weights as scoreOf, rounded per line. */
export function scoreBreakdown(
  line: Pick<PerformerLine, "connected" | "reports" | "followUps" | "talkMinutes">,
): ScorePart[] {
  const part = (label: string, count: number, weight: number) => ({
    label, count, weight, points: Math.round(count * weight * 10) / 10,
  });
  return [
    part("সংযোগ", line.connected, 4),
    part("রিপোর্ট", line.reports, 2),
    part("ফলো-আপ", line.followUps, 1.5),
    part("কথার মিনিট", line.talkMinutes, 0.4),
  ];
}

export function performerInsight(line: PerformerLine): Pick<RankedPerformer, "reason" | "gap" | "advice"> {
  const averageTalk = line.connected ? line.talkMinutes / line.connected : 0;
  const reportGap = Math.max(0, line.called - line.reports);

  // Completion is always shown as the person's OWN quota ratio, so a 15-lead
  // desk and a 25-lead desk read the same way.
  const quotaLine = line.targetQuota
    ? `কোটা ${line.completed}/${line.targetQuota} (${line.completionPercent}%)`
    : "কোটা নির্ধারিত হয়নি";

  const reason = line.connected
    ? `${quotaLine} · ${line.connected}টি সংযোগ · ${line.reports}টি রিপোর্ট · ${line.talkMinutes} মিনিট কথা`
    : line.called
      ? `${quotaLine} · ${line.called}টি কল করেছেন — চেষ্টা চালু ছিল`
      : line.completed
        ? quotaLine
        : "আজ এখনো যাচাইকৃত কল কার্যক্রম নেই";

  if (!line.called) {
    return {
      reason,
      gap: "আজকের কল শুরু হয়নি",
      advice: "আগামীকাল প্রথম শিফটেই নির্ধারিত কিউ থেকে কল শুরু করুন",
    };
  }
  if (line.targetQuota > 0 && line.completionPercent < 100) {
    return {
      reason,
      gap: `কোটার ${line.completionPercent}% শেষ — বাকি ${Math.max(0, line.targetQuota - line.completed)}টি`,
      advice: "নিজের তালিকার বাকি লিডগুলো শেষ করুন — র‍্যাঙ্কিং হয় দেখানো স্কোরে, বেশি স্কোর আগে",
    };
  }
  if (reportGap > 0) {
    return {
      reason,
      gap: `${reportGap}টি কল রিপোর্ট বাকি`,
      advice: "প্রতি কলের পরপরই সংক্ষিপ্ত রিপোর্ট জমা দিন",
    };
  }
  if (line.connectRate < 35) {
    return {
      reason,
      gap: `কানেক্ট হার ${line.connectRate}%`,
      advice: "দুপুর ও সন্ধ্যার ভালো সময়ে আবার চেষ্টা করুন",
    };
  }
  if (line.followUps < 5) {
    return {
      reason,
      gap: `ফলো-আপ মাত্র ${line.followUps}টি`,
      advice: "আগ্রহী কথোপকথন থেকে অন্তত ৫টি ফলো-আপ ঠিক করুন",
    };
  }
  if (line.connected > 0 && averageTalk < 2) {
    return {
      reason,
      gap: `গড় কথা ${averageTalk.toFixed(1)} মিনিট`,
      advice: "প্রয়োজন বুঝতে প্রতিটি সংযোগে আরও একটি প্রশ্ন করুন",
    };
  }
  return {
    reason,
    gap: "উল্লেখযোগ্য ঘাটতি নেই",
    advice: "এই ছন্দ ধরে রাখুন — কালও একই লক্ষ্য নিয়ে শুরু করুন",
  };
}

export type TopPerformerDate = {
  dateKey: string;
  effectiveDateKey: string;
  minutes: number;
  isPreviousDay: boolean;
  dayLabel: "আজকের" | "গতকের";
  revealed: boolean;
};

/** Pure date helper so the 9:05 am rollover can be unit-tested without the DB. */
export function topPerformerDate(at: Date = new Date()): TopPerformerDate {
  const { year, month, day, dateKey, minutes } = dhakaParts(at);
  const isPreviousDay = minutes < NEW_DAY_MINUTES;
  let effectiveDateKey = dateKey;
  if (isPreviousDay) {
    // Step back one day in Dhaka wall-clock, not one UTC day.
    const prev = new Date(Date.UTC(year, month - 1, day));
    prev.setUTCDate(prev.getUTCDate() - 1);
    effectiveDateKey = dhakaParts(prev).dateKey;
  }
  return {
    dateKey,
    effectiveDateKey,
    minutes,
    isPreviousDay,
    dayLabel: isPreviousDay ? "গতকের" : "আজকের",
    revealed: isPreviousDay || minutes >= REVEAL_MINUTES,
  };
}

export async function dailyTopPerformer(at: Date = new Date()): Promise<TopPerformerBoard> {
  const { effectiveDateKey, isPreviousDay, dayLabel, revealed } = topPerformerDate(at);
  const revealAt = dhakaInstant(effectiveDateKey, REVEAL_MINUTES);
  const startIso = dhakaInstant(effectiveDateKey, 0).toISOString();
  const endIso = isPreviousDay
    ? new Date(dhakaInstant(effectiveDateKey, 0).getTime() + 24 * 60 * 60 * 1000 - 1000).toISOString()
    : at.toISOString();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [agentsRes, reportsRes, followRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, name, employee_id, photo_path")
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .eq("role", "agent"),
    supabaseAdmin
      .from("call_reports")
      .select("agent_id, lead_id, status, connected, duration_seconds, created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
    supabaseAdmin
      .from("follow_up_events")
      .select("agent_id, created_at")
      .gte("created_at", startIso)
      .lte("created_at", endIso),
  ]);
  if (agentsRes.error) throw new Error(agentsRes.error.message);
  if (reportsRes.error) throw new Error(reportsRes.error.message);
  if (followRes.error) throw new Error(followRes.error.message);

  const { quotaFor, ratioScore, effectiveQuota, completionPercent } = await import(
    "@/lib/lead-quota"
  );
  const { dailyPlan, extraGrantsToday } = await import("@/lib/lead-pool.server");
  const floorQuota = (await dailyPlan()).perAgent;
  const extraToday = await extraGrantsToday();

  // The scored day's own list per desk: how many leads arrived and how many are finished.
  const { data: todayLeads } = await supabaseAdmin
    .from("leads")
    .select("id, assigned_to, work_state")
    .eq("work_date", effectiveDateKey)
    .not("assigned_to", "is", null)
    .limit(20000);

  const reports = reportsRes.data ?? [];
  const follows = followRes.data ?? [];

  const lines: PerformerLine[] = (agentsRes.data ?? []).map((agent) => {
    const mine = reports.filter((r) => r.agent_id === agent.id);
    const connected = mine.filter((r) => r.connected).length;
    const talkMinutes = Math.round(
      mine.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0) / 60,
    );
    const myLeads = (todayLeads ?? []).filter((row) => row.assigned_to === agent.id);
    const quota = quotaFor(agent.employee_id, floorQuota);
    const targetQuota = effectiveQuota(quota, extraToday[agent.id] ?? 0);
    // A lead counts as worked once it is completed OR has a call report today.
    const reportedIds = new Set(mine.map((r) => r.lead_id).filter(Boolean));
    const completed = myLeads.filter((row) => row.work_state === "completed" || reportedIds.has(row.id)).length;
    const base = {
      agentId: agent.id,
      name: agent.name,
      photoUrl: null as string | null,
      called: mine.length,
      connected,
      reports: mine.filter((r) => r.status === "submitted").length,
      followUps: follows.filter((f) => f.agent_id === agent.id).length,
      talkMinutes,
      assigned: myLeads.length,
      completed,
      quota,
      targetQuota,
      completionPercent: completionPercent(completed, targetQuota),
    };
    const score = Math.round(scoreOf(base));
    return {
      ...base,
      connectRate: base.called ? Math.round((connected / base.called) * 100) : 0,
      score,
      // Ranking runs on the ratio, so a 15-lead desk competes fairly with a 25-lead desk.
      fairScore: ratioScore(score, quota),
    };
  });

  const ranked = rankPerformers(lines);
  const isActive = (line: PerformerLine) => line.score > 0 || line.completed > 0;
  const activeRanked = ranked.filter(isActive);
  const leaderScore = activeRanked[0]?.score ?? 0;
  const detailed = ranked.map((line, index): RankedPerformer => ({
    ...line,
    rank: index + 1,
    // Gap is expressed in the same score everyone is ranked on.
    gapFromLeader: Math.max(0, leaderScore - line.score),
    breakdown: scoreBreakdown(line),
    ...performerInsight(line),
  }));
  // Top 3 eligibility: more than 30% of today's assigned leads still pending excludes the desk.
  const TOP3_MAX_PENDING = 30;
  const pendingPct = (l: PerformerLine) => (l.assigned ? ((l.assigned - l.completed) / l.assigned) * 100 : 0);
  const topThree = detailed.filter((l) => isActive(l) && pendingPct(l) <= TOP3_MAX_PENDING).slice(0, 3);
  for (const l of detailed) if (isActive(l) && pendingPct(l) > TOP3_MAX_PENDING) l.gap = `পেন্ডিং ${Math.round(pendingPct(l))}% (৩০%-এর বেশি) — তাই আজ Top 3-এর বাইরে`;
  const topIds = new Set(topThree.map((line) => line.agentId));
  const otherAgents = detailed.filter((line) => !topIds.has(line.agentId));
  const winner = topThree[0] ?? null;
  const runnerUp = topThree[1] ?? null;

  const team = lines.reduce(
    (acc, l) => ({
      called: acc.called + l.called,
      connected: acc.connected + l.connected,
      reports: acc.reports + l.reports,
      talkMinutes: acc.talkMinutes + l.talkMinutes,
    }),
    { called: 0, connected: 0, reports: 0, talkMinutes: 0 },
  );

  const reasons: string[] = [];
  const advice: string[] = [];

  if (winner) {
    if (winner.targetQuota)
      reasons.push(
        `নিজের কোটার ${winner.completionPercent}% শেষ (${winner.completed}/${winner.targetQuota})`,
      );
    reasons.push(`${winner.connected}টি কলে কথা হয়েছে — আজ সবচেয়ে বেশি`);
    if (winner.reports) reasons.push(`${winner.reports}টি কল রিপোর্ট নিজে জমা দিয়েছেন`);
    if (winner.talkMinutes) reasons.push(`মোট ${winner.talkMinutes} মিনিট কথা বলেছেন`);
    if (winner.followUps) reasons.push(`${winner.followUps}টি ফলো-আপ সময়সহ বসিয়েছেন`);
    if (winner.called) reasons.push(`কানেক্ট হার ${winner.connectRate}% (${winner.called}টি কলে)`);
    if (runnerUp)
      reasons.push(
        `দ্বিতীয় স্থানে ${runnerUp.name} — ${runnerUp.connected}টি কথা, স্কোর ${runnerUp.score}`,
      );

    // Advice comes from the winner's own weakest metric, so it is never generic.
    if (winner.connectRate < 35)
      advice.push("কানেক্ট হার ৩৫%-এর নিচে — কল করার সময় বদলে দুপুর ও সন্ধ্যায় চেষ্টা করুন");
    if (winner.reports < winner.called)
      advice.push(
        `${winner.called - winner.reports}টি কলের রিপোর্ট বাকি — কল শেষেই রিপোর্ট জমা দিলে স্কোর বাড়বে`,
      );
    if (winner.followUps < 5)
      advice.push("প্রতিদিন কমপক্ষে ৫টি ফলো-আপ বসালে পরের দিনের কিউ শক্ত হয়");
    if (winner.talkMinutes && winner.connected && winner.talkMinutes / winner.connected < 2)
      advice.push("গড় কথা ২ মিনিটের কম — প্রয়োজন বুঝে অন্তত ২-৩ মিনিট কথা চালিয়ে যান");
    if (!advice.length) advice.push("এই ছন্দ ধরে রাখুন — কালও একই লক্ষ্য নিয়ে শুরু করুন");
  } else {
    advice.push("আজ কোনো কল রিপোর্ট জমা পড়েনি — কল শেষে রিপোর্ট জমা দিলেই বোর্ড তৈরি হবে");
  }

  const assignedLeadRows = (todayLeads ?? []).length;
  const completedLeadRows = (todayLeads ?? []).filter((row) => row.work_state === "completed").length;
  const sources: TopPerformerSources = {
    windowStart: startIso,
    windowEnd: endIso,
    workDate: effectiveDateKey,
    timeZone: "Asia/Dhaka",
    activeAgents: lines.length,
    callReportRows: reports.length,
    submittedReportRows: reports.filter((r) => r.status === "submitted").length,
    connectedReportRows: reports.filter((r) => r.connected).length,
    followUpRows: follows.length,
    assignedLeadRows,
    completedLeadRows,
    talkMinutes: team.talkMinutes,
    empty: reports.length === 0 && follows.length === 0 && completedLeadRows === 0,
  };

  // The board next changes either at today's 5:30 pm reveal, or — once that has
  // passed — at the 9:05 am rollover of the following Dhaka day.
  const { minutes } = dhakaParts(at);
  const beforeRollover = isPreviousDay;
  const beforeReveal = !beforeRollover && minutes < REVEAL_MINUTES;
  const nextUpdate = beforeReveal
    ? { at: revealAt, kind: "reveal" as const }
    : {
        at: beforeRollover
          ? dhakaInstant(dhakaParts(at).dateKey, NEW_DAY_MINUTES)
          : dhakaInstant(
              dhakaParts(new Date(at.getTime() + 24 * 60 * 60 * 1000)).dateKey,
              NEW_DAY_MINUTES,
            ),
        kind: "rollover" as const,
      };

  return {
    dateKey: effectiveDateKey,
    nextUpdateAt: nextUpdate.at.toISOString(),
    nextUpdateKind: nextUpdate.kind,
    sources,
    revealed,
    revealAt: revealAt.toISOString(),
    isPreviousDay,
    dayLabel,
    winner,
    runnerUp,
    topThree,
    otherAgents,
    reasons,
    advice,
    team,
  };
}
