import { createFileRoute } from "@tanstack/react-router";
import { Activity, CheckCircle2, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  const refresh = () => {
    setReloads(readReloads());
    setLoads(readLoads());
    setLastSync(new Date());
  };
  useEffect(() => {
    refresh();
    const id = setInterval(refresh, LIVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const clear = () => {
    if (!confirm("এই ডিভাইসের রিলোড রেকর্ড মুছবেন?")) return;
    localStorage.removeItem(RELOAD_KEY);
    refresh();
  };

  const failures = reloads.filter((r) => r.kind !== "recovered-after-reload");
  const unresolved = failures.filter((r) => !isResolved(r, reloads));
  const recovered = reloads.filter((r) => r.kind === "recovered-after-reload").length;

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

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="mb-3 font-semibold">ব্যর্থ লোড ও অটো-রিলোড ({reloads.length})</h2>
        {reloads.length === 0 ? (
          <p className="text-sm text-muted-foreground">কোনো ব্যর্থ লোড রেকর্ড নেই।</p>
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
                {reloads.map((r, i) => {
                  const ok = isResolved(r, reloads);
                  return (
                    <tr key={i} className="border-t border-border align-top">
                      <td className="p-2 whitespace-nowrap">{new Date(r.at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</td>
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
        <h2 className="mb-3 font-semibold">সাম্প্রতিক ড্যাশবোর্ড লোড ({loads.length})</h2>
        {loads.length === 0 ? (
          <p className="text-sm text-muted-foreground">কোনো লোড রেকর্ড নেই।</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {loads.map((l, i) => (
              <li key={i} className="flex flex-wrap justify-between gap-2 border-t border-border pt-1">
                <span>{new Date(l.at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</span>
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
