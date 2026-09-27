/**
 * Canonical Winstone CRM taxonomy — one label and one tone per state, used by
 * every screen. Map raw database values through these helpers; never invent a
 * page-specific label for the same state.
 */

export type Tone = "success" | "warning" | "danger" | "neutral" | "brand";

export type LifecycleStage =
  | "UNASSIGNED"
  | "ASSIGNED"
  | "CONTACTED"
  | "QUALIFIED"
  | "FOLLOW_UP"
  | "SITE_VISIT"
  | "CONVERTED"
  | "CLOSED"
  | "DUPLICATE";

export const LIFECYCLE: Record<LifecycleStage, { label: string; tone: Tone }> = {
  UNASSIGNED: { label: "Unassigned", tone: "warning" },
  ASSIGNED: { label: "Assigned", tone: "brand" },
  CONTACTED: { label: "Contacted", tone: "neutral" },
  QUALIFIED: { label: "Qualified", tone: "success" },
  FOLLOW_UP: { label: "Follow-up", tone: "warning" },
  SITE_VISIT: { label: "Site visit", tone: "success" },
  CONVERTED: { label: "Converted", tone: "success" },
  CLOSED: { label: "Closed", tone: "neutral" },
  DUPLICATE: { label: "Duplicate", tone: "neutral" },
};

type LeadLike = {
  assigned_to?: string | null;
  assignment_source?: string | null;
  status?: string | null;
  outcome_category?: string | null;
  grade?: string | null;
};

/** Derives the one canonical lifecycle stage from raw lead columns. */
export function lifecycleStage(lead: LeadLike): LifecycleStage {
  if (lead.assignment_source === "duplicate_skipped") return "DUPLICATE";
  const category = (lead.outcome_category ?? "").toLowerCase();
  if (/convert|booked|sold|won/.test(category)) return "CONVERTED";
  if (/site.?visit/.test(category)) return "SITE_VISIT";
  if (!lead.assigned_to) return "UNASSIGNED";
  switch (lead.status) {
    case "follow_up":
      return "FOLLOW_UP";
    case "closed":
      return "CLOSED";
    case "contacted":
      return lead.grade === "A" || lead.grade === "B" ? "QUALIFIED" : "CONTACTED";
    default:
      return "ASSIGNED";
  }
}

export type CallState = "CONNECTED" | "NO_ANSWER" | "BUSY" | "FAILED";
export const CALL_STATE: Record<CallState, { label: string; tone: Tone }> = {
  CONNECTED: { label: "Connected", tone: "success" },
  NO_ANSWER: { label: "No answer", tone: "warning" },
  BUSY: { label: "Busy", tone: "warning" },
  FAILED: { label: "Failed", tone: "danger" },
};

export type Temperature = "HOT" | "WARM" | "COLD";
export const TEMPERATURE: Record<Temperature, { label: string; tone: Tone }> = {
  HOT: { label: "Hot", tone: "danger" },
  WARM: { label: "Warm", tone: "warning" },
  COLD: { label: "Cold", tone: "neutral" },
};
export function toTemperature(raw: string | null | undefined): Temperature | null {
  const v = (raw ?? "").trim().toUpperCase();
  return v === "HOT" || v === "WARM" || v === "COLD" ? v : null;
}

export type Grade = "A" | "B" | "C" | "D";
export const GRADE_TONE: Record<Grade, Tone> = { A: "success", B: "brand", C: "warning", D: "neutral" };
export function toGrade(raw: string | null | undefined): Grade | null {
  const v = (raw ?? "").trim().toUpperCase().charAt(0);
  return v === "A" || v === "B" || v === "C" || v === "D" ? v : null;
}

export type FollowUpStatus = "NONE" | "DUE" | "OVERDUE" | "COMPLETED" | "CANCELLED";
export const FOLLOW_UP: Record<FollowUpStatus, { label: string; tone: Tone }> = {
  NONE: { label: "No follow-up", tone: "neutral" },
  DUE: { label: "Due", tone: "warning" },
  OVERDUE: { label: "OVERDUE", tone: "danger" },
  COMPLETED: { label: "Completed", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};
export function followUpStatus(
  event: { scheduled_at?: string | null; status?: string | null } | null | undefined,
  now = Date.now(),
): FollowUpStatus {
  if (!event?.scheduled_at) return "NONE";
  if (event.status === "done") return "COMPLETED";
  if (event.status === "cancelled") return "CANCELLED";
  return new Date(event.scheduled_at).getTime() < now ? "OVERDUE" : "DUE";
}

export type AssignmentState = "HEAD_STORE" | "AGENT_QUEUE" | "PARKED";
export const ASSIGNMENT: Record<AssignmentState, { label: string; tone: Tone }> = {
  HEAD_STORE: { label: "Head Lead Store · Unassigned", tone: "warning" },
  AGENT_QUEUE: { label: "Agent queue", tone: "brand" },
  PARKED: { label: "Parked (duplicate)", tone: "neutral" },
};
export function assignmentState(lead: LeadLike): AssignmentState {
  if (lead.assignment_source === "duplicate_skipped") return "PARKED";
  return lead.assigned_to ? "AGENT_QUEUE" : "HEAD_STORE";
}

export const TONE_CLASS: Record<Tone, string> = {
  success: "border-success/40 bg-success/10 text-success",
  warning: "border-warning/50 bg-warning/15 text-foreground",
  danger: "border-destructive/40 bg-destructive/10 text-destructive",
  neutral: "border-border bg-surface-2 text-muted-foreground",
  brand: "border-primary/40 bg-primary/10 text-foreground",
};

/** Privacy-safe mobile display: keeps operator prefix and last 3 digits. */
export function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return phone;
  return `${digits.slice(0, digits.length - 8)}•••••${digits.slice(-3)}`;
}
