import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { BellRing, Clock, FileWarning } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAdminToken } from "@/lib/local-session";
import { myReminders, registerReminderDevice } from "@/lib/reminders.functions";
import { PUSH_MESSAGES, pushConfigured, requestWebPushToken } from "@/lib/web-push";
import { FOLLOW_UP_PRIORITY_LABEL } from "@/lib/follow-up-priority";
import { useT } from "@/lib/i18n";

/**
 * The reminder bell: unfinished reports and due follow-ups, refreshed every
 * minute. A newly due item also raises a toast, so the agent sees it without
 * opening the bell; browser push covers the case of the tab being closed.
 */
export function ReminderBell() {
  const t = useT();
  const adminToken = useAdminToken();
  const load = useServerFn(myReminders);
  const registerDevice = useServerFn(registerReminderDevice);
  const [open, setOpen] = useState(false);
  const seen = useRef<Set<string>>(new Set());

  const { data } = useQuery({
    queryKey: ["reminders", adminToken],
    queryFn: () => load({ data: { adminToken } }),
    refetchInterval: 60_000,
    retry: false,
  });

  const reminders = data?.reminders ?? [];
  const overdue = reminders.filter((item) => item.overdue).length;

  useEffect(() => {
    let first = seen.current.size === 0;
    for (const item of reminders) {
      const key = `${item.kind}:${item.id}`;
      if (seen.current.has(key)) continue;
      seen.current.add(key);
      if (first) continue;
      toast.warning(t({ bn: item.title, en: item.titleEn ?? item.title }), { description: t({ bn: item.detail, en: item.detailEn ?? item.detail }), duration: 10_000 });
    }
    if (first && reminders.length > 0) {
      toast.warning(t({ bn: `${reminders.length}টি রিমাইন্ডার অপেক্ষা করছে`, en: `${reminders.length} reminders waiting` }), {
        description: reminders[0]!.detail,
        duration: 8_000,
      });
    }
    first = false;
  }, [reminders]);

  async function enablePush() {
    const result = await requestWebPushToken();
    if (result.status === "registered" && result.token) {
      await registerDevice({ data: { adminToken, token: result.token, label: "Web CRM" } });
      toast.success(t({ bn: "এই ব্রাউজারে রিমাইন্ডার নোটিফিকেশন চালু হয়েছে", en: "Reminder notifications are enabled on this browser" }));
      return;
    }
    toast.info(PUSH_MESSAGES[result.status]);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t({ bn: "রিমাইন্ডার", en: "Reminders" })}
          className="relative inline-flex size-8 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-all duration-300 hover:text-foreground hover:shadow-sm"
        >
          <BellRing className="size-3.5" />
          {reminders.length > 0 && (
            <span
              className={
                overdue > 0
                  ? "absolute -right-1 -top-1 min-w-4 rounded-full bg-destructive px-1 text-[10px] font-bold leading-4 text-destructive-foreground"
                  : "absolute -right-1 -top-1 min-w-4 rounded-full bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground"
              }
            >
              {reminders.length}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border px-3 py-2">
          <p className="text-sm font-semibold">{t({ bn: "রিমাইন্ডার", en: "Reminders" })}</p>
          <p className="text-xs text-muted-foreground">
            {t({ bn: "অসম্পূর্ণ রিপোর্ট ও সময় হয়ে যাওয়া ফলো-আপ", en: "Incomplete reports and due follow-ups" })}
          </p>
        </div>
        <div className="max-h-72 overflow-y-auto">
          {reminders.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-muted-foreground">
              {t({ bn: "এখন কোনো রিমাইন্ডার নেই — সব রিপোর্ট ও ফলো-আপ হালনাগাদ", en: "No reminders right now — all reports and follow-ups are up to date" })}
            </p>
          ) : (
            reminders.map((item) => (
              <div
                key={`${item.kind}:${item.id}`}
                className="flex gap-2 border-b border-border/60 px-3 py-2 last:border-b-0"
              >
                {item.kind === "report" ? (
                  <FileWarning className="mt-0.5 size-4 shrink-0 text-destructive" />
                ) : (
                  <Clock className="mt-0.5 size-4 shrink-0 text-primary" />
                )}
                <div className="min-w-0">
                  <p className="text-xs font-semibold">{t({ bn: item.title, en: item.titleEn ?? item.title })}</p>
                  <p className="break-words text-xs text-muted-foreground">{t({ bn: item.detail, en: item.detailEn ?? item.detail })}</p>
                  {item.kind === "follow_up" && item.priority ? (
                    <p className="mt-0.5 text-[10px] font-semibold text-primary">
                      {FOLLOW_UP_PRIORITY_LABEL[item.priority] ?? item.priority}
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
        {pushConfigured() && (
          <div className="border-t border-border p-2">
            <Button size="sm" variant="outline" className="w-full text-xs" onClick={enablePush}>
              {t({ bn: "ব্রাউজার নোটিফিকেশন চালু করুন", en: "Enable browser notifications" })}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
