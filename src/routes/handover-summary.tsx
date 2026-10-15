import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";

import { getHandoverSummary } from "@/lib/handover.functions";
import { getAdminToken } from "@/lib/local-session";

export const Route = createFileRoute("/handover-summary")({
  head: () => ({
    meta: [
      { title: "HQ Handover Summary — WINSTONE PULSE" },
      { name: "description", content: "Printable HQ summary of each lead's verified buyer progress, outstanding documents, payments and next steps." },
      { property: "og:title", content: "HQ Handover Summary — WINSTONE PULSE" },
      { property: "og:description", content: "Verified buyer progress and outstanding handover items per lead." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  ssr: false,
  component: Summary,
});

const STAGES = ["Interest", "Site visit", "Visit completed", "Booking", "HQ approved"];
const NEXT = [
  "Call and submit a report",
  "Complete the site visit and save the outcome",
  "Collect documents and record the booking",
  "Await HQ approval — no promises to the customer",
  "Book office appointment for down payment and agreement",
];

function Summary() {
  const run = useServerFn(getHandoverSummary);
  const q = useQuery({ queryKey: ["handover-summary"], queryFn: () => run({ data: { token: getAdminToken() } }) });
  const generated = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", dateStyle: "medium", timeStyle: "short" }).format(new Date());
  return (
    <main className="mx-auto max-w-6xl px-4 py-6 print:p-0">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">WINSTONE PULSE · HQ</p>
          <h1 className="text-2xl font-semibold">Handover summary</h1>
          <p className="text-sm text-muted-foreground">Generated {generated} (Asia/Dhaka) · ticks come only from saved CRM records</p>
        </div>
        <button onClick={() => window.print()} className="rounded-md border border-primary px-3 py-1.5 text-sm font-semibold text-primary print:hidden">Print / Save PDF</button>
      </header>
      {q.isError ? <p className="mt-4 text-sm text-destructive">{(q.error as Error).message}</p> : null}
      {q.isLoading ? <p className="mt-4 text-sm text-muted-foreground">Loading…</p> : null}
      {q.data && q.data.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No leads with a site visit or booking yet.</p> : null}
      {q.data && q.data.length > 0 ? (
        <div className="table-scroll mt-4">
          <table className="w-full min-w-[820px] border-collapse text-xs">
            <thead><tr>{["Lead", "Agent", "Verified stage", "Documents outstanding", "Payments outstanding", "Next step"].map((h) => <th key={h} className="border border-border bg-muted p-2 text-left">{h}</th>)}</tr></thead>
            <tbody>
              {q.data.map((r) => {
                const approved = r.booking?.approval === "approved";
                const stage = approved ? 4 : r.booking ? 3 : r.completed ? 2 : r.scheduled ? 1 : 0;
                return (
                  <tr key={r.id} className="break-inside-avoid">
                    <td className="border border-border p-2 align-top"><b>{r.name ?? "—"}</b><br />{r.phone}</td>
                    <td className="border border-border p-2 align-top">{r.agent ?? "Unassigned"}</td>
                    <td className="border border-border p-2 align-top">{STAGES[stage]}{r.booking?.project ? ` · ${r.booking.project}` : ""}</td>
                    <td className="border border-border p-2 align-top">{stage >= 2 ? "NID copy, photo, TIN (if applicable), nominee NID & photo — verify with customer" : "Not yet due"}</td>
                    <td className="border border-border p-2 align-top">{r.booking ? (approved ? "Down payment and instalment schedule — confirm via office receipt" : `Booking money awaiting HQ check (${r.booking.approval}); down payment; instalment schedule`) : "None until booking"}</td>
                    <td className="border border-border p-2 align-top">{NEXT[stage]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </main>
  );
}
