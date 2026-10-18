import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Loader2, Plus, Send, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { StatusBadge } from "@/components/crm/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignLeadCounts, coordinatorAllocation } from "@/lib/coordinator-deck.functions";
import { useDeckToken } from "@/lib/local-session";

type Row = { key: string; agentId: string; count: string };
const newRow = (agentId = ""): Row => ({ key: crypto.randomUUID(), agentId, count: "" });

export function useCoordinatorAllocation() {
  const adminToken = useDeckToken();
  const fn = useServerFn(coordinatorAllocation);
  return useQuery({
    queryKey: ["coord-allocation", adminToken ? "tok" : "session"],
    queryFn: () => fn({ data: { adminToken } }),
    refetchInterval: 60_000,
  });
}

/** Coordinator dashboard numbers table: who has what today, how much room is left. */
export function AllocationTable({ onAssign }: { onAssign: (agentId: string) => void }) {
  const q = useCoordinatorAllocation();
  const d = q.data;
  return (
    <section className="card-elevated overflow-hidden">
      <header className="flex flex-wrap items-center gap-2 border-b border-border p-4">
        <h2 className="text-sm font-semibold">Agent allocation · আজ</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {d ? `${d.today} · available to distribute ${d.available}` : "…"}
        </span>
      </header>
      {q.isError && <p className="p-4 text-xs text-destructive">{(q.error as Error).message}</p>}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Agent Name</th>
              <th className="px-4 py-2 text-left">Employee ID</th>
              <th className="px-4 py-2 text-right">Today's Assigned</th>
              <th className="px-4 py-2 text-right">Daily target</th>
              <th className="px-4 py-2 text-right">Remaining Capacity</th>
              <th className="px-4 py-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {(d?.agents ?? []).map((a) => {
              const remaining = Math.max(0, d!.perAgent - a.today);
              return (
                <tr key={a.id} className="border-t border-border/70">
                  <td className="px-4 py-2 font-medium">{a.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{a.employeeId ?? "—"}</td>
                  <td className="tabular px-4 py-2 text-right">{a.today}</td>
                  <td className="tabular px-4 py-2 text-right">{d!.perAgent}</td>
                  <td className={`tabular px-4 py-2 text-right ${remaining === 0 ? "text-success" : ""}`}>{remaining}</td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="secondary" onClick={() => onAssign(a.id)}>Assign</Button>
                  </td>
                </tr>
              );
            })}
            {d && d.agents.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-muted-foreground">কোনো সক্রিয় অনুমোদিত এজেন্ট নেই।</td></tr>
            )}
            {q.isPending && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-xs text-muted-foreground">লোড হচ্ছে…</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Assign an exact number of leads per agent, one or many at once, with a preview. */
export function AssignLeadsWorkspace({ initialAgentId, initialCount }: { initialAgentId?: string | undefined; initialCount?: number | null }) {
  const adminToken = useDeckToken();
  const qc = useQueryClient();
  const alloc = useCoordinatorAllocation();
  const assignFn = useServerFn(assignLeadCounts);
  const [rows, setRows] = useState<Row[]>(() => [{ ...newRow(initialAgentId), count: initialCount ? String(initialCount) : "" }]);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [confirming, setConfirming] = useState(false);
  const [last, setLast] = useState<{ agentId: string; requested: number; assigned: number }[] | null>(null);

  const agents = alloc.data?.agents ?? [];
  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);
  const available = alloc.data?.available ?? 0;
  const valid = rows
    .map((r) => {
      const agent = byId.get(r.agentId);
      const capacity = agent && alloc.data ? Math.max(0, alloc.data.perAgent - agent.today) : 0;
      return { agentId: r.agentId, count: Math.min(Number(r.count) || 0, capacity) };
    })
    .filter((r) => r.agentId && r.count > 0);
  const rawRequested = rows.reduce((sum, row) => sum + (Number(row.count) || 0), 0);
  const requested = valid.reduce((s, r) => s + r.count, 0);
  const quotaExceeded = Math.max(0, rawRequested - requested);
  const shortage = Math.max(0, requested - available);
  const dupAgents = new Set(valid.map((r) => r.agentId)).size !== valid.length;

  const update = (key: string, patch: Partial<Row>) => {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
    setConfirming(false);
  };

  const run = useMutation({
    mutationFn: () => assignFn({ data: { adminToken, requestId, rows: valid } }),
    onSuccess: (res) => {
      const total = res.results.reduce((s, r) => s + r.assigned, 0);
      setLast(res.results);
      toast.success(`${total} লিড অ্যাসাইন হয়েছে · Canonical database-এ বাকি ${res.available}`);
      setRows([newRow()]);
      setRequestId(crypto.randomUUID());
      setConfirming(false);
      void qc.invalidateQueries({ queryKey: ["coord-allocation"] });
      void qc.invalidateQueries({ queryKey: ["deck-kpis"] });
      void qc.invalidateQueries({ queryKey: ["lead-store"] });
      void qc.invalidateQueries({ queryKey: ["lead-pool"] });
      void qc.invalidateQueries({ queryKey: ["crm-snapshot"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="card-elevated space-y-4 p-4">
      {alloc.data && alloc.data.distributionOpen === false && (
        <div role="alert" className="rounded-xl border border-warning/40 bg-warning/10 p-3 text-sm font-medium text-foreground">
          {alloc.data.distributionNotice}
        </div>
      )}
      <header className="flex flex-wrap items-end gap-3">
        <div>
          <h2 className="text-base font-semibold">Assign by Agent + Quantity</h2>
          <p className="text-xs text-muted-foreground">
            এজেন্ট বাছুন, সংখ্যা লিখুন — সবচেয়ে পুরোনো যোগ্য unassigned লিড আগে যাবে। ডুপ্লিকেট/ভুল নম্বর কখনো যাবে না।
          </p>
        </div>
        <div className="ml-auto grid grid-cols-3 gap-2 text-center">
          <Stat label="Available" value={available} />
          <Stat label="Requested" value={requested} />
          <Stat label="Remaining" value={Math.max(0, available - requested)} tone={shortage ? "danger" : undefined} />
        </div>
      </header>

      <div className="space-y-2">
        {rows.map((r) => {
          const a = byId.get(r.agentId);
          return (
            <div key={r.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2">
              <Select value={r.agentId} onValueChange={(v) => update(r.key, { agentId: v })}>
                <SelectTrigger className="h-11 w-full sm:w-[280px]">
                  <SelectValue placeholder="এজেন্ট (নাম / Employee ID)" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((ag) => (
                    <SelectItem key={ag.id} value={ag.id}>
                      {ag.employeeId ? `${ag.employeeId} · ` : ""}{ag.name} — আজ {ag.today}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                aria-label="Number of leads"
                value={r.count}
                onChange={(e) => update(r.key, { count: e.target.value.replace(/\D/g, "").slice(0, 3) })}
                inputMode="numeric"
                placeholder="যেমন 25"
                className="h-11 w-28"
              />
              {a && <span className="text-xs text-muted-foreground">আজ ইতিমধ্যে {a.today}</span>}
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto"
                aria-label="Remove row"
                disabled={rows.length === 1}
                onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          );
        })}
        <Button variant="secondary" size="sm" onClick={() => setRows((rs) => [...rs, newRow()])}>
          <Plus className="size-4" /> আরেকজন এজেন্ট যোগ করুন
        </Button>
      </div>

      {dupAgents && <p className="text-xs text-destructive">একই এজেন্ট দুইবার বাছা হয়েছে — একটি সারিতে মোট সংখ্যা লিখুন।</p>}
      {quotaExceeded > 0 && <p className="text-xs font-medium text-destructive">দৈনিক ৫০ quota-এর বাইরে {quotaExceeded}টি অনুরোধ বাদ যাবে।</p>}
      {shortage > 0 && (
        <p className="text-xs font-medium text-destructive">
          Shortage: {shortage} লিড কম আছে। যতগুলো যোগ্য আছে ততগুলোই যাবে, সারির ক্রমে।
        </p>
      )}

      {confirming && valid.length > 0 && (
        <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm">
          <p className="mb-2 font-semibold">Preview — নিশ্চিত করুন</p>
          <ul className="space-y-1">
            {valid.map((v) => {
              const a = byId.get(v.agentId);
              return (
                <li key={v.agentId} className="flex justify-between gap-2">
                  <span>{a?.employeeId ? `${a.employeeId} ` : ""}{a?.name}</span>
                  <span className="tabular font-medium">{v.count}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-muted-foreground">
            মোট {requested} চাওয়া · {available} উপলব্ধ{shortage ? ` · ${shortage} কম` : ""}
          </p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {!confirming ? (
          <Button size="lg" disabled={!valid.length || dupAgents || available === 0 || alloc.data?.distributionOpen === false} onClick={() => setConfirming(true)}>
            Preview
          </Button>
        ) : (
          <>
            <Button size="lg" onClick={() => run.mutate()} disabled={run.isPending}>
              {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
              Confirm & assign
            </Button>
            <Button size="lg" variant="secondary" onClick={() => setConfirming(false)} disabled={run.isPending}>
              বদলান
            </Button>
          </>
        )}
      </div>

      {last && (
        <div className="rounded-lg border border-success/40 bg-success/5 p-3 text-sm">
          <p className="mb-1 flex items-center gap-1 font-semibold text-success">
            <CheckCircle2 className="size-4" /> Assignment result
          </p>
          <ul className="space-y-1">
            {last.map((r) => {
              const a = byId.get(r.agentId);
              return (
                <li key={r.agentId} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{a?.employeeId ? `${a.employeeId} ` : ""}{a?.name ?? "অজানা/নিষ্ক্রিয় এজেন্ট"}</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular">{r.assigned}/{r.requested}</span>
                    {r.assigned < r.requested && <StatusBadge label={`${r.requested - r.assigned} short`} tone="danger" />}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" | undefined }) {
  return (
    <div className="rounded-lg border border-border px-3 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`tabular text-lg font-bold ${tone === "danger" ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
