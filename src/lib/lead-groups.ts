/**
 * Pure lead filtering / grouping helpers shared by the Agent Desk, Head
 * Database and calendar. No I/O, so every rule here is unit-tested.
 * All day boundaries are Asia/Dhaka (UTC+6, no DST).
 */

const DHAKA_OFFSET_MS = 6 * 60 * 60_000;

/** yyyy-mm-dd of an instant in Dhaka time. */
export function dhakaDay(input: string | number | Date): string {
  const t = new Date(input).getTime() + DHAKA_OFFSET_MS;
  return new Date(t).toISOString().slice(0, 10);
}

/** Dhaka shift of an instant: before 14:00 = morning, after = afternoon. */
export function dhakaShift(input: string | number | Date): "morning" | "afternoon" {
  const hour = new Date(new Date(input).getTime() + DHAKA_OFFSET_MS).getUTCHours();
  return hour < 14 ? "morning" : "afternoon";
}

export type FollowUpState = "overdue" | "due_today" | "upcoming" | "none";

export const FOLLOW_UP_STATE_LABEL: Record<FollowUpState, string> = {
  overdue: "সময় পেরিয়েছে",
  due_today: "আজ",
  upcoming: "আসছে",
  none: "ফলো-আপ নেই",
};

export const FOLLOW_UP_STATE_LABEL_EN: Record<FollowUpState, string> = {
  overdue: "Overdue",
  due_today: "Today",
  upcoming: "Upcoming",
  none: "No follow-up",
};

export function followUpState(nextAt: string | null | undefined, now = Date.now()): FollowUpState {
  if (!nextAt) return "none";
  const at = new Date(nextAt).getTime();
  if (Number.isNaN(at)) return "none";
  if (at < now) return "overdue";
  if (dhakaDay(at) === dhakaDay(now)) return "due_today";
  return "upcoming";
}

export type DeskLead = {
  id: string;
  name: string;
  phone_number: string;
  status: string;
  temperature: string | null;
  reference_by: string | null;
  company?: string | null;
  source?: string | null;
  call_attempts?: number | null;
  last_call_at: string | null;
  created_at: string;
  work_date?: string | null;
};

export type DeskExtras = { requirement: string | null; nextFollowUpAt: string | null };

export type DeskBucket =
  | "all"
  | "today"
  | "uncalled"
  | "retry"
  | "follow_up"
  | "hot"
  | "warm"
  | "cold"
  | "overdue";

export const DESK_BUCKET_LABEL: Record<DeskBucket, string> = {
  all: "সব",
  today: "আজকের",
  uncalled: "কল হয়নি",
  retry: "আবার চেষ্টা",
  follow_up: "ফলো-আপ",
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
  overdue: "OVERDUE",
};

export const DESK_BUCKET_LABEL_EN: Record<DeskBucket, string> = {
  all: "All",
  today: "Today",
  uncalled: "Not called",
  retry: "Retry",
  follow_up: "Follow-up",
  hot: "Hot",
  warm: "Warm",
  cold: "Cold",
  overdue: "OVERDUE",
};

export function inBucket(
  lead: DeskLead,
  extras: DeskExtras | undefined,
  bucket: DeskBucket,
  now = Date.now(),
): boolean {
  const attempts = lead.call_attempts ?? 0;
  const fu = followUpState(extras?.nextFollowUpAt, now);
  switch (bucket) {
    case "all":
      return true;
    case "today":
      return (lead.work_date ?? dhakaDay(lead.created_at)) === dhakaDay(now);
    case "uncalled":
      return lead.status === "pending" && attempts === 0 && !lead.last_call_at;
    case "retry":
      return lead.status === "pending" && (attempts > 0 || Boolean(lead.last_call_at));
    case "follow_up":
      return lead.status === "follow_up" || fu !== "none";
    case "hot":
    case "warm":
    case "cold":
      return lead.temperature === bucket;
    case "overdue":
      return fu === "overdue";
  }
}

export function matchesSearch(lead: DeskLead, needle: string): boolean {
  const q = needle.trim().toLowerCase();
  if (!q) return true;
  return [lead.name, lead.phone_number, lead.reference_by, lead.company]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(q));
}

export type GroupKey =
  | "none"
  | "status"
  | "temperature"
  | "source"
  | "reference"
  | "requirement"
  | "follow_up"
  | "date";

export const GROUP_LABEL: Record<GroupKey, string> = {
  none: "গ্রুপ ছাড়া",
  status: "অবস্থা",
  temperature: "Temperature",
  source: "সোর্স",
  reference: "রেফারেন্স",
  requirement: "প্রজেক্ট/চাহিদা",
  follow_up: "ফলো-আপ অবস্থা",
  date: "তারিখ",
};

export const GROUP_LABEL_EN: Record<GroupKey, string> = {
  none: "No group",
  status: "Status",
  temperature: "Temperature",
  source: "Source",
  reference: "Reference",
  requirement: "Project/requirement",
  follow_up: "Follow-up status",
  date: "Date",
};

function groupValue(
  lead: DeskLead,
  extras: DeskExtras | undefined,
  key: GroupKey,
  now: number,
  lang: "bn" | "en" = "bn",
) {
  switch (key) {
    case "none":
      return lang === "en" ? "All" : "সব";
    case "status":
      return lead.status;
    case "temperature":
      return lead.temperature ?? (lang === "en" ? "Unclassified" : "অশ্রেণিভুক্ত");
    case "source":
      return lead.source || (lang === "en" ? "No source" : "সোর্স নেই");
    case "reference":
      return lead.reference_by?.trim() || (lang === "en" ? "No reference" : "রেফারেন্স নেই");
    case "requirement":
      return extras?.requirement || (lang === "en" ? "Requirement unknown" : "চাহিদা জানা নেই");
    case "follow_up":
      return (lang === "en" ? FOLLOW_UP_STATE_LABEL_EN : FOLLOW_UP_STATE_LABEL)[
        followUpState(extras?.nextFollowUpAt, now)
      ];
    case "date":
      return dhakaDay(lead.created_at);
  }
}

export type LeadGroup<T> = { key: string; items: T[] };

/** Stable grouping: groups sorted by size desc (dates newest first), items keep order. */
export function groupLeads<T extends DeskLead>(
  leads: T[],
  extras: Map<string, DeskExtras>,
  key: GroupKey,
  now = Date.now(),
  lang: "bn" | "en" = "bn",
): LeadGroup<T>[] {
  const map = new Map<string, T[]>();
  for (const lead of leads) {
    const g = groupValue(lead, extras.get(lead.id), key, now, lang);
    const list = map.get(g) ?? [];
    list.push(lead);
    map.set(g, list);
  }
  const groups = [...map.entries()].map(([k, items]) => ({ key: k, items }));
  if (key === "date") return groups.sort((a, b) => b.key.localeCompare(a.key));
  return groups.sort((a, b) => b.items.length - a.items.length || a.key.localeCompare(b.key));
}

/**
 * Who may move a follow-up: the owning agent, or a coordinator / HQ.
 * Read-only HQ viewing sessions may never write.
 */
export function canReschedule(
  caller: { scope: "authority" | "coordinator" | "agent" | "none"; profileId: string | null; readOnly: boolean },
  eventAgentId: string | null,
): boolean {
  if (caller.readOnly || caller.scope === "none") return false;
  if (caller.scope === "authority" || caller.scope === "coordinator") return true;
  return Boolean(caller.profileId && eventAgentId && caller.profileId === eventAgentId);
}

/** A phone-measured call longer than this is a sensor error, not talk time. */
export const MAX_PLAUSIBLE_CALL_SECONDS = 3 * 60 * 60;

/** Seconds that may be counted as talk time; impossible values count as 0. */
export function plausibleSeconds(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return value > MAX_PLAUSIBLE_CALL_SECONDS ? 0 : value;
}
