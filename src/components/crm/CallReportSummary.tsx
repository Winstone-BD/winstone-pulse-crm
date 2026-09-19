import { CalendarClock, PhoneIncoming, PhoneOutgoing, Timer, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { CATEGORY_LABEL_CLIENT } from "@/lib/call-categories";

type SummaryRow = {
  lead_id: string | null;
  lead: { id: string; name: string; phone_number: string } | null;
  phone_number: string | null;
  direction: "incoming" | "outgoing";
  connected: boolean;
  duration_seconds: number | null;
  follow_up_at: string | null;
  status: string;
  category: string | null;
};

function minutesLabel(seconds: number) {
  if (seconds < 60) return `${seconds} সেকেন্ড`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} মিনিট ${s} সেকেন্ড` : `${m} মিনিট`;
}

/**
 * The one-glance picture above the report list: how the calls went, how long
 * they lasted, how many follow-ups they produced and which leads they were on.
 * It reads the same filtered rows the list shows, so every number matches what
 * is listed underneath.
 */
export function CallReportSummary({ reports }: { reports: SummaryRow[] }) {
  const total = reports.length;
  const incoming = reports.filter((r) => r.direction === "incoming").length;
  const connected = reports.filter((r) => r.connected).length;
  const pending = reports.filter((r) => r.status === "pending").length;
  const seconds = reports.reduce((sum, r) => sum + (r.duration_seconds ?? 0), 0);
  const talked = reports.filter((r) => r.connected && (r.duration_seconds ?? 0) > 0);
  const avg = talked.length ? Math.round(seconds / talked.length) : 0;

  const now = Date.now();
  const followUps = reports.filter((r) => r.follow_up_at);
  const dueFollowUps = followUps.filter((r) => new Date(r.follow_up_at!).getTime() <= now).length;

  const categoryCounts = new Map<string, number>();
  for (const row of reports) {
    if (!row.category) continue;
    categoryCounts.set(row.category, (categoryCounts.get(row.category) ?? 0) + 1);
  }
  const topCategories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);

  type LeadStat = {
    key: string;
    name: string;
    phone: string;
    calls: number;
    connected: number;
    seconds: number;
    nextFollowUp: string | null;
  };
  const byLead = new Map<string, LeadStat>();
  for (const row of reports) {
    const key = row.lead?.id ?? row.lead_id ?? row.phone_number ?? "unknown";
    const stat =
      byLead.get(key) ??
      ({
        key,
        name: row.lead?.name ?? row.phone_number ?? "অজানা নম্বর",
        phone: row.lead?.phone_number ?? row.phone_number ?? "—",
        calls: 0,
        connected: 0,
        seconds: 0,
        nextFollowUp: null,
      } satisfies LeadStat);
    stat.calls += 1;
    if (row.connected) stat.connected += 1;
    stat.seconds += row.duration_seconds ?? 0;
    if (
      row.follow_up_at &&
      (!stat.nextFollowUp || new Date(row.follow_up_at) < new Date(stat.nextFollowUp))
    ) {
      stat.nextFollowUp = row.follow_up_at;
    }
    byLead.set(key, stat);
  }
  const topLeads = [...byLead.values()]
    .sort((a, b) => b.calls - a.calls || b.seconds - a.seconds)
    .slice(0, 6);

  if (total === 0) {
    return (
      <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        এই ফিল্টারে কোনো হিসাব দেখানোর মতো রিপোর্ট নেই।
      </p>
    );
  }

  const tiles = [
    { label: "মোট রিপোর্ট", value: `${total}`, hint: pending ? `${pending} টি জমা হয়নি` : "সব জমা" },
    {
      label: "কলের দিক",
      value: `${total - incoming} / ${incoming}`,
      hint: "আউটগোয়িং / ইনকামিং",
    },
    {
      label: "কথা হয়েছে",
      value: `${connected}`,
      hint: `${total - connected} টিতে কথা হয়নি`,
    },
    {
      label: "মোট সময়",
      value: minutesLabel(seconds),
      hint: avg ? `গড় ${minutesLabel(avg)}` : "গড় নেই",
    },
    {
      label: "ফলো-আপ",
      value: `${followUps.length}`,
      hint: dueFollowUps ? `${dueFollowUps} টির সময় হয়ে গেছে` : "সবগুলো সামনে",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-xl border bg-background p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{tile.label}</p>
            <p className="mt-1 text-lg font-bold tracking-tight">{tile.value}</p>
            <p className="text-[11px] text-muted-foreground">{tile.hint}</p>
          </div>
        ))}
      </div>

      {topCategories.length ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {topCategories.map(([value, count]) => (
            <Badge key={value} variant="outline" className="text-[11px]">
              {CATEGORY_LABEL_CLIENT[value] ?? value} · {count}
            </Badge>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border bg-background p-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Users className="size-4 text-primary" /> লিডভিত্তিক সারাংশ
        </p>
        <ul className="mt-2 space-y-1.5">
          {topLeads.map((lead) => (
            <li
              key={lead.key}
              className="flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm"
            >
              <span className="min-w-0">
                <span className="truncate font-medium">{lead.name}</span>
                <span className="text-muted-foreground"> · {lead.phone}</span>
              </span>
              <span className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <PhoneOutgoing className="size-3" />
                  {lead.calls} কল
                </span>
                <span className="flex items-center gap-1">
                  <PhoneIncoming className="size-3" />
                  {lead.connected} কথা
                </span>
                <span className="flex items-center gap-1">
                  <Timer className="size-3" />
                  {minutesLabel(lead.seconds)}
                </span>
                {lead.nextFollowUp ? (
                  <span className="flex items-center gap-1">
                    <CalendarClock className="size-3" />
                    {new Date(lead.nextFollowUp).toLocaleString("bn-BD", {
                      timeZone: "Asia/Dhaka",
                      day: "numeric",
                      month: "short",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
