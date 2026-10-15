import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Globe, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

import { AppShell } from "@/components/crm/AppShell";
import { PageHeader } from "@/components/crm/PageHeader";
import { RoleGate } from "@/components/crm/RoleGate";
import { listWebsiteEnquiries } from "@/lib/enquiries.functions";
import { useAdminToken } from "@/lib/local-session";

export const Route = createFileRoute("/enquiries")({
  head: () => ({
    meta: [
      { title: "Website enquiries — Winstone Pulse" },
      { name: "description", content: "Buyer enquiries from winstonebd.com by date, budget, source and lead status." },
      { property: "og:title", content: "Website enquiries — Winstone Pulse" },
      { property: "og:description", content: "Track which posts and pages bring buyers in." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <AppShell>
      <RoleGate surface="hq" allow={["authority"]} icon={<Globe className="size-7" />}
        title="Website enquiries" description="Only HQ / IT can view website enquiries.">
        <Dashboard />
      </RoleGate>
    </AppShell>
  );
}

const BANDS: [string, number, number][] = [
  ["Under ৳50 lakh", 0, 5_000_000],
  ["৳50 lakh – 1 crore", 5_000_000, 10_000_000],
  ["৳1 – 2 crore", 10_000_000, 20_000_000],
  ["Over ৳2 crore", 20_000_000, Infinity],
];
const band = (max: number | null, min: number | null) => {
  const v = max ?? min;
  if (v == null) return "Not given";
  return BANDS.find(([, lo, hi]) => v >= lo && v < hi)?.[0] ?? "Not given";
};
const dhakaDay = (iso: string) => new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Dhaka" });
const taka = (n: number | null) => (n == null ? "—" : `৳${n.toLocaleString("en-IN")}`);

function Tally({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">No data</p> : (
        <ul className="space-y-1 text-sm">
          {rows.map(([k, v]) => (
            <li key={k} className="flex justify-between gap-2"><span className="truncate text-muted-foreground">{k}</span><span className="font-medium">{v}</span></li>
          ))}
        </ul>
      )}
    </div>
  );
}

function count<T>(items: T[], key: (t: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const i of items) m.set(key(i), (m.get(key(i)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function Dashboard() {
  const adminToken = useAdminToken();
  const list = useServerFn(listWebsiteEnquiries);
  const [days, setDays] = useState(30);
  const q = useQuery({ queryKey: ["website-enquiries", days], queryFn: () => list({ data: { adminToken, days } }), refetchInterval: 60_000 });
  const rows = useMemo(() => q.data ?? [], [q.data]);

  return (
    <div className="space-y-5">
      <PageHeader title="Website enquiries" description="Every buyer enquiry from winstonebd.com, landing unassigned in LeadHub Nexus." />
      <div className="flex flex-wrap items-center gap-2">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)}
            className={`rounded-full border px-3 py-1 text-sm ${days === d ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground"}`}>
            Last {d} days
          </button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground">{rows.length} enquiries</span>
      </div>
      {q.isPending ? <div className="flex justify-center py-10"><Loader2 className="size-6 animate-spin" /></div>
        : q.isError ? <p className="text-sm text-destructive">{(q.error as Error).message}</p>
        : rows.length === 0 ? <p className="rounded-xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">No website enquiries yet. They appear here once winstonebd.com sends them.</p>
        : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Tally title="By day" rows={count(rows, (r) => dhakaDay(r.created_at)).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 10)} />
              <Tally title="By budget" rows={count(rows, (r) => band(r.budget_max_bdt, r.budget_min_bdt))} />
              <Tally title="By source / post" rows={count(rows, (r) => [r.utm_source, r.utm_campaign].filter(Boolean).join(" · ") || "Direct / untagged").slice(0, 10)} />
              <Tally title="By lead status" rows={count(rows, (r) => (r.assigned ? r.lead_status ?? "unknown" : "unassigned"))} />
            </div>
            <div className="table-scroll rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground">
                  <tr>{["Date", "Name", "Phone", "Project", "Budget", "Facing", "Amenities", "Source", "Status", "Stage"].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-2">{dhakaDay(r.created_at)}</td>
                      <td className="px-3 py-2">{r.customer_name}</td>
                      <td className="px-3 py-2">{r.phone}</td>
                      <td className="px-3 py-2">{r.project ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2">{taka(r.budget_min_bdt)} – {taka(r.budget_max_bdt)}</td>
                      <td className="px-3 py-2">{r.facing?.replace("_", "-") ?? "—"}</td>
                      <td className="px-3 py-2">{r.amenities.join(", ") || "—"}</td>
                      <td className="px-3 py-2">{r.utm_source ?? "—"}{r.utm_campaign ? ` · ${r.utm_campaign}` : ""}</td>
                      <td className="px-3 py-2">{r.assigned ? r.lead_status : "unassigned"}</td>
                      <td className="px-3 py-2">{r.stage ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
    </div>
  );
}
