/**
 * "Did not receive" cadence (Asia/Dhaka, UTC+6, no DST). Pure rules shared by
 * the call-report form and the server, so both always agree.
 *
 *   attempt 1 → snooze (default +2 days)
 *   attempt 2 → snooze (default +3 days) + a soft message draft
 *   attempt 3 → Unresponsive Pool, back in the Reactivation Queue after 7 days
 *
 * Office days are Saturday–Thursday; Friday, configured holidays and closed
 * days move a slot to the next open day at the same time.
 */
import { dhakaDateOf, isFriday } from "@/lib/business-day";

export type RetrySlot = "morning" | "afternoon" | "evening" | "custom";
export type RetryMode = "plus2" | "plus3" | "custom";
export type RetryPlanInput = { mode: RetryMode; slot: RetrySlot; time?: string | null | undefined; customAt?: string | null | undefined };
export type CadenceStage = "snooze" | "snooze_soft" | "unresponsive";

export const SLOT_TIME: Record<Exclude<RetrySlot, "custom">, string> = {
  morning: "10:30",
  afternoon: "15:00",
  evening: "18:00",
};
export const REACTIVATION_DAYS = 7;
export const PARKED_STATES = ["snoozed", "unresponsive"] as const;
const DHAKA_MS = 6 * 3_600_000;

function shiftDay(day: string, delta: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function isOfficeOpen(day: string, holidays: readonly string[] = []) {
  return !isFriday(day) && !holidays.includes(day);
}

/** ISO instant for a Dhaka calendar day + HH:MM. */
export function dhakaSlotIso(day: string, hhmm: string) {
  return new Date(Date.parse(`${day}T${hhmm}:00Z`) - DHAKA_MS).toISOString();
}

function dhakaHhmm(iso: string) {
  return new Date(Date.parse(iso) + DHAKA_MS).toISOString().slice(11, 16);
}

/** Moves an instant off Friday / holidays to the next open day, same time. */
export function nextOpenSlot(iso: string, holidays: readonly string[] = []) {
  let day = dhakaDateOf(Date.parse(iso));
  const time = dhakaHhmm(iso);
  let moved = false;
  for (let i = 0; i < 30 && !isOfficeOpen(day, holidays); i++) {
    day = shiftDay(day, 1);
    moved = true;
  }
  return { at: moved ? dhakaSlotIso(day, time) : iso, moved };
}

export function stageForAttempt(attempt: number): CadenceStage {
  return attempt <= 1 ? "snooze" : attempt === 2 ? "snooze_soft" : "unresponsive";
}

export class RetryPlanError extends Error {}

/**
 * Next contact time for a missed call. `attempt` is the count INCLUDING this
 * call. Past custom times are refused; closed days move forward.
 */
export function planNoAnswer(
  attempt: number,
  plan: RetryPlanInput | null,
  now = Date.now(),
  holidays: readonly string[] = [],
): { attempt: number; stage: CadenceStage; retryAt: string; moved: boolean } {
  const stage = stageForAttempt(attempt);
  const today = dhakaDateOf(now);
  let raw: string;
  if (stage === "unresponsive") {
    raw = dhakaSlotIso(shiftDay(today, REACTIVATION_DAYS), SLOT_TIME.morning);
  } else if (plan?.mode === "custom") {
    if (!plan.customAt || Number.isNaN(Date.parse(plan.customAt))) {
      throw new RetryPlanError("Pick a custom date and time");
    }
    raw = new Date(plan.customAt).toISOString();
  } else {
    const days = plan?.mode === "plus3" ? 3 : plan?.mode === "plus2" ? 2 : stage === "snooze" ? 2 : 3;
    const slot = plan?.slot ?? "morning";
    const time =
      slot === "custom" ? (/^\d{2}:\d{2}$/.test(plan?.time ?? "") ? plan!.time! : SLOT_TIME.morning) : SLOT_TIME[slot];
    raw = dhakaSlotIso(shiftDay(today, days), time);
  }
  if (Date.parse(raw) <= now) throw new RetryPlanError("The follow-up time cannot be in the past");
  const { at, moved } = nextOpenSlot(raw, holidays);
  return { attempt, stage, retryAt: at, moved };
}

/** Snoozed / unresponsive and not yet due — stays off the dial list. */
export function isParked(
  lead: { work_state?: string | null; retry_after?: string | null },
  now = Date.now(),
) {
  if (!PARKED_STATES.includes((lead.work_state ?? "") as (typeof PARKED_STATES)[number])) return false;
  return !lead.retry_after || Date.parse(lead.retry_after) > now;
}

/** Soft, review-before-send message for the 2nd missed call. Nothing invented. */
export function softMessageDraft(name: string | null | undefined, lang: "bn" | "en" = "en") {
  const who = (name ?? "").trim();
  return lang === "bn"
    ? `আসসালামু আলাইকুম${who ? ` ${who}` : ""}, Winstone Properties থেকে বলছি। আপনাকে ফোনে পাইনি — সুবিধামতো সময়ে একটু জানালে কল করব। ধন্যবাদ।`
    : `Hello${who ? ` ${who}` : ""}, this is Winstone Properties. We couldn't reach you by phone — please let us know a convenient time and we'll call. Thank you.`;
}
