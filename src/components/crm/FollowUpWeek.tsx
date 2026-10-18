import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarDays, Clock } from "lucide-react";
import { relativeTime } from "@/lib/crm-format";
import { useMemo, useState } from "react";

import { WebCallButton } from "@/components/crm/WebCallButton";
import { WhatsAppAction } from "@/components/crm/WhatsAppAction";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { selectableAgents } from "@/lib/agent-roster";
import { myFollowUps } from "@/lib/call-reports.functions";
import { useSnapshot } from "@/lib/crm-data";
import { shortDate } from "@/lib/crm-format";
import { useAdminToken } from "@/lib/local-session";
import { toast } from "sonner";
import { useLang } from "@/lib/i18n";
import { isOpenFollowUp } from "@/lib/follow-up-lifecycle";
import { dhakaDay } from "@/lib/lead-groups";
import { softMessageDraft } from "@/lib/no-answer-cadence";
import { FOLLOW_UP_PRIORITY_LABEL } from "@/lib/follow-up-priority";

const ALL = "all";

/** Local day key so "today"/"tomorrow" match the agent's own phone clock. */
function dayKey(value: Date): string { return dhakaDay(value); }

function windowRange() {
  const from = new Date();
  from.setDate(from.getDate() - 14);
  from.setHours(0, 0, 0, 0);
  const to = new Date();
  to.setDate(to.getDate() + 7);
  to.setHours(23, 59, 59, 999);
  return { fromIso: from.toISOString(), toIso: to.toISOString() };
}

/**
 * "Next 7 days" follow-up view. It reuses the existing follow_up_events data
 * (same server function as the calendar) and only regroups it into Overdue /
 * Today / Tomorrow / Next 5 days, with an optional filter for one of the
 * existing agents.
 */
export function FollowUpWeek() {
  const adminToken = useAdminToken();
  const { profiles } = useSnapshot();
  const fetchEvents = useServerFn(myFollowUps);
  const [agentId, setAgentId] = useState<string>(ALL);
  const range = useMemo(() => windowRange(), []);

  const events = useQuery({
    queryKey: ["follow-ups", "week7", adminToken ? "pin" : "session"],
    queryFn: () => fetchEvents({ data: { adminToken, ...range } }),
    refetchInterval: 60_000,
  });

  const agents = useMemo(() => selectableAgents(profiles), [profiles]);
  const rows = useMemo(() => {
    const all = events.data ?? [];
    return agentId === ALL ? all : all.filter((row) => row.agent_id === agentId);
  }, [events.data, agentId]);

  const groups = useMemo(() => {
    const now = new Date();
    const today = dayKey(now);
    const tomorrowDate = new Date(now);
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrow = dayKey(tomorrowDate);
    const limit = new Date(now);
    limit.setDate(limit.getDate() + 7);
    const limitKey = dayKey(limit);

    const buckets = {
      overdue: [] as typeof rows,
      today: [] as typeof rows,
      tomorrow: [] as typeof rows,
      later: [] as typeof rows,
    };

    for (const row of rows) {
      if (!isOpenFollowUp(row.status)) continue;
      const when = new Date(row.scheduled_at);
      const key = dayKey(when);
      if (when.getTime() < now.getTime()) buckets.overdue.push(row);
      else if (key === today) buckets.today.push(row);
      else if (key === tomorrow) buckets.tomorrow.push(row);
      else if (key > tomorrow && key <= limitKey) buckets.later.push(row);
    }
    return buckets;
  }, [rows]);

  const sections: { key: string; label: string; items: typeof rows; overdue?: boolean }[] = [
    { key: "overdue", label: "সময় পার হয়েছে", items: groups.overdue, overdue: true },
    { key: "today", label: "আজ", items: groups.today },
    { key: "tomorrow", label: "আগামীকাল", items: groups.tomorrow },
    { key: "later", label: "পরের ৫ দিন", items: groups.later },
  ];

  const total =
    groups.overdue.length + groups.today.length + groups.tomorrow.length + groups.later.length;

  return (
    <section className="card-elevated space-y-4 p-4">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 sm:flex sm:flex-wrap sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
            <CalendarDays className="size-4 shrink-0" /> আগামী ৭ দিনের ফলো-আপ
          </h2>
          <p className="text-xs text-muted-foreground">
            মোট {total}টি · {groups.overdue.length}টির সময় পার হয়েছে
          </p>
        </div>
        {agents.length > 1 && (
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger className="h-9 w-[160px] shrink-0 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value={ALL}>সব এজেন্ট</SelectItem>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </header>

      {total === 0 ? (
        <p className="rounded-lg bg-muted px-3 py-6 text-center text-xs text-muted-foreground">
          আগামী ৭ দিনে কোনো ফলো-আপ নেই।
        </p>
      ) : (
        sections
          .filter((section) => section.items.length > 0)
          .map((section) => (
            <div key={section.key} className="space-y-2">
              <p className={`flex items-center gap-2 text-xs font-semibold uppercase tracking-wide ${section.overdue ? "text-destructive" : "text-muted-foreground"}`}>
                {section.overdue ? <AlertTriangle className="size-3.5" aria-hidden /> : <Clock className="size-3.5" aria-hidden />}
                {section.label}
                <span className="tabular">({section.items.length})</span>
              </p>
              <ul className="space-y-2">
                {section.items.map((event) => (
                  <li
                    key={event.id}
                    className={`w-full max-w-full overflow-hidden rounded-xl border p-3 ${section.overdue ? "border-destructive/30 border-l-4 border-l-destructive bg-destructive/5" : "border-border"}`}
                  >
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">
                          {event.customer_name ?? "ক্রেতা"}
                        </p>
                        <p className="tabular truncate text-xs text-muted-foreground">
                          {event.phone_number ?? "—"}
                        </p>
                        <p className="tabular text-xs text-muted-foreground">
                          {shortDate(event.scheduled_at)} ·{" "}
                          <time dateTime={event.scheduled_at}>
                            {new Date(event.scheduled_at).toLocaleTimeString("bn-BD", {
                              timeZone: "Asia/Dhaka",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </time>
                          {" · "}
                          {relativeTime(event.scheduled_at)}
                        </p>
                      </div>
                      {section.overdue && (
                        <Badge className="shrink-0 gap-1 bg-destructive/15 text-destructive">
                          <AlertTriangle className="size-3" aria-hidden />
                          সময় পার
                        </Badge>
                      )}
                      {!section.overdue && event.priority && (
                        <Badge variant={event.priority === "high" ? "destructive" : "secondary"}>
                          {FOLLOW_UP_PRIORITY_LABEL[event.priority] ?? event.priority}
                        </Badge>
                      )}
                    </div>
                    {event.phone_number && (
                      <div className="mt-2.5 flex items-center gap-2">
                        {/* Every follow-up call goes through the report gate. */}
                        <WebCallButton
                          leadId={event.lead_id ?? null}
                          phone={event.phone_number}
                          name={event.customer_name ?? null}
                          label="কল"
                        />
                        <WhatsAppAction
                          phone={event.phone_number}
                          leadId={event.lead_id ?? null}
                          label=""
                        />
                      </div>
                    )}
                    {typeof event.note === "string" && (event.note.startsWith("২য় বার ধরেননি") || event.note.startsWith("Second unanswered call")) && (
                      <SoftMessageBox name={event.customer_name ?? null} />
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))
      )}
    </section>
  );
}

/** Ready-to-send soft message for second-miss leads; agent copies and sends it themselves. */
function SoftMessageBox({ name }: { name: string | null }) {
  const lang = useLang();
  const text = softMessageDraft(name, lang);
  return (
    <div className="mt-2.5 rounded-lg border border-border bg-muted/40 p-2.5">
      <p className="text-[11px] font-semibold text-muted-foreground">
        {lang === "bn" ? "সফট মেসেজ (পাঠানোর জন্য প্রস্তুত)" : "Soft message (ready to send)"}
      </p>
      <p className="mt-1 text-xs">{text}</p>
      <Button
        size="sm"
        variant="outline"
        className="mt-2 h-7"
        onClick={() => {
          void navigator.clipboard
            .writeText(text)
            .then(() => toast.success(lang === "bn" ? "মেসেজ কপি হয়েছে" : "Message copied"))
            .catch(() => toast.error(lang === "bn" ? "কপি করা যায়নি" : "Could not copy"));
        }}
      >
        {lang === "bn" ? "কপি করুন" : "Copy message"}
      </Button>
    </div>
  );
}
