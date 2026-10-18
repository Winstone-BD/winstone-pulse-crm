import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import {
  PhoneCall,
  CalendarClock,
  Clock,
  CheckCircle2,
  Search,
  Flame,
  ClipboardCheck,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WebCallButton } from "./WebCallButton";
import { useSnapshot } from "@/lib/crm-data";
import { useAdminToken } from "@/lib/local-session";
import { myFollowUps, listCallReports, myLeadExtras } from "@/lib/call-reports.functions";
import { useT } from "@/lib/i18n";
import { dhakaDay } from "@/lib/lead-groups";
import { callableLeads, followUpCounts } from "@/lib/daily-work";

export function DailyWorkPanel({
  hq = false,
  locked = false,
  onFollowUps,
}: {
  hq?: boolean;
  locked?: boolean;
  onFollowUps?: () => void;
}) {
  const t = useT();
  const { leads, isPending, isError: error } = useSnapshot();
  const adminToken = useAdminToken();
  const fetchFollow = useServerFn(myFollowUps);
  const fetchReports = useServerFn(listCallReports);
  const fetchExtras = useServerFn(myLeadExtras);
  const today = dhakaDay(Date.now());
  const follow = useQuery({
    queryKey: ["follow-ups", "daily-work", adminToken],
    queryFn: () => fetchFollow({ data: { adminToken } }),
    retry: false,
    staleTime: 60000,
  });
  const reports = useQuery({
    queryKey: ["my-call-reports", "daily-work", adminToken, today],
    queryFn: () =>
      fetchReports({
        data: {
          adminToken,
          fromIso: today + "T00:00:00+06:00",
          toIso: today + "T23:59:59.999+06:00",
          limit: 500,
        },
      }),
    retry: false,
    staleTime: 60000,
  });
  const extras = useQuery({
    queryKey: ["lead-extras", adminToken],
    queryFn: () => fetchExtras({ data: { adminToken } }),
    enabled: !hq,
    retry: false,
    staleTime: 60000,
  });
  const [search, setSearch] = useState("");
  const [visible, setVisible] = useState(12);
  const queue = callableLeads(leads);
  const counts = followUpCounts(follow.data ?? []);
  const completed = reports.data?.reports.filter(
    (r) => r.status === "submitted" && r.submitted_at && dhakaDay(r.submitted_at) === today,
  ).length;
  const reportValue = (value: number | undefined) =>
    reports.isPending
      ? "…"
      : reports.error
        ? "—"
        : reports.data?.reports.length === 500
          ? `${value ?? 0}+`
          : String(value ?? 0);
  const followValue = (n: number) => (follow.isPending ? "…" : follow.error ? "—" : String(n));
  const metrics = hq
    ? [
        {
          label: t({ bn: "আজকের ফলোআপ", en: "Today's follow-ups" }),
          value: followValue(counts.today),
          Icon: CalendarClock,
          action: onFollowUps,
        },
        {
          label: t({ bn: "বকেয়া", en: "Overdue" }),
          value: followValue(counts.overdue),
          Icon: Clock,
          action: onFollowUps,
        },
        {
          label: "Hot Leads",
          value: isPending
            ? "…"
            : error
              ? "—"
              : String(
                  leads.filter((l) => l.temperature === "hot" && l.status !== "closed").length,
                ),
          Icon: Flame,
        },
        {
          label: t({ bn: "রিপোর্ট বাকি · আজ", en: "Pending reports · today" }),
          value: reportValue(reports.data?.reports.filter((r) => r.status === "pending").length),
          Icon: ClipboardCheck,
        },
      ]
    : [
        {
          label: t({ bn: "কল করার লিড", en: "Leads to call" }),
          value: isPending ? "…" : error ? "—" : String(queue.length),
          Icon: PhoneCall,
        },
        {
          label: t({ bn: "আজকের ফলোআপ", en: "Today's follow-ups" }),
          value: followValue(counts.today),
          Icon: CalendarClock,
          action: onFollowUps,
        },
        {
          label: t({ bn: "বকেয়া ফলোআপ", en: "Overdue follow-ups" }),
          value: followValue(counts.overdue),
          Icon: Clock,
          action: onFollowUps,
        },
        {
          label: t({ bn: "আজ সম্পন্ন", en: "Completed today" }),
          value: reportValue(completed),
          Icon: CheckCircle2,
        },
      ];
  const filtered = queue.filter((l) =>
    `${l.name} ${l.phone_number}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <section className="space-y-5">
      <div className={`grid grid-cols-2 gap-3 ${hq ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        {metrics.map(({ label, value, Icon, action }) => (
          <div key={label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon className="size-4 shrink-0" />
              {label}
            </div>
            <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
            {action && (
              <Button variant="link" className="mt-1 h-auto min-h-9 p-0 text-xs" onClick={action}>
                {t({ bn: "তালিকা দেখুন", en: "View list" })}
              </Button>
            )}
          </div>
        ))}
        {hq && (
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Send className="size-4" />
              {t({ bn: "বণ্টনের অবস্থা", en: "Distribution status" })}
            </p>
            <Button asChild variant="outline" className="mt-3 min-h-11 w-full">
              <Link to="/leadhub">LeadHub Nexus</Link>
            </Button>
          </div>
        )}
      </div>
      {(error || follow.error || reports.error) && (
        <p role="alert" className="text-sm text-destructive">
          {t({
            bn: "কিছু তথ্য পড়া যায়নি। অজানা হিসাব শূন্য হিসেবে দেখানো হয়নি।",
            en: "Some data could not be read. Unknown counts are not shown as zero.",
          })}
        </p>
      )}
      {reports.data?.reports.length === 500 && (
        <p className="text-xs text-muted-foreground">
          {t({
            bn: "রিপোর্টের হিসাব প্রথম ৫০০ রেকর্ডের; পূর্ণ তালিকা রিপোর্টে দেখুন।",
            en: "Report count covers the first 500 records; see Reports for the full list.",
          })}
        </p>
      )}
      {!hq && (
        <>
          <header className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-center sm:flex sm:justify-between">
            <h2 className="min-w-0 text-lg font-semibold">
              {t({ bn: "আমার কলের তালিকা", en: "My call queue" })}
            </h2>
            <span className="shrink-0 text-sm text-muted-foreground">{filtered.length}</span>
          </header>
          <div className="relative">
            <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
            <Input
              aria-label={t({
                bn: "নাম বা ফোন দিয়ে লিড খুঁজুন",
                en: "Search leads by name or phone",
              })}
              placeholder={t({ bn: "নাম বা ফোন দিয়ে খুঁজুন", en: "Search name or phone" })}
              className="min-h-12 pl-10"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setVisible(12);
              }}
            />
          </div>
          {locked ? (
            <p role="status" className="border-l-2 border-warning py-3 pl-4">
              {t({
                bn: "HQ পর্যালোচনা বাকি। ফলোআপ ও রিপোর্ট খোলা আছে।",
                en: "HQ review is pending. Follow-ups and reports remain available.",
              })}
            </p>
          ) : isPending ? (
            <p>{t({ bn: "লিড আসছে…", en: "Loading leads…" })}</p>
          ) : error ? (
            <p role="alert">
              {t({
                bn: "লিড পড়া যায়নি। আবার চেষ্টা করুন।",
                en: "Unable to read leads. Please try again.",
              })}
            </p>
          ) : !filtered.length ? (
            <p className="border border-dashed border-border rounded-lg p-8 text-center text-muted-foreground">
              {t({ bn: "এই তালিকায় এখন কোনো লিড নেই।", en: "No leads in this list right now." })}
            </p>
          ) : (
            <div className="grid gap-3 xl:grid-cols-2">
              {filtered.slice(0, visible).map((lead) => {
                const detail = extras.data?.find((e) => e.leadId === lead.id);
                return (
                  <article
                    key={lead.id}
                    className="rounded-lg border border-border bg-card p-4 sm:p-5"
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-lg font-semibold">{lead.name}</h3>
                        <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                          {lead.phone_number}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-md bg-muted px-2 py-1 text-xs">
                        {t(
                          lead.status === "pending"
                            ? { bn: "নতুন", en: "New" }
                            : lead.status === "follow_up"
                              ? { bn: "ফলোআপ", en: "Follow-up" }
                              : { bn: "যোগাযোগ হয়েছে", en: "Contacted" },
                        )}
                      </span>
                    </div>
                    <dl className="mt-4 space-y-2 text-sm">
                      <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                        <dt className="text-muted-foreground">
                          {t({ bn: "চাহিদা", en: "Requirement" })}
                        </dt>
                        <dd className="break-words">
                          {detail?.requirement ??
                            (extras.isPending
                              ? "…"
                              : t({ bn: "এখনও জানা নেই", en: "Not yet known" }))}
                        </dd>
                      </div>
                      <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-2">
                        <dt className="text-muted-foreground">
                          {t({ bn: "পরের ফলোআপ", en: "Next follow-up" })}
                        </dt>
                        <dd>
                          {detail?.nextFollowUpAt
                            ? new Date(detail.nextFollowUpAt).toLocaleString("bn-BD", {
                                timeZone: "Asia/Dhaka",
                              })
                            : t({ bn: "সময় নির্ধারিত নেই", en: "Not scheduled" })}
                        </dd>
                      </div>
                    </dl>
                    <WebCallButton
                      leadId={lead.id}
                      name={lead.name}
                      phone={lead.phone_number}
                      className="mt-4 min-h-12 w-full"
                    />
                  </article>
                );
              })}
            </div>
          )}
          {!locked && filtered.length > visible && (
            <Button
              variant="outline"
              className="min-h-12 w-full"
              onClick={() => setVisible((v) => v + 12)}
            >
              {t({ bn: "আরও লিড দেখুন", en: "Show more leads" })}
            </Button>
          )}
        </>
      )}
    </section>
  );
}
