import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { SectionGroup, GroupState } from "@/components/crm/groups";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { listAccountabilityReviews, reviewAccountability } from "@/lib/accountability.functions";
import { STATUS_LABEL, type AccountabilityStatus } from "@/lib/accountability";
import { useAdminToken } from "@/lib/local-session";

type HistoryEntry = { action: string; at: string; by: string; note: string | null };

const TONE: Record<AccountabilityStatus, string> = {
  review_required: "border-warning/50 bg-warning/15 text-foreground",
  hold: "border-destructive/40 bg-destructive/10 text-destructive",
  approved: "border-success/40 bg-success/15 text-foreground",
};

function fmt(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

/** Executive HQ (approve) and IT Console (monitor only) — server decides who may act. */
export function AccountabilityReviewPanel({ surface }: { surface: "hq" | "it" }) {
  const adminToken = useAdminToken();
  const list = useServerFn(listAccountabilityReviews);
  const review = useServerFn(reviewAccountability);
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const q = useQuery({
    queryKey: ["accountability-reviews", adminToken],
    queryFn: () => list({ data: { adminToken, days: 30 } }),
    enabled: Boolean(adminToken),
  });

  const act = useMutation({
    mutationFn: (v: { id: string; action: "approve" | "hold" | "note" }) =>
      review({ data: { adminToken, id: v.id, action: v.action, note: note.trim() || undefined } }),
    onSuccess: (_r, v) => {
      toast.success(v.action === "approve" ? "Next-day unlock approved" : v.action === "hold" ? "Kept on hold" : "Note added");
      setNote("");
      qc.invalidateQueries({ queryKey: ["accountability-reviews"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  const rows = q.data?.reviews ?? [];
  const canApprove = surface === "hq" && Boolean(q.data?.canApprove);
  const open = rows.find((r) => r.id === openId) ?? null;
  const history = (open?.review_history ?? []) as HistoryEntry[];
  const prior = open ? rows.filter((r) => r.agent_id === open.agent_id && r.id !== open.id) : [];
  const waiting = rows.filter((r) => r.status !== "approved").length;

  return (
    <SectionGroup
      eyebrow={surface === "hq" ? "Executive HQ" : "IT monitoring"}
      title="Daily Accountability / Pending Review"
      subtitle={
        surface === "hq"
          ? "Agents above 10% pending work. Next-day queue opens only after HQ approval."
          : "Read-only audit view. Approval and unlock are Executive HQ only."
      }
      count={waiting}
    >
      {q.isPending ? (
        <GroupState kind="loading" />
      ) : q.isError ? (
        <GroupState kind="error" title={q.error instanceof Error ? q.error.message : "Could not load"} />
      ) : rows.length === 0 ? (
        <GroupState kind="empty" title="No pending-review records in the last 30 days" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr className="border-b border-border">
                <th className="py-2 pr-3">Agent</th><th className="pr-3">Business date</th>
                <th className="pr-3 text-right">Eligible</th><th className="pr-3 text-right">Done</th>
                <th className="pr-3 text-right">Pending</th><th className="pr-3 text-right">%</th>
                <th className="pr-3 text-right">Overdue FU</th><th className="pr-3 text-right">Incomplete reports</th>
                <th className="pr-3">State</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const agent = r.agent as { name?: string; employee_id?: string } | null;
                const st = r.status as AccountabilityStatus;
                return (
                  <tr key={r.id} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-medium">{agent?.name ?? "—"} <span className="text-muted-foreground">{agent?.employee_id ?? ""}</span></td>
                    <td className="pr-3 tabular">{r.business_date}</td>
                    <td className="pr-3 text-right tabular">{r.eligible_count}</td>
                    <td className="pr-3 text-right tabular">{r.completed_count}</td>
                    <td className="pr-3 text-right tabular">{r.pending_count}</td>
                    <td className="pr-3 text-right tabular font-semibold">{r.pending_percent}%</td>
                    <td className="pr-3 text-right tabular">{r.overdue_followups}</td>
                    <td className="pr-3 text-right tabular">{r.missed_reports}</td>
                    <td className="pr-3"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${TONE[st]}`}>{STATUS_LABEL[st]}</span></td>
                    <td className="text-right"><Button size="sm" variant="outline" onClick={() => { setNote(""); setOpenId(r.id); }}>Review details</Button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={Boolean(open)} onOpenChange={(v) => !v && setOpenId(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          {open && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {(open.agent as { name?: string } | null)?.name ?? "Agent"} — {open.business_date}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p className="rounded-xl border border-border bg-surface-2/60 p-3 text-xs">{open.trigger_reason}</p>
                <dl className="grid grid-cols-2 gap-2 text-xs">
                  <dt className="text-muted-foreground">Assigned eligible leads</dt><dd className="tabular">{open.assigned_count}</dd>
                  <dt className="text-muted-foreground">Total workload (incl. due follow-ups)</dt><dd className="tabular">{open.eligible_count}</dd>
                  <dt className="text-muted-foreground">Completed / contacted</dt><dd className="tabular">{open.completed_count}</dd>
                  <dt className="text-muted-foreground">Pending</dt><dd className="tabular">{open.pending_count} ({open.pending_percent}%)</dd>
                  <dt className="text-muted-foreground">Overdue follow-ups</dt><dd className="tabular">{open.overdue_followups}</dd>
                  <dt className="text-muted-foreground">Incomplete reports</dt><dd className="tabular">{open.missed_reports}</dd>
                  <dt className="text-muted-foreground">Unlock for date</dt><dd className="tabular">{open.unlock_for_date}</dd>
                  <dt className="text-muted-foreground">Reviewed</dt><dd>{open.reviewed_by ? `${open.reviewed_by}, ${fmt(open.reviewed_at)}` : "—"}</dd>
                </dl>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Evidence timeline</p>
                  <ol className="space-y-1 text-xs">
                    {history.map((h, i) => (
                      <li key={i} className="border-l-2 border-primary/40 pl-2">
                        <span className="font-medium">{h.action}</span> · {h.by} · {fmt(h.at)}
                        {h.note ? <span className="block text-muted-foreground">{h.note}</span> : null}
                      </li>
                    ))}
                  </ol>
                </div>
                <div>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Previous reviews</p>
                  {prior.length === 0 ? (
                    <p className="text-xs text-muted-foreground">None in the last 30 days.</p>
                  ) : (
                    <ul className="space-y-0.5 text-xs">
                      {prior.map((p) => (
                        <li key={p.id}>{p.business_date} — {p.pending_percent}% — {STATUS_LABEL[p.status as AccountabilityStatus]}</li>
                      ))}
                    </ul>
                  )}
                </div>
                {canApprove ? (
                  <div className="space-y-2">
                    <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Review note (required for Hold / Add note)" maxLength={1000} />
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={act.isPending || open.status === "approved"} onClick={() => act.mutate({ id: open.id, action: "approve" })}>Approve Next-Day Unlock</Button>
                      <Button variant="outline" disabled={act.isPending || !note.trim()} onClick={() => act.mutate({ id: open.id, action: "hold" })}>Keep On Hold</Button>
                      <Button variant="ghost" disabled={act.isPending || !note.trim()} onClick={() => act.mutate({ id: open.id, action: "note" })}>Add review note</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {surface === "it" ? "IT can monitor only. Final approval is Executive HQ." : "Unlock with the Executive HQ PIN to act."}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </SectionGroup>
  );
}
