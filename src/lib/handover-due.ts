/**
 * Fixed handover due-date rules (Asia/Dhaka calendar days):
 *  - Documents: due 7 days after the first completed site visit; satisfied once a booking is recorded.
 *  - Payment (booking money): due on the booking date; satisfied once HQ approves the booking.
 * Pure — no I/O. Dates come only from saved records.
 */
export const DOCS_DUE_DAYS = 7;

export type DueItem = { kind: "documents" | "payment"; dueDate: string; daysLeft: number; state: "overdue" | "today" | "soon" | "upcoming" };

const DAY = 86_400_000;
/** YYYY-MM-DD of the Dhaka calendar day containing `iso`. */
export function dhakaDate(iso: string | Date): string {
  return new Date(new Date(iso).getTime() + 6 * 3600_000).toISOString().slice(0, 10);
}
const dayNum = (ymd: string) => Math.round(Date.parse(`${ymd}T00:00:00Z`) / DAY);
const addDays = (ymd: string, n: number) => new Date((dayNum(ymd) + n) * DAY).toISOString().slice(0, 10);

function item(kind: DueItem["kind"], dueDate: string, now: Date): DueItem {
  const daysLeft = dayNum(dueDate) - dayNum(dhakaDate(now));
  const state = daysLeft < 0 ? "overdue" : daysLeft === 0 ? "today" : daysLeft <= 2 ? "soon" : "upcoming";
  return { kind, dueDate, daysLeft, state };
}

export type DueInput = {
  visits: { status: string; outcome: string | null; outcome_at: string | null; visit_at: string }[];
  booking: { booked_at: string | null; approval_status: string | null } | null;
};

export function handoverDue(input: DueInput, now = new Date()): DueItem[] {
  const out: DueItem[] = [];
  const done = input.visits
    .filter((v) => v.status === "completed" || v.outcome != null)
    .map((v) => v.outcome_at ?? v.visit_at)
    .sort();
  if (done.length && !input.booking) out.push(item("documents", addDays(dhakaDate(done[0]!), DOCS_DUE_DAYS), now));
  const b = input.booking;
  if (b?.booked_at && b.approval_status !== "approved") out.push(item("payment", dhakaDate(b.booked_at), now));
  return out;
}

export const DUE_LABEL = {
  documents: { bn: "নথি জমা", en: "Documents" },
  payment: { bn: "বুকিং পেমেন্ট", en: "Booking payment" },
} as const;

export function dueText(d: DueItem): string {
  if (d.state === "overdue") return `${-d.daysLeft} দিন পেরিয়েছে (${d.dueDate})`;
  if (d.state === "today") return `আজ শেষ দিন (${d.dueDate})`;
  return `${d.daysLeft} দিন বাকি (${d.dueDate})`;
}
