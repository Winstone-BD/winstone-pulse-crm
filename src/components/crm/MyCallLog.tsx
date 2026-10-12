import { PhoneCall } from "lucide-react";
import { useMemo } from "react";

import { CallEntry } from "@/components/crm/LeadDossier";
import { MyPhoneLine } from "@/components/crm/MyPhoneSetup";
import { useSnapshot } from "@/lib/crm-data";
import { DeskRangeChip, useDeskRange } from "@/lib/desk-range";
import { EmptyState, ErrorState, LoadingState } from "@/components/crm/DataState";
import { useT, useLang } from "@/lib/i18n";

/** Every recording synced for the agent's own calls, newest first. */
export function MyCallLog() {
  const t = useT();
  const lang = useLang();
  const { leads, calls: allCalls, isPending, isError, refetch } = useSnapshot();
  const range = useDeskRange();
  // Date range from the Command Center: calls made within the range.
  const calls = useMemo(() => allCalls.filter((c) => range.inRange(c.created_at)), [allCalls, range.from, range.to]);

  const ordered = useMemo(
    () =>
      [...calls].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [calls],
  );

  return (
    <section className="space-y-3">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          <PhoneCall className="size-5 text-primary" /> {t({ bn: "আমার কল রেকর্ড", en: "My call log" })}
        </h2>
        <DeskRangeChip />
        <p className="text-xs text-muted-foreground sm:text-sm">
          {t({
            bn: `${ordered.length}টি কল · ফোন থেকে অডিও আসার পর এআই সারমর্ম যোগ হয়`,
            en: `${ordered.length} calls · AI summary is added once audio arrives from the phone`,
          })}
          <MyPhoneLine />
        </p>
      </div>

      {isPending && <LoadingState label={t({ bn: "কল লোড হচ্ছে…", en: "Loading calls…" })} />}
      {isError && <ErrorState onRetry={refetch} />}

      {!isPending && !isError && ordered.length === 0 && (
        <EmptyState>{t({ bn: "এখনো কোনো কল রেকর্ড আসেনি। ফোন থেকে কল করলে সেটি এখানে দেখা যাবে।", en: "No call recordings yet. Calls made from the phone will appear here." })}</EmptyState>
      )}

      <div className="space-y-4">
        {ordered.map((call, i) => {
          const lead = leads.find((l) => l.id === call.lead_id);
          const day = dhakaDay(call.created_at, lang);
          const newDay = i === 0 || dhakaDay(ordered[i - 1]!.created_at, lang) !== day;
          return (
            <div key={call.id} className="space-y-1.5">
              {newDay && (
                <h3 className="sticky top-0 z-10 -mx-1 border-b border-border bg-background/95 px-1 py-1 text-xs font-semibold text-muted-foreground">
                  {day}
                </h3>
              )}
              <p className="text-xs text-muted-foreground">
                {t({ bn: "লিড:", en: "Lead:" })} <span className="font-medium text-foreground">{lead?.name ?? t({ bn: "অজানা", en: "Unknown" })}</span>
                {lead?.company ? ` · ${lead.company}` : ""}
              </p>
              <CallEntry call={call} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Dhaka calendar date heading, e.g. "রবি, ১১ অক্টো ২০২৬" (or "Sun, 11 Oct 2026" in English). */
function dhakaDay(iso: string, lang: "bn" | "en" = "bn") {
  return new Date(iso).toLocaleDateString(lang === "en" ? "en-GB" : "bn-BD", { timeZone: "Asia/Dhaka", weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
