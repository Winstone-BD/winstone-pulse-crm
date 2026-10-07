import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Building2, CalendarCheck, ChevronRight, MapPin, Phone, Search, TicketCheck, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { AppShell } from "@/components/crm/AppShell";
import { Input } from "@/components/ui/input";
import { useAdminToken } from "@/lib/local-session";
import { getProjectReport } from "@/lib/project-reports.functions";
import { listInventory } from "@/lib/inventory.functions";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "প্রজেক্ট ডিরেক্টরি — Winstone CRM" },
      { name: "description", content: "প্রতিটি প্রজেক্টের লিড, কল, সাইট ভিজিট ও বুকিং চাহিদা এক নজরে।" },
      { property: "og:title", content: "প্রজেক্ট ডিরেক্টরি — Winstone CRM" },
      { property: "og:description", content: "প্রজেক্টভিত্তিক বাস্তব চাহিদা ও বুকিং কনভার্সন।" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ProjectsPage,
});

function dhakaMonth() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit" }).format(new Date());
}

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 1000) / 10 : 0);

function ProjectsPage() {
  const adminToken = useAdminToken();
  const fetchReport = useServerFn(getProjectReport);
  const [month, setMonth] = useState(dhakaMonth);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("active");

  const report = useQuery({
    queryKey: ["projects-directory", month, adminToken ? "pin" : "session"],
    queryFn: () => fetchReport({ data: { adminToken, period: "month", key: month } }),
    staleTime: 30_000,
  });

  const fetchInventory = useServerFn(listInventory);
  const inventory = useQuery({
    queryKey: ["projects-inventory", adminToken ? "pin" : "session"],
    queryFn: () => fetchInventory({ data: { adminToken, includeInactive: true } }),
    staleTime: 60_000,
  });
  const details = useMemo(() => new Map((inventory.data?.items ?? []).map((i) => [i.id, i])), [inventory.data]);

  const rows = useMemo(() => {
    const all = report.data?.rows ?? [];
    return all.filter(
      (r) =>
        (status === "all" || (status === "active" ? r.active : !r.active)) &&
        r.project.toLowerCase().includes(q.trim().toLowerCase()),
    );
  }, [report.data, q, status]);

  const totals = rows.reduce(
    (t, r) => ({ leads: t.leads + r.leads, calls: t.calls + r.calls, visits: t.visits + r.siteVisits, bookings: t.bookings + r.bookings }),
    { leads: 0, calls: 0, visits: 0, bookings: 0 },
  );
  const chart = rows.map((r) => ({ name: r.project.length > 16 ? `${r.project.slice(0, 15)}…` : r.project, লিড: r.leads, কল: r.calls, "সাইট ভিজিট": r.siteVisits, বুকিং: r.bookings }));
  const conversion = [...rows].map((r) => ({ name: r.project, rate: pct(r.bookings, r.leads) })).sort((a, b) => b.rate - a.rate);
  const maxRate = Math.max(1, ...conversion.map((c) => c.rate));

  const kpis = [
    { label: "মোট প্রজেক্ট", value: rows.length, icon: Building2, tone: "text-primary bg-primary/10" },
    { label: "আগ্রহী লিড", value: totals.leads, icon: Users, tone: "text-sky-400 bg-sky-400/10" },
    { label: "কল রিপোর্ট", value: totals.calls, icon: Phone, tone: "text-amber-400 bg-amber-400/10" },
    { label: "সাইট ভিজিট", value: totals.visits, icon: CalendarCheck, tone: "text-violet-400 bg-violet-400/10" },
    { label: "বুকিং", value: totals.bookings, icon: TicketCheck, tone: "text-emerald-400 bg-emerald-400/10" },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl space-y-5 p-4">
        <header className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">প্রজেক্ট ডিরেক্টরি</h1>
            <p className="text-sm text-muted-foreground">Winstone Properties — সংরক্ষিত কল রিপোর্ট থেকে বাস্তব চাহিদা</p>
          </div>
          <Link to="/inventory" className="text-sm text-primary hover:underline">প্রজেক্ট তালিকা পরিচালনা →</Link>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {kpis.map((k) => (
            <div key={k.label} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
              <span className={`grid size-10 place-items-center rounded-full ${k.tone}`}><k.icon className="size-5" /></span>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-2xl font-bold tabular-nums">{k.value.toLocaleString("en-IN")}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="প্রজেক্ট খুঁজুন…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="স্ট্যাটাস">
            <option value="active">চালু প্রজেক্ট</option>
            <option value="inactive">বন্ধ প্রজেক্ট</option>
            <option value="all">সব</option>
          </select>
          <Input type="month" className="sm:w-44" value={month} onChange={(e) => setMonth(e.target.value)} aria-label="মাস" />
        </div>

        {report.isPending ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">লোড হচ্ছে…</div>
        ) : report.error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">{(report.error as Error).message}</div>
        ) : !rows.length ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">কোনো প্রজেক্ট পাওয়া যায়নি। ইনভেন্টরি পেজে প্রজেক্ট যোগ করুন।</div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {rows.map((r) => (
                <article key={r.projectId} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <span className="grid size-14 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Building2 className="size-7" /></span>
                    <div className="min-w-0 flex-1">
                      <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${r.active ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                        {r.active ? "চালু" : "বন্ধ"}
                      </span>
                      <h2 className="mt-1 truncate text-base font-bold">{r.project}</h2>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="size-3" /> {details.get(r.projectId)?.location || "ঠিকানা যোগ করা হয়নি"}</p>
                    </div>
                    <ChevronRight className="size-4 text-muted-foreground" />
                  </div>
                  <div className="mt-4 grid grid-cols-2 divide-x divide-border text-center">
                    <Stat v={details.get(r.projectId)?.total_units ?? null} l="মোট ইউনিট" />
                    <Stat v={details.get(r.projectId)?.available_units ?? null} l="উপলভ্য" accent />
                  </div>
                  <div className="mt-3 grid grid-cols-4 divide-x divide-border border-y border-border py-3 text-center">
                    <Stat v={r.leads} l="লিড" />
                    <Stat v={r.calls} l="কল" />
                    <Stat v={r.siteVisits} l="ভিজিট" />
                    <Stat v={r.bookings} l="বুকিং" accent />
                  </div>
                  <p className="pt-3 text-center text-sm"><span className="font-bold">{pct(r.bookings, r.leads)}%</span> <span className="text-muted-foreground">কনভার্সন রেট</span></p>
                </article>
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <section className="rounded-xl border border-border bg-card p-4 lg:col-span-3">
                <h3 className="mb-3 font-semibold">প্রজেক্ট চাহিদা তুলনা</h3>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chart}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" strokeOpacity={0.4} vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
                      <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="লিড" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="কল" fill="#f59e0b" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="সাইট ভিজিট" fill="#22c55e" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="বুকিং" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
              <section className="rounded-xl border border-border bg-card p-4 lg:col-span-2">
                <h3 className="mb-3 font-semibold">বুকিং কনভার্সন রেট</h3>
                <ul className="space-y-3">
                  {conversion.map((c) => (
                    <li key={c.name} className="grid grid-cols-[minmax(0,9rem)_1fr_3rem] items-center gap-2 text-sm">
                      <span className="truncate text-muted-foreground">{c.name}</span>
                      <span className="h-3 rounded bg-muted"><span className="block h-3 rounded bg-primary" style={{ width: `${(c.rate / maxRate) * 100}%` }} /></span>
                      <span className="text-right tabular-nums">{c.rate}%</span>
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ v, l, accent }: { v: number | null; l: string; accent?: boolean }) {
  return (
    <div>
      <p className={`text-lg font-bold tabular-nums ${accent ? "text-emerald-400" : ""}`}>{v ?? "—"}</p>
      <p className="text-[11px] text-muted-foreground">{l}</p>
    </div>
  );
}
