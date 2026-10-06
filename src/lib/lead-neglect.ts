/**
 * Lead neglect rule (pure, shared). A lead held by an agent with zero work
 * (no call, report or recording) is warned once on each of the first two
 * business days after the day it was given, and recalled to the LeadHub
 * Nexus pool on the third. Friday never counts (business-day rule).
 */
import { isBusinessDay } from "@/lib/business-day";

export const NEGLECT_NOTICE_DAYS = 2;

/** Business days strictly after `assignedDay`, up to and including `today`. */
export function businessDaysSince(assignedDay: string, today: string): number {
  let count = 0;
  const d = new Date(`${assignedDay}T00:00:00Z`);
  const end = new Date(`${today}T00:00:00Z`).getTime();
  for (;;) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getTime() > end) break;
    if (isBusinessDay(d.toISOString().slice(0, 10))) count += 1;
  }
  return count;
}

export type NeglectStage = { kind: "none" } | { kind: "notice"; day: number } | { kind: "recall" };

export function neglectStage(assignedDay: string, today: string): NeglectStage {
  const days = businessDaysSince(assignedDay, today);
  if (days <= 0) return { kind: "none" };
  if (days <= NEGLECT_NOTICE_DAYS) return { kind: "notice", day: days };
  return { kind: "recall" };
}

export const NEGLECT_RECALL_REASON =
  "২ কার্যদিবস সতর্কবার্তার পরও লিডে কোনো কল, রিপোর্ট বা রেকর্ডিং হয়নি — লিড অবহেলা";

export const NEGLECT_CALL_LOCK =
  "এই লিডটি অবহেলার কারণে আপনার কাছ থেকে LeadHub Nexus-এ ফেরত নেওয়া হয়েছে — আপনি আর কল করতে পারবেন না";
