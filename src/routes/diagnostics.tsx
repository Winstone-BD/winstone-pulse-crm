import { createFileRoute } from "@tanstack/react-router";
import { Activity, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
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
  const refresh = () => {
    setReloads(readReloads());
    setLoads(readLoads());
  };
  useEffect(refresh, []);

  const clear = () => {
    if (!confirm("এই ডিভাইসের রিলোড রেকর্ড মুছবেন?")) return;
    localStorage.removeItem(RELOAD_KEY);
    refresh();
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
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={refresh}>
            <RefreshCw className="size-4" /> রিফ্রেশ
          </Button>
          <Button variant="outline" size="sm" onClick={clear} disabled={!reloads.length}>
            <Trash2 className="size-4" /> মুছুন
          </Button>
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
                  <th className="p-2">পেজ</th>
                  <th className="p-2">রিলোড হয়েছিল</th>
                  <th className="p-2">বিস্তারিত</th>
                </tr>
              </thead>
              <tbody>
                {reloads.map((r, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <td className="p-2 whitespace-nowrap">{new Date(r.at).toLocaleString("en-GB", { timeZone: "Asia/Dhaka" })}</td>
                    <td className="p-2">{KIND_LABEL[r.kind] ?? r.kind}</td>
                    <td className="p-2 font-mono text-xs">{r.page}</td>
                    <td className="p-2">{r.reloaded ? "হ্যাঁ" : "না"}</td>
                    <td className="p-2 break-all font-mono text-xs text-muted-foreground">{r.detail || "—"}</td>
                  </tr>
                ))}
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
