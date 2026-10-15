import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BellRing, MapPin } from "lucide-react";
import { useMemo } from "react";

import { Badge } from "@/components/ui/badge";
import { listSiteVisits } from "@/lib/site-visits.functions";
import { useAdminToken } from "@/lib/local-session";
import { useLang } from "@/lib/i18n";
import { visitReminderStage, visitTwoHourReminderAt } from "@/lib/site-visit-rules";

const fmt = (d: Date) => d.toLocaleString("en-GB", { timeZone: "Asia/Dhaka", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Booked site visits (next 30 days) with their 2-hour reminder time, read from the scoped visit list. */
export function VisitCalendar() {
  const adminToken = useAdminToken();
  const { lang } = useLang();
  const en = lang === "en";
  const fetchVisits = useServerFn(listSiteVisits);
  const q = useQuery({
    queryKey: ["site-visits", "calendar", adminToken ? "pin" : "session"],
    queryFn: () => fetchVisits({ data: { adminToken } }),
    refetchInterval: 60_000,
  });
  const rows = useMemo(() => {
    const now = Date.now(), limit = now + 30 * 86_400_000;
    return (q.data ?? [])
      .filter((v) => visitTwoHourReminderAt(v) && new Date(v.visit_at).getTime() > now - 3_600_000 && new Date(v.visit_at).getTime() <= limit)
      .sort((a, b) => a.visit_at.localeCompare(b.visit_at));
  }, [q.data]);

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <h3 className="flex items-center gap-2 font-semibold"><MapPin className="h-4 w-4 text-primary" />{en ? "Booked site visits" : "নির্ধারিত সাইট ভিজিট"}</h3>
      {q.isError ? <p className="text-sm text-destructive">{en ? "Couldn't load visits." : "ভিজিট লোড হয়নি।"}</p>
        : q.isLoading ? <p className="text-sm text-muted-foreground">{en ? "Loading…" : "লোড হচ্ছে…"}</p>
        : rows.length === 0 ? <p className="text-sm text-muted-foreground">{en ? "No booked visits in the next 30 days." : "আগামী ৩০ দিনে কোনো ভিজিট নেই।"}</p>
        : <ul className="divide-y">{rows.map((v) => {
            const stage = visitReminderStage(v, Date.now());
            const rem = visitTwoHourReminderAt(v)!;
            return (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <div>
                  <div className="font-medium">{v.lead_name ?? (en ? "Lead" : "লিড")}{v.project ? ` · ${v.project}` : ""}</div>
                  <div className="text-muted-foreground">{fmt(new Date(v.visit_at))}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1 text-xs text-muted-foreground"><BellRing className="h-3 w-3" />{en ? "Reminder" : "রিমাইন্ডার"} {fmt(rem)}</span>
                  {stage === "2h" && <Badge className="bg-warning/15 text-warning">{en ? "Within 2h" : "২ ঘণ্টার মধ্যে"}</Badge>}
                  {stage === "late" && <Badge className="bg-destructive/15 text-destructive">{en ? "Started" : "শুরু হয়েছে"}</Badge>}
                  <Badge variant="outline">{v.status === "confirmed" ? (en ? "Confirmed" : "কনফার্ম") : (en ? "Scheduled" : "নির্ধারিত")}</Badge>
                </div>
              </li>);
          })}</ul>}
    </section>
  );
}
