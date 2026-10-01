import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardList, Loader2, PhoneIncoming, PhoneOutgoing, Search } from "lucide-react";
import { useState } from "react";

import { CallReportSummary } from "@/components/crm/CallReportSummary";
import { LeadDossier } from "@/components/crm/LeadDossier";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_LABEL_CLIENT } from "@/lib/call-categories";
import { listCallReports } from "@/lib/call-reports.functions";
import { buildTimeline, useSnapshot } from "@/lib/crm-data";
import { clockTime } from "@/lib/crm-format";
import { useAdminToken } from "@/lib/local-session";

const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABEL_CLIENT);

/**
 * Every call report, filterable, with the lead one tap away.
 *
 * Agents see their own reports and supervisors see the floor — the server
 * decides that, this panel only asks.
 */
export function CallReportsPanel() {
  const adminToken = useAdminToken();
  const fetchList = useServerFn(listCallReports);

  const [category, setCategory] = useState<string>("");
  const [direction, setDirection] = useState<"" | "outgoing" | "incoming">("");
  const [callState, setCallState] = useState<"" | "connected" | "not_connected">("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [agentId, setAgentId] = useState("");
  const [openLeadId, setOpenLeadId] = useState<string | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(false);

  // A calendar day is a Dhaka day — the whole floor works on that clock.
  const fromIso = fromDate ? `${fromDate}T00:00:00+06:00` : null;
  const toIso = toDate ? `${toDate}T23:59:59+06:00` : null;

  // The lead file is drawn from the shared snapshot the rest of the desk uses.
  const snapshot = useSnapshot();
  const openLead = snapshot.leads.find((lead) => lead.id === openLeadId) ?? null;

  const { data, isPending } = useQuery({
    queryKey: [
      "call-reports-list",
      adminToken ? "pin" : "session",
      category,
      direction,
      callState,
      search,
      fromIso,
      toIso,
      agentId,
    ],
    queryFn: () =>
      fetchList({
        data: {
          adminToken,
          category: category || null,
          direction: direction || null,
          callState: callState || null,
          search: search.trim() || null,
          fromIso,
          toIso,
          agentId: agentId || null,
        },
      }),
    refetchInterval: 60_000,
  });

  const allReports = data?.reports ?? [];
  // Submitted reports where the agent never picked an outcome (ফলাফল).
  const missing = allReports.filter((r) => r.status !== "pending" && !r.category);
  const missingByAgent = Object.entries(
    missing.reduce<Record<string, number>>((acc, r) => {
      const k = r.agent?.name ?? "অজানা এজেন্ট";
      acc[k] = (acc[k] ?? 0) + 1;
      return acc;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const reports = onlyMissing ? missing : allReports;
  // Agents only ever see their own reports, so they get no agent picker.
  const canFilterAgent = data ? data.scope !== "agent" && data.scope !== "none" : false;

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <ClipboardList className="size-5 text-primary" /> সব কল রিপোর্ট
        </h2>
        <p className="text-xs text-muted-foreground sm:text-sm">
          ফিল্টার করে দেখুন — নাম চাপলে সেই লিডের পুরো ফাইল খুলবে।
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs">ক্যাটাগরি</Label>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">সব</option>
            {CATEGORY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">কলের দিক</Label>
          <select
            value={direction}
            onChange={(event) => setDirection(event.target.value as typeof direction)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">সব</option>
            <option value="outgoing">আউটগোয়িং</option>
            <option value="incoming">ইনকামিং</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">কলের অবস্থা</Label>
          <select
            value={callState}
            onChange={(event) => setCallState(event.target.value as typeof callState)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">সব</option>
            <option value="connected">কথা হয়েছে</option>
            <option value="not_connected">কথা হয়নি</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-from" className="text-xs">
            তারিখ থেকে
          </Label>
          <Input
            id="report-from"
            type="date"
            value={fromDate}
            onChange={(event) => setFromDate(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="report-to" className="text-xs">
            তারিখ পর্যন্ত
          </Label>
          <Input
            id="report-to"
            type="date"
            value={toDate}
            onChange={(event) => setToDate(event.target.value)}
          />
        </div>
        {canFilterAgent ? (
          <div className="space-y-1.5">
            <Label className="text-xs">এজেন্ট</Label>
            <select
              value={agentId}
              onChange={(event) => setAgentId(event.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="">সব এজেন্ট</option>
              {(data?.agents ?? []).map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        <div className="space-y-1.5">
          <Label htmlFor="report-search" className="text-xs">
            নাম বা নম্বর
          </Label>
          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="report-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="খুঁজুন"
              className="pl-7"
            />
          </div>
        </div>
      </div>

      {!isPending ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold">
              ফলাফল বাছাই হয়নি: {missing.length}টি রিপোর্ট
            </p>
            {missing.length > 0 ? (
              <Button size="sm" variant={onlyMissing ? "default" : "outline"} onClick={() => setOnlyMissing((v) => !v)}>
                {onlyMissing ? "সব রিপোর্ট দেখুন" : "শুধু এগুলো দেখুন"}
              </Button>
            ) : null}
          </div>
          {missing.length === 0 ? (
            <p className="mt-1 text-xs text-muted-foreground">এই ফিল্টারে সব রিপোর্টে ফলাফল দেওয়া আছে।</p>
          ) : (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {missingByAgent.map(([name, n]) => (
                <li key={name}>
                  <Badge variant="destructive" className="text-[11px]">{name}: {n}টি অসম্পূর্ণ</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {!isPending ? <CallReportSummary reports={reports} /> : null}

      {isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> রিপোর্ট আনা হচ্ছে…
        </p>
      ) : reports.length === 0 ? (
        <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          এই ফিল্টারে কোনো রিপোর্ট নেই।
        </p>
      ) : (
        <ul className="space-y-2">
          {reports.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3"
            >
              <div className="min-w-0 max-w-full flex-1">
                <button
                  type="button"
                  disabled={!row.lead}
                  onClick={() => row.lead && setOpenLeadId(row.lead.id)}
                  className="block max-w-full truncate text-left text-sm font-semibold text-primary hover:underline disabled:text-foreground disabled:no-underline"
                >
                  {row.lead?.name ?? row.phone_number ?? "অজানা নম্বর"}
                </button>
                <p className="truncate text-xs text-muted-foreground">
                  {row.lead?.phone_number ?? row.phone_number ?? "—"}
                  {row.agent?.name ? ` · ${row.agent.name}` : ""}
                  {row.call_ended_at ? ` · ${clockTime(row.call_ended_at)}` : ""}
                  {` · ${row.duration_seconds ?? 0} সেকেন্ড`}
                </p>
                {row.summary ? (
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{row.summary}</p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="gap-1 text-[11px]">
                  {row.direction === "incoming" ? (
                    <PhoneIncoming className="size-3" />
                  ) : (
                    <PhoneOutgoing className="size-3" />
                  )}
                  {row.direction === "incoming" ? "ইনকামিং" : "আউটগোয়িং"}
                </Badge>
                <Badge variant={row.connected ? "default" : "secondary"} className="text-[11px]">
                  {row.connected ? "কথা হয়েছে" : "কথা হয়নি"}
                </Badge>
                {row.category ? (
                  <Badge variant="outline" className="text-[11px]">
                    {CATEGORY_LABEL_CLIENT[row.category] ?? row.category}
                  </Badge>
                ) : null}
                {row.status !== "pending" && !row.category ? (
                  <Badge variant="destructive" className="text-[11px]">ফলাফল নেই</Badge>
                ) : null}
                {row.status === "pending" ? (
                  <Badge variant="destructive" className="text-[11px]">
                    জমা হয়নি
                  </Badge>
                ) : null}
                {row.lead ? (
                  <Button size="sm" variant="secondary" onClick={() => setOpenLeadId(row.lead!.id)}>
                    লিড খুলুন
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}

      <LeadDossier
        lead={openLead}
        agents={snapshot.profiles}
        timeline={
          openLead
            ? buildTimeline(snapshot.calls, snapshot.messages, openLead.id, snapshot.events)
            : []
        }
        open={openLeadId !== null}
        onOpenChange={(next) => !next && setOpenLeadId(null)}
      />
    </section>
  );
}
