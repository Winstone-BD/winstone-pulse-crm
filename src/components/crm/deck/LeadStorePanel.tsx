import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Search, Send, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignSelectedLeads, listLeadStore } from "@/lib/lead-pool.functions";
import { useAdminToken } from "@/lib/local-session";

type Assignment = "all" | "unassigned" | "assigned" | "duplicate";
type Quality = "any" | "missing_reference" | "invalid_phone";
const ANY = "__any";

/**
 * Head Lead Store — every lead, permanently. Coordinators can select rows and
 * assign them manually; the server re-checks role, eligibility and ownership.
 */
export function LeadStorePanel({
  agents,
  canAssign,
  defaultAssignment = "all",
  defaultQuality = "any",
  title = "Head Lead Store",
}: {
  agents: { id: string; name: string }[];
  canAssign: boolean;
  defaultAssignment?: Assignment;
  defaultQuality?: Quality;
  title?: string;
}) {
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const listFn = useServerFn(listLeadStore);
  const assignFn = useServerFn(assignSelectedLeads);
  const [q, setQ] = useState("");
  const [assignment, setAssignment] = useState<Assignment>(defaultAssignment);
  const [quality, setQuality] = useState<Quality>(defaultQuality);
  const [status, setStatus] = useState<string>(ANY);
  const [agentFilter, setAgentFilter] = useState<string>(ANY);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");

  const filters = {
    q: q.trim() || undefined,
    assignment,
    quality,
    status: status === ANY ? null : (status as "pending"),
    agentId: agentFilter === ANY ? null : agentFilter,
  };
  const store = useQuery({
    queryKey: ["lead-store", adminToken ? "pin" : "session", filters],
    queryFn: () => listFn({ data: { adminToken, ...filters } }),
  });

  const assign = useMutation({
    mutationFn: () => assignFn({ data: { adminToken, agentId: target, leadIds: [...selected] } }),
    onSuccess: (r) => {
      toast.success(`${r.assigned}টি লিড দেওয়া হয়েছে${r.skipped ? ` · ${r.skipped}টি বাদ (আগে দেওয়া/অযোগ্য)` : ""}`);
      setSelected(new Set());
      for (const key of ["lead-store", "deck-kpis", "lead-pool", "crm-snapshot"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = store.data?.rows ?? [];
  const selectable = rows.filter((r) => !r.assigned_to && !r.duplicate && !r.invalidPhone);
  const chips = [
    q.trim() && { label: `খোঁজ: ${q.trim()}`, clear: () => setQ("") },
    assignment !== "all" && { label: assignment, clear: () => setAssignment("all") },
    quality !== "any" && { label: quality.replace("_", " "), clear: () => setQuality("any") },
    status !== ANY && { label: status, clear: () => setStatus(ANY) },
    agentFilter !== ANY && {
      label: agents.find((a) => a.id === agentFilter)?.name ?? "agent",
      clear: () => setAgentFilter(ANY),
    },
  ].filter(Boolean) as { label: string; clear: () => void }[];

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <section className="card-elevated space-y-3 p-4">
      <header className="flex flex-wrap items-baseline gap-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-xs text-muted-foreground">
          {store.isPending ? "…" : `${store.data?.total ?? 0}টি মিলেছে · ${rows.length}টি দেখানো`}
        </span>
      </header>

      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="নাম, মোবাইল, রেফারেন্স, কোম্পানি, সিরিয়াল"
            className="pl-8"
          />
        </div>
        {store.data?.full !== false && (
          <Select value={assignment} onValueChange={(v) => setAssignment(v as Assignment)}>
            <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">সব লিড</SelectItem>
              <SelectItem value="unassigned">Unassigned</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="duplicate">Duplicate</SelectItem>
            </SelectContent>
          </Select>
        )}
        <Select value={quality} onValueChange={(v) => setQuality(v as Quality)}>
          <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="any">সব ডেটা মান</SelectItem>
            <SelectItem value="missing_reference">রেফারেন্স নেই</SelectItem>
            <SelectItem value="invalid_phone">ভুল নম্বর</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="স্ট্যাটাস" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>সব স্ট্যাটাস</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="contacted">Contacted</SelectItem>
            <SelectItem value="follow_up">Follow-up</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>
        {agents.length > 0 && (
          <Select value={agentFilter} onValueChange={setAgentFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="এজেন্ট" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>সব এজেন্ট</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((c) => (
            <button
              key={c.label}
              onClick={c.clear}
              className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-0.5 text-xs"
            >
              {c.label} <X className="size-3" />
            </button>
          ))}
          <button
            className="text-xs text-muted-foreground underline"
            onClick={() => {
              setQ(""); setAssignment("all"); setQuality("any"); setStatus(ANY); setAgentFilter(ANY);
            }}
          >
            সব মুছুন
          </button>
        </div>
      )}

      {canAssign && (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card p-2">
          <span className="text-xs font-medium">{selected.size}টি নির্বাচিত</span>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(selectable.map((r) => r.id)))}>
            দেখানো সব অবণ্টিত ({selectable.length})
          </Button>
          <Select value={target} onValueChange={setTarget}>
            <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="এজেন্ট বাছুন" /></SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={!target || selected.size === 0 || assign.isPending} onClick={() => assign.mutate()}>
            {assign.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            Assign
          </Button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              {canAssign && <th className="px-2 py-2" />}
              <th className="px-2 py-2 text-left">Serial</th>
              <th className="px-2 py-2 text-left">Name</th>
              <th className="px-2 py-2 text-left">Mobile</th>
              <th className="px-2 py-2 text-left">Reference</th>
              <th className="px-2 py-2 text-left">Company / Address</th>
              <th className="px-2 py-2 text-left">Source</th>
              <th className="px-2 py-2 text-left">Assignment</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">Temp / Grade</th>
              <th className="px-2 py-2 text-left">Last call</th>
              <th className="px-2 py-2 text-left">Next follow-up</th>
              <th className="px-2 py-2 text-left">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const can = !r.assigned_to && !r.duplicate && !r.invalidPhone;
              const overdue = r.nextFollowUp && new Date(r.nextFollowUp).getTime() < Date.now();
              return (
                <tr key={r.id} className="border-t border-border/70 align-top">
                  {canAssign && (
                    <td className="px-2 py-2">
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.name}`}
                        className="size-4 accent-[var(--primary)]"
                        disabled={!can}
                        checked={selected.has(r.id)}
                        onChange={() => toggle(r.id)}
                      />
                    </td>
                  )}
                  <td className="px-2 py-2 text-xs text-muted-foreground">{r.serial_no ?? "—"}</td>
                  <td className="px-2 py-2 font-medium">{r.name}</td>
                  <td className="tabular px-2 py-2">
                    {r.phone_number}
                    {r.invalidPhone && <span className="ml-1 text-[10px] font-bold text-destructive">INVALID</span>}
                  </td>
                  <td className="px-2 py-2">{r.reference_by || <span className="text-warning">নেই</span>}</td>
                  <td className="px-2 py-2 text-xs">{[r.company, r.address].filter(Boolean).join(" · ") || "—"}</td>
                  <td className="px-2 py-2 text-xs">{r.source}</td>
                  <td className="px-2 py-2 text-xs">
                    {r.duplicate ? (
                      <span className="font-semibold text-muted-foreground">Duplicate</span>
                    ) : r.assigned_to ? (
                      <span>{r.agentName ?? "Agent"}{r.work_date ? ` · ${r.work_date}` : ""}</span>
                    ) : (
                      <span className="font-semibold text-warning">UNASSIGNED</span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs">{r.status}</td>
                  <td className="px-2 py-2 text-xs">{[r.temperature, r.grade].filter(Boolean).join(" / ") || "—"}</td>
                  <td className="px-2 py-2 text-xs">
                    {r.last_call_at ? new Date(r.last_call_at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" }) : "—"}
                  </td>
                  <td className={`px-2 py-2 text-xs ${overdue ? "font-semibold text-destructive" : ""}`}>
                    {r.nextFollowUp
                      ? `${new Date(r.nextFollowUp).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}${overdue ? " · OVERDUE" : ""}`
                      : "—"}
                  </td>
                  <td className="px-2 py-2 text-xs">
                    {new Date(r.created_at).toLocaleDateString("en-GB", { timeZone: "Asia/Dhaka" })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {store.isError && <p className="py-3 text-xs text-destructive">{(store.error as Error).message}</p>}
        {!store.isPending && rows.length === 0 && !store.isError && (
          <p className="py-6 text-center text-xs text-muted-foreground">এই ফিল্টারে কোনো লিড নেই।</p>
        )}
      </div>
    </section>
  );
}
