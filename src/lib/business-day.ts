/**
 * Winstone business-day rule (Asia/Dhaka, UTC+6, no DST).
 * Friday is the weekly non-distribution day: no new leads are handed out,
 * and it is not a business day for daily accountability.
 */
export const FRIDAY_BLOCK_MESSAGE =
  "আজ শুক্রবার — লিড বিতরণ বন্ধ দিন। নতুন লিড দেওয়া যাবে না; আগের লিডের কাজ চালু থাকবে।";

/** Dhaka calendar date (YYYY-MM-DD) for an instant. */
export function dhakaDateOf(now = Date.now()): string {
  return new Date(now + 6 * 3_600_000).toISOString().slice(0, 10);
}

/** 0 = Sunday … 5 = Friday, for a Dhaka YYYY-MM-DD date. */
export function weekdayOf(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

export function isFriday(day: string): boolean {
  return weekdayOf(day) === 5;
}

/** A business day is any day that is not Friday. */
export function isBusinessDay(day: string): boolean {
  return !isFriday(day);
}

export function isDistributionDay(day: string): boolean {
  return isBusinessDay(day);
}

function shift(day: string, delta: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function nextBusinessDay(day: string): string {
  let d = shift(day, 1);
  while (!isBusinessDay(d)) d = shift(d, 1);
  return d;
}

export function previousBusinessDay(day: string): string {
  let d = shift(day, -1);
  while (!isBusinessDay(d)) d = shift(d, -1);
  return d;
}

export class DistributionBlockedError extends Error {
  readonly code = "friday_no_distribution";
  constructor() {
    super(FRIDAY_BLOCK_MESSAGE);
  }
}

/** Server guard: throws on Friday (Dhaka). */
export function assertDistributionDay(day: string = dhakaDateOf()): void {
  if (!isDistributionDay(day)) throw new DistributionBlockedError();
}
