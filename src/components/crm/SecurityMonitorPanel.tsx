import { useMutation, useQuery } from "@tanstack/react-query";
import { FileDown, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAdminToken } from "@/lib/local-session";
import { getLoginFailures, saveMonthlySummary } from "@/lib/it-monitor.functions";
import { dhakaTime } from "@/lib/maintenance-rules";

const REASON: Record<string, string> = {
  wrong_password: "ভুল পাসওয়ার্ড",
  unknown_account: "অ্যাকাউন্ট পাওয়া যায়নি",
  locked: "সাময়িক লক",
};

/** IT Console → ব্যর্থ সাইন-ইন ও সাময়িক লক (গত ৭ দিন)। */
export function LoginFailuresPanel() {
  const adminToken = useAdminToken();
  const q = useQuery({
    queryKey: ["login-failures", adminToken],
    queryFn: () => getLoginFailures({ data: { adminToken } }),
    enabled: Boolean(adminToken),
    refetchInterval: 60_000,
  });
  const suspicious = (q.data?.sources ?? []).filter((s) => s.locked > 0 || s.failed >= 5);
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="flex items-center gap-2 text-base font-semibold">
        <ShieldAlert className="size-4" /> ব্যর্থ সাইন-ইন ও লক (৭ দিন)
      </h2>
      {q.isLoading ? <Loader2 className="size-4 animate-spin" /> : null}
      {suspicious.length ? (
        <ul className="space-y-1 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs">
          {suspicious.map((s) => (
            <li key={s.source}>
              সন্দেহজনক নেটওয়ার্ক <span className="font-mono">{s.source}</span> — ব্যর্থ {s.failed}, লক {s.locked}
            </li>
          ))}
        </ul>
      ) : null}
      <ul className="divide-y divide-border text-sm">
        {(q.data?.rows ?? []).slice(0, 100).map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className={r.locked ? "font-medium text-destructive" : "font-medium"}>
              {REASON[r.reason ?? ""] ?? r.reason}
            </span>
            {r.identifier ? <span className="text-xs">{r.identifier}</span> : null}
            <span className="font-mono text-xs text-muted-foreground">{r.source}</span>
            <span className="tabular ml-auto text-xs text-muted-foreground">{dhakaTime(r.at)}</span>
          </li>
        ))}
        {q.data && q.data.rows.length === 0 ? (
          <li className="py-3 text-xs text-muted-foreground">গত ৭ দিনে কোনো ব্যর্থ সাইন-ইন নেই।</li>
        ) : null}
      </ul>
    </section>
  );
}

/** IT Console → মাসিক কল ও ফলো-আপ সারাংশ PDF → Drive "Daily Call Exports"। */
export function MonthlySummaryPanel() {
  const adminToken = useAdminToken();
  const [month, setMonth] = useState("");
  const save = useMutation({
    mutationFn: () => saveMonthlySummary({ data: { adminToken, month: month || undefined } }),
    onSuccess: (r) => toast.success(`${r.month} সারাংশ Drive-এ সংরক্ষিত`),
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <section className="space-y-3 rounded-xl border bg-card p-4">
      <h2 className="text-base font-semibold">মাসিক সারাংশ PDF</h2>
      <p className="text-xs text-muted-foreground">
        প্রতি মাসের ১ তারিখে আগের মাসের সারাংশ স্বয়ংক্রিয়ভাবে Google Drive-এর "Daily Call Exports" ফোল্ডারে যায়। খালি রাখলে আগের মাস।
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          aria-label="মাস"
        />
        <Button size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? <Loader2 className="size-4 animate-spin" /> : <FileDown className="size-4" />} এখন সংরক্ষণ
        </Button>
        {save.data?.link ? (
          <a href={save.data.link} target="_blank" rel="noreferrer" className="text-xs underline">
            Drive-এ খুলুন
          </a>
        ) : null}
      </div>
    </section>
  );
}
