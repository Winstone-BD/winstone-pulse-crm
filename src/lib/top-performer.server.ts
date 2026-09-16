/**
 * Daily best performer, computed only from what the agents themselves submitted
 * today (their own call reports and follow-ups). Nothing is invented: if there
 * is no activity, there is no winner.
 *
 * The board is revealed on the homepage at 5:30 pm Dhaka — the same minute the
 * evening shift summary is generated — so the day is actually finished first.
 */
import { dhakaInstant, dhakaParts } from "@/lib/shift.server";

/** Dhaka minute-of-day when the homepage reveals the winner (5:30 pm). */
export const REVEAL_MINUTES = 17 * 60 + 30;

export type PerformerLine = {
  agentId: string;
  name: string;
  called: number;
  connected: number;
  reports: number;
  followUps: number;
  talkMinutes: number;
  connectRate: number;
  score: number;
};

export type TopPerformerBoard = {
  dateKey: string;
  /** False before 5:30 pm Dhaka — the homepage then shows a countdown instead. */
  revealed: boolean;
  revealAt: string;
  winner: PerformerLine | null;
  runnerUp: PerformerLine | null;
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
function scoreOf(line: Omit<PerformerLine, "score" | "connectRate">): number {
  return line.connected * 4 + line.reports * 2 + line.followUps * 1.5 + line.talkMinutes * 0.4;
}

export async function dailyTopPerformer(at: Date = new Date()): Promise<TopPerformerBoard> {
  const { dateKey, minutes } = dhakaParts(at);
  const revealAt = dhakaInstant(dateKey, REVEAL_MINUTES);
  const startIso = dhakaInstant(dateKey, 0).toISOString();
  const endIso = at.toISOString();

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [agentsRes, reportsRes, followRes] = await Promise.all([
    supabaseAdmin
      .from("profiles")
      .select("id, name")
      .eq("approval_status", "approved")
      .eq("is_active", true)
      .eq("role", "agent"),
    supabaseAdmin
      .from("call_reports")
      .select("agent_id, status, connected, duration_seconds, created_at")
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

  const reports = reportsRes.data ?? [];
  const follows = followRes.data ?? [];

  const lines: PerformerLine[] = (agentsRes.data ?? []).map((agent) => {
    const mine = reports.filter((r) => r.agent_id === agent.id);
    const connected = mine.filter((r) => r.connected).length;
    const talkMinutes = Math.round(
      mine.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0) / 60,
    );
    const base = {
      agentId: agent.id,
      name: agent.name,
      called: mine.length,
      connected,
      reports: mine.filter((r) => r.status === "submitted").length,
      followUps: follows.filter((f) => f.agent_id === agent.id).length,
      talkMinutes,
    };
    return {
      ...base,
      connectRate: base.called ? Math.round((connected / base.called) * 100) : 0,
      score: Math.round(scoreOf(base)),
    };
  });

  const ranked = lines.filter((l) => l.score > 0).sort((a, b) => b.score - a.score);
  const winner = ranked[0] ?? null;
  const runnerUp = ranked[1] ?? null;

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

  return {
    dateKey,
    revealed: minutes >= REVEAL_MINUTES,
    revealAt: revealAt.toISOString(),
    winner,
    runnerUp,
    reasons,
    advice,
    team,
  };
}
