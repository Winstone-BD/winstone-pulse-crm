/**
 * Display-only billing guidance derived from the canonical server state.
 * Never changes enforcement, never approves, verifies or unlocks — it only
 * explains what the server already decided and which human acts next.
 */
import { deadlineLeftLabel, dhakaTime, subscriptionNoticeState } from "@/lib/maintenance-rules";

export type ApprovalSummary = {
  period: string;
  feeUsd: number;
  dueDate: string;
  lockAt: string;
  paymentStatus: "unpaid" | "pending" | "verified";
  paymentRef: string | null;
  unlockStatus: string;
  unlockExpiresAt: string | null;
  locked: boolean;
  rejectedReason: string | null;
  openRequests: { id: string; hours: number; reason: string | null; requestedBy: string; requestedAt: string }[];
  /** Server-derived: confirmed Google identity of the designated architect. Convenience only. */
  canApprove: boolean;
};

export type StepState = "done" | "current" | "todo";
export type Step = { key: string; label: string; state: StepState };

export function pendingCount(s: ApprovalSummary): number {
  return (s.paymentStatus === "pending" && s.paymentRef ? 1 : 0) + s.openRequests.length;
}

/** Real progression only: each step is derived from stored fields. */
export function progression(s: ApprovalSummary, now = new Date()): Step[] {
  const unlocked = s.unlockStatus === "approved" && s.unlockExpiresAt !== null && new Date(s.unlockExpiresAt) > now;
  const refIn = s.paymentStatus !== "unpaid";
  const verified = s.paymentStatus === "verified";
  const decided = verified || unlocked;
  const raw: [string, string, boolean][] = [
    ["reference", "Payment reference submitted (IT Console)", refIn],
    ["verify", "Payment checked against evidence", verified],
    ["decision", "System Architect decision", decided],
    ["unlock", "Temporary unlock (if approved)", unlocked],
    ["relock", "Automatic expiry & relock (server)", false],
  ];
  let current = false;
  return raw.map(([key, label, done]) => {
    if (done) return { key, label, state: "done" as const };
    if (!current) { current = true; return { key, label, state: "current" as const }; }
    return { key, label, state: "todo" as const };
  });
}

export function nextAction(s: ApprovalSummary): string {
  if (pendingCount(s) > 0) {
    return s.canApprove
      ? "Review the pending item and approve or reject it on the Architect page (Google + private PIN)."
      : "Waiting for the System Architect's decision. Only the architect can approve.";
  }
  if (s.paymentStatus === "verified") return "Nothing to do — this month's payment is verified.";
  if (s.rejectedReason) return `Last reference was rejected (${s.rejectedReason}). IT Console must submit a correct reference.`;
  return "IT Console should submit the real bKash/bank reference once payment is made.";
}

/** Advisory explanation (Winstone AI). Grounded only in the summary fields. */
export function advisory(s: ApprovalSummary, now = new Date()): string[] {
  const out: string[] = [];
  const toLock = new Date(s.lockAt).getTime() - now.getTime();
  out.push(`Invoice ${s.period}: $${s.feeUsd.toFixed(2)} USD, due ${dhakaTime(s.dueDate)} (Dhaka).`);
  if (s.locked) out.push("The CRM is currently locked for this invoice.");
  else if (s.paymentStatus !== "verified" && toLock > 0) out.push(`Unpaid lock in ${deadlineLeftLabel(toLock)} (${dhakaTime(s.lockAt)} Dhaka).`);
  if (s.paymentStatus === "pending" && s.paymentRef) out.push(`IT submitted reference "${s.paymentRef}". A reference is a claim — it does not prove payment until checked.`);
  if (s.paymentStatus === "unpaid") out.push("No payment reference has been submitted yet.");
  for (const r of s.openRequests) out.push(`${r.requestedBy} asked for a ${r.hours}h temporary unlock${r.reason ? ` — "${r.reason}"` : ""}. If approved it relocks automatically when it expires.`);
  if (s.unlockStatus === "approved" && s.unlockExpiresAt) out.push(`Temporary unlock expires ${dhakaTime(s.unlockExpiresAt)}; the server relocks it automatically.`);
  out.push(nextAction(s));
  return out;
}

export type ReminderKind = "approval" | "deadline" | null;

/**
 * Which non-blocking reminder may show. Approval only when a real item is
 * pending AND the viewer is the architect; deadline only inside the existing
 * notice window. Never anything when nothing exists.
 */
export function reminderKind(s: ApprovalSummary, now = new Date()): ReminderKind {
  if (s.canApprove && pendingCount(s) > 0) return "approval";
  if (subscriptionNoticeState(s.paymentStatus, s.locked, now) !== null) return "deadline";
  return null;
}

/** Once per browser session per period + item set; returns the key. */
export function reminderKey(s: ApprovalSummary, kind: Exclude<ReminderKind, null>): string {
  const ids = s.openRequests.map((r) => r.id).join(",");
  return `billing-reminder:${kind}:${s.period}:${s.paymentRef ?? ""}:${ids}`;
}
