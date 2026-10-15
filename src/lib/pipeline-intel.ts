/** Pure calculations for Pipeline answers and the daily report sheet. Numbers come only from rows passed in. */
import { dhakaDate } from "@/lib/handover-due";

export const PIPELINE_QUESTIONS = [
  { id: "followups_today", bn: "আজ কোন ফলো-আপ করতে হবে?", en: "Which follow-ups are due today?" },
  { id: "inactive_7d", bn: "কোন লিড ৭ দিন ধরে নিষ্ক্রিয়?", en: "Which leads have been inactive for 7 days?" },
  { id: "stage_counts", bn: "ধাপ অনুযায়ী পাইপলাইন কেমন?", en: "What does the pipeline look like by stage?" },
  { id: "overdue_by_agent", bn: "কার সবচেয়ে বেশি ফলো-আপ বাকি?", en: "Which agents have the most overdue follow-ups?" },
  { id: "week_summary", bn: "এই সপ্তাহের লিড ও ভিজিটের সারাংশ", en: "Summarise this week's leads and visits" },
] as const;
export type PipelineQuestion = (typeof PIPELINE_QUESTIONS)[number]["id"];

type FU = { agent_id: string | null; scheduled_at: string; status: string };
export function followupsToday(rows: FU[], now: Date) {
  const today = dhakaDate(now);
  const up = rows.filter((r) => r.status === "upcoming");
  return { today, dueToday: up.filter((r) => dhakaDate(r.scheduled_at) === today).length, overdue: up.filter((r) => new Date(r.scheduled_at) < now && dhakaDate(r.scheduled_at) < today).length };
}

type LeadRow = { status: string; last_call_at: string | null; updated_at: string; created_at: string };
export function isInactive(l: LeadRow, now: Date, days = 7) {
  if (l.status === "closed") return false;
  const last = Math.max(Date.parse(l.last_call_at ?? l.created_at), Date.parse(l.updated_at));
  return now.getTime() - last >= days * 86_400_000;
}

export function stageCounts(leads: { status: string }[], bookings: { approval_status: string; amount_usd: number | null }[]) {
  const stages: Record<string, number> = { pending: 0, contacted: 0, follow_up: 0, closed: 0 };
  for (const l of leads) stages[l.status] = (stages[l.status] ?? 0) + 1;
  const book: Record<string, { count: number; usdCents: number; missingAmount: number }> = {};
  for (const b of bookings) {
    const e = (book[b.approval_status] ??= { count: 0, usdCents: 0, missingAmount: 0 });
    e.count += 1;
    if (b.amount_usd == null) e.missingAmount += 1; else e.usdCents += Math.round(b.amount_usd * 100);
  }
  return { stages, bookings: book };
}

export function overdueByAgent(rows: FU[], now: Date) {
  const m = new Map<string, number>();
  for (const r of rows) if (r.status === "upcoming" && r.agent_id && new Date(r.scheduled_at) < now) m.set(r.agent_id, (m.get(r.agent_id) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/** Daily sheet row per lead. */
export type SheetRow = { leadId: string; lead: string; phone: string; agent: string | null; status: string; stage: string; visits: number; visitsCompleted: number; bookings: number; paymentStatus: string; lastActivity: string | null };
export function sheetCsv(rows: SheetRow[]): string {
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    const safe = /^[=+\-@]/.test(s) ? `'${s}` : s; // block spreadsheet formula injection
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = ["Lead", "Phone", "Agent", "Status", "Stage", "Visits", "Visits completed", "Bookings", "Payment status", "Last activity (Dhaka)"];
  return [head, ...rows.map((r) => [r.lead, r.phone, r.agent ?? "", r.status, r.stage, r.visits, r.visitsCompleted, r.bookings, r.paymentStatus, r.lastActivity ?? ""])].map((r) => r.map(esc).join(",")).join("\n");
}
