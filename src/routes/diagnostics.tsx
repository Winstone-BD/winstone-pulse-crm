import { createFileRoute } from "@tanstack/react-router";
import { Activity, CheckCircle2, Copy, Download, Eye, Filter, Layers, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { type LoadRecord, readLoads } from "@/lib/load-perf";

export const Route = createFileRoute("/diagnostics")({
  head: () => ({
    meta: [
      { title: "Page-load diagnostics — Winstone CRM" },
      { name: "description", content: "Staff-only review of failed page loads and automatic reloads on this device." },
      { property: "og:title", content: "Page-load diagnostics — Winstone CRM" },
      { property: "og:description", content: "Failed page loads and automatic reload records for staff." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DiagnosticsPage,
});

type ReloadEntry = { at: string; kind: string; detail: string; page: string; reloaded: boolean };
const RELOAD_KEY = "winstone-reload-log";
const LIVE_INTERVAL_MS = 10_000;

const KIND_LABEL: Record<string, string> = {
  "preload-error": "ফাইল আগে লোড হয়নি",
  "script-load-failed": "স্ক্রিপ্ট লোড ব্যর্থ",
  "module-error": "মডিউল ত্রুটি",
  "import-rejected": "পেজ অংশ লোড ব্যর্থ",
  "fallback-shown": "Refresh বাটন দেখানো হয়েছে",
  "recovered-after-reload": "রিলোডের পর ঠিক হয়েছে",
};

const STATUS_OPTIONS = [
  { value: "all", label: "সব" },
  { value: "unresolved", label: "শুধু অমীমাংসিত" },
  { value: "resolved", label: "শুধু ঠিক হয়েছে" },
] as const;

const RANGE_OPTIONS = [
  { value: "1h", label: "শেষ ১ ঘণ্টা" },
  { value: "24h", label: "শেষ ২৪ ঘণ্টা" },
  { value: "7d", label: "শেষ ৭ দিন" },
  { value: "all", label: "সব সময়" },
] as const;

type StatusFilter = (typeof STATUS_OPTIONS)[number]["value"];
type RangeFilter = (typeof RANGE_OPTIONS)[number]["value"];

const RANGE_MS: Record<Exclude<RangeFilter, "all">, number> = {
  "1h": 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

function readReloads(): ReloadEntry[] {
  try {
    return (JSON.parse(localStorage.getItem(RELOAD_KEY) ?? "[]") as ReloadEntry[]).slice().reverse();
  } catch {
    return [];
  }
}

/** A failure is resolved when a "recovered-after-reload" entry exists at or after it. */
function isResolved(entry: ReloadEntry, all: ReloadEntry[]): boolean {
  if (entry.kind === "recovered-after-reload") return true;
  const t = new Date(entry.at).getTime();
  return all.some((e) => e.kind === "recovered-after-reload" && new Date(e.at).getTime() >= t);
}

function entryKey(e: ReloadEntry): string {
  return `${e.at}|${e.kind}|${e.page}`;
}

/** Group key for repeated errors of the same kind on the same page. */
function groupKey(e: ReloadEntry): string {
  return `${e.kind}|${e.page}`;
}

type ErrorGroup = {
  key: string;
  kind: string;
  page: string;
  count: number;
  lastAt: string;
  entries: ReloadEntry[];
};

/** Group entries by kind+page, most recent group first. */
function groupEntries(entries: ReloadEntry[]): ErrorGroup[] {
  const map = new Map<string, ErrorGroup>();
  for (const e of entries) {
    const key = groupKey(e);
    const g = map.get(key);
    if (g) {
      g.count += 1;
      g.entries.push(e);
      if (new Date(e.at).getTime() > new Date(g.lastAt).getTime()) g.lastAt = e.at;
    } else {
      map.set(key, { key, kind: e.kind, page: e.page, count: 1, lastAt: e.at, entries: [e] });
    }
  }
  return [...map.values()].sort((a, b) => new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime());
}

function matchRange(at: string | number, range: RangeFilter): boolean {
  if (range === "all") return true;
  const t = new Date(at).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t <= RANGE_MS[range];
}

function dhakaTime(iso: string | number): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString("en-GB", { timeZone: "Asia/Dhaka" });
}

function csvCell(value: string): string {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function buildCsv(rows: string[][]): string {
  return "\uFEFF" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DiagnosticsPage() {
  return (
    <AppShell>
      <RoleGate
        allow={["authority", "coordinator", "agent"]}
        icon={<Activity className="size-7" />}
        title="পেজ-লোড ডায়াগনস্টিক্স"
        description="শুধু স্টাফদের জন্য — সাইন ইন করুন।"
      >
        <Board />
      </RoleGate>
    </AppShell>
  );
}

function Board() {
  const [reloads, setReloads] = useState<ReloadEntry[]>([]);
  const [loads, setLoads] = useState<LoadRecord[]>([]);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("all");
  const [alertDismissed, setAlertDismissed] = useState<string | null>(null);
  const [selected, setSelected] = useState<ReloadEntry | null>(null);
  const knownUnresolved = useRef<Set<string> | null>(null);

  const refresh = () => {
    const next = readReloads();
    setReloads(next);
    setLoads(readLoads());
    setLastSync(new Date());

    // Alert when a NEW unresolved error appears (live monitoring).
    const currentUnresolved = next.filter((r) => r.kind !== "recovered-after-reload" && !isResolved(r, next));
    if (knownUnresolved.current === null) {
      // First load of the page: baseline only, no toast flood for old records.
      knownUnresolved.current = new Set(currentUnresolved.map(entryKey));
    } else {
      for (const u of currentUnresolved) {
        const key = entryKey(u);
        if (!knownUnresolved.current.has(key)) {
          knownUnresolved.current.add(key);
          toast.error("নতুন অমীমাংসিত এরর", {
            description: `${KIND_LABEL[u.kind] ?? u.kind} · ${u.page} · ${dhakaTime(u.at)}`,
            duration: 15000,
          });
        }
      }
    }
  };

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, LIVE_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clear = () => {
    if (!confirm("এই ডিভাইসের রিলোড রেকর্ড মুছবেন?")) return;
    localStorage.removeItem(RELOAD_KEY);
    knownUnresolved.current = null;
    setAlertDismissed(null);
    refresh();
  };

  const failures = reloads.filter((r) => r.kind !== "recovered-after-reload");
  const unresolved = failures.filter((r) => !isResolved(r, reloads));
  const recovered = reloads.filter((r) => r.kind === "recovered-after-reload").length;

  // Latest unresolved entry key — used to dismiss the banner until a new one appears.
  const latestUnresolvedKey = unresolved.length ? entryKey(unresolved[0]!) : null;
  const showAlert = unresolved.length > 0 && latestUnresolvedKey !== alertDismissed;

  const filteredReloads = reloads.filter((r) => {
    if (!matchRange(r.at, rangeFilter)) return false;
    if (statusFilter === "all") return true;
    const ok = isResolved(r, reloads);
    return statusFilter === "resolved" ? ok : !ok;
  });
  const filteredLoads = loads.filter((l) => matchRange(l.at, rangeFilter));

  // Grouped view of repeated unresolved errors (kind + page), with count and last occurrence.
  const unresolvedGroups = groupEntries(
    unresolved.filter((r) => matchRange(r.at, rangeFilter)),
  );

  const exportCsv = () => {
    const rows: string[][] = [
      ["সময় (ঢাকা)", "ধরন", "অবস্থা", "পেজ", "রিলোড হয়েছিল", "বিস্তারিত"],
      ...filteredReloads.map((r) => [
        dhakaTime(r.at),
        KIND_LABEL[r.kind] ?? r.kind,
        isResolved(r, reloads) ? "ঠিক হয়েছে" : "অমীমাংসিত",
        r.page,
        r.reloaded ? "হ্যাঁ" : "না",
        r.detail || "",
      ]),
      [],
      ["ড্যাশবোর্ড লোড — সময় (ঢাকা)", "মোট সময় (সেকেন্ড)", "ধাপসমূহ"],
      ...filteredLoads.map((l) => [
        dhakaTime(l.at),
        (l.ms / 1000).toFixed(2),
        l.steps.map((s) => `${s.key} ${(s.ms / 1000).toFixed(1)}s`).join(" | "),
      ]),
    ];
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`winstone-diagnostics-${stamp}.csv`, buildCsv(rows));
    toast.success("CSV ডাউনলোড শুরু হয়েছে", {
      description: `${filteredReloads.length}টি ব্যর্থতা ও ${filteredLoads.length}টি লোড রেকর্ড অন্তর্ভুক্ত`,
    });
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">পেজ-লোড ডায়াগনস্টিক্স</h1>
          <p className="text-sm text-muted-foreground">
            এই ডিভাইসে রাখা শেষ ২০টি ব্যর্থ লোড/অটো-রিলোড এবং শেষ ১০টি ড্যাশবোর্ড লোড সময়।
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
              <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
            </span>
            লাইভ — প্রতি ১০ সেকেন্ডে হালনাগাদ
            {lastSync && (
              <span className="tabular-nums">
                · {lastSync.toLocaleTimeString("en-GB", { timeZone: "Asia/Dhaka" })}
              </span>
            )}
          </span>
          <Button variant="secondary" size="sm" onClick={refresh}>
            <RefreshCw className="size-4" /> রিফ্রেশ
          </Button>
          <Button variant="outline" size="sm" onClick={clear} disabled={!reloads.length}>
            <Trash2 className="size-4" /> মুছুন
          </Button>
        </div>
      </div>

      {showAlert && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
          <TriangleAlert className="size-5 shrink-0 text-destructive" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-destructive">
              {unresolved.length}টি অমীমাংসিত এরর আছে — মনোযোগ দরকার
            </p>
            <p className="text-sm text-muted-foreground">
              নতুন এরর এলে এই পেজে সরাসরি সতর্কবার্তা দেখা যাবে; নিচের তালিকায় বিস্তারিত আছে।
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusFilter("unresolved");
              setAlertDismissed(latestUnresolvedKey);
            }}
          >
            অমীমাংসিত দেখুন
          </Button>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TriangleAlert className="size-4" /> মোট ব্যর্থতা
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums">{failures.length}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4">
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-4" /> সফলভাবে ঠিক হয়েছে
          </div>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">{recovered}</p>
          <p className="text-xs text-muted-foreground">রিলোডের পর পেজ স্বাভাবিক — এরর নয়</p>
        </div>
        <div
          className={`rounded-2xl border p-4 ${
            unresolved.length
              ? "border-destructive/40 bg-destructive/5"
              : "border-border bg-card"
          }`}
        >
          <div
            className={`flex items-center gap-2 text-sm ${
              unresolved.length ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            <TriangleAlert className="size-4" /> অমীমাংসিত এরর
          </div>
          <p
            className={`mt-1 text-2xl font-bold tabular-nums ${
              unresolved.length ? "text-destructive" : ""
            }`}
          >
            {unresolved.length}
          </p>
          <p className="text-xs text-muted-foreground">
            {unresolved.length ? "যেগুলোর পর ঠিক হয়েছে এমন রেকর্ড নেই" : "সব ব্যর্থতা সমাধান হয়েছে"}
          </p>
        </div>
      </div>

      {unresolvedGroups.length > 0 && (
        <section className="rounded-2xl border border-destructive/30 bg-card p-4">
          <h2 className="mb-1 flex items-center gap-2 font-semibold">
            <Layers className="size-4 text-destructive" /> পুনরাবৃত্ত অমীমাংসিত এরর ({unresolvedGroups.length}টি গ্রুপ)
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            একই ধরনের ও একই পেজের এরর একসাথে — কতবার ঘটেছে ও সর্বশেষ কখন।
          </p>
          <div className="space-y-2">
            {unresolvedGroups.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setSelected(g.entries[0] ?? null)}
                className="flex w-full flex-wrap items-center gap-3 rounded-xl border border-border bg-background/40 p-3 text-left transition-colors hover:border-destructive/40"
              >
                <Badge variant="destructive" className="tabular-nums">{g.count}×</Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{KIND_LABEL[g.kind] ?? g.kind}</p>
                  <p className="truncate font-mono text-xs text-muted-foreground">{g.page}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  <p>সর্বশেষ</p>
                  <p className="tabular-nums">{dhakaTime(g.lastAt)}</p>
                </div>
                <Eye className="size-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-border bg-card p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">
            ব্যর্থ লোড ও অটো-রিলোড ({filteredReloads.length}
            {filteredReloads.length !== reloads.length && <span className="text-muted-foreground"> / {reloads.length}</span>})
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Filter className="size-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="h-9 w-[170px]">
                <SelectValue placeholder="অবস্থা" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={rangeFilter} onValueChange={(v) => setRangeFilter(v as RangeFilter)}>
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue placeholder="সময়" />
              </SelectTrigger>
              <SelectContent>
                {RANGE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="secondary" size="sm" onClick={exportCsv} disabled={!filteredReloads.length && !filteredLoads.length}>
              <Download className="size-4" /> CSV
            </Button>
          </div>
        </div>
        {filteredReloads.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {reloads.length === 0 ? "কোনো ব্যর্থ লোড রেকর্ড নেই।" : "এই ফিল্টারে কোনো রেকর্ড নেই।"}
          </p>
        ) : (
          <div className="table-scroll">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="p-2">সময়</th>
                  <th className="p-2">ধরন</th>
                  <th className="p-2">অবস্থা</th>
                  <th className="p-2">পেজ</th>
                  <th className="p-2">রিলোড হয়েছিল</th>
                  <th className="p-2">বিস্তারিত</th>
                </tr>
              </thead>
              <tbody>
                {filteredReloads.map((r, i) => {
                  const ok = isResolved(r, reloads);
                  return (
                    <tr
                      key={i}
                      className="cursor-pointer border-t border-border align-top transition-colors hover:bg-muted/40"
                      onClick={() => setSelected(r)}
                      title="বিস্তারিত দেখুন"
                    >
                      <td className="p-2 whitespace-nowrap">{dhakaTime(r.at)}</td>
                      <td className="p-2">{KIND_LABEL[r.kind] ?? r.kind}</td>
                      <td className="p-2">
                        {ok ? (
                          <Badge variant="outline" className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                            ঠিক হয়েছে
                          </Badge>
                        ) : (
                          <Badge variant="destructive">অমীমাংসিত</Badge>
                        )}
                      </td>
                      <td className="p-2 font-mono text-xs">{r.page}</td>
                      <td className="p-2">{r.reloaded ? "হ্যাঁ" : "না"}</td>
                      <td className="p-2 break-all font-mono text-xs text-muted-foreground">{r.detail || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold">
          সাম্প্রতিক ড্যাশবোর্ড লোড ({filteredLoads.length}
          {filteredLoads.length !== loads.length && <span className="text-muted-foreground"> / {loads.length}</span>})
        </h2>
        {filteredLoads.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {loads.length === 0 ? "কোনো লোড রেকর্ড নেই।" : "এই সময়সীমায় কোনো লোড রেকর্ড নেই।"}
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {filteredLoads.map((l, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 border-t border-border pt-1">
                <span>{dhakaTime(l.at)}</span>
                <span className="font-mono">
                  {(l.ms / 1000).toFixed(1)}s · {l.steps.map((s) => `${s.key} ${(s.ms / 1000).toFixed(1)}s`).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
