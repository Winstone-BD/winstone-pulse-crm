import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Database, Loader2, Share2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAdminToken } from "@/lib/local-session";
import { distributeLeadPool, leadPoolStatus } from "@/lib/lead-pool.functions";

/**
 * The company lead database, in the IT Console.
 *
 * Unassigned leads wait here. IT types how many each agent should get for the
 * day and that many go out to every active agent, oldest first; the rest stay in
 * the database. Every hand-over is recorded in the lead's own history.
 */
export function LeadDatabasePanel() {
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const statusFn = useServerFn(leadPoolStatus);
  const distributeFn = useServerFn(distributeLeadPool);
  const [perAgent, setPerAgent] = useState("");

  const status = useQuery({
    queryKey: ["lead-pool", adminToken ? "pin" : "session"],
    queryFn: () => statusFn({ data: { adminToken } }),
    refetchInterval: 60_000,
  });

  const quantity = Number(perAgent);
  const agentCount = status.data?.agents.length ?? 0;
  const poolCount = status.data?.poolCount ?? 0;
  const willSend = Math.min(quantity * agentCount || 0, poolCount);

  const send = useMutation({
    mutationFn: (saveAsDaily: boolean) =>
      distributeFn({ data: { adminToken, perAgent: quantity, saveAsDaily } }),
    onSuccess: (result) => {
      if (result.moved === 0 && result.alreadyComplete) {
        toast.info(
          `নতুন কিছু দেওয়া হয়নি — ${result.agents} জন এজেন্টেরই আজকের দৈনিক কোটা আগেই পূর্ণ। আরও দিতে IT Console → "সবাইকে একসাথে অতিরিক্ত লিড" ব্যবহার করুন।`,
        );
      } else
      toast.success(
        `${result.agents} জন এজেন্টকে মোট ${result.moved}টি লিড দেওয়া হয়েছে — ডেটাবেজে বাকি ${result.remaining}টি${
          result.duplicatesSkipped
            ? ` · ${result.duplicatesSkipped}টি ডুপ্লিকেট নম্বর বাদ পড়েছে`
            : ""
        }`,
      );
      setPerAgent("");
      void queryClient.invalidateQueries({ queryKey: ["lead-pool"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-snapshot"] });
      void queryClient.invalidateQueries({ queryKey: ["lead-day"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="card-elevated space-y-4 p-4">
      <header className="flex flex-wrap items-center gap-2">
        <Database className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">লিড ডেটাবেজ</h2>
        <span className="ml-auto text-xs text-muted-foreground">
          {status.isPending ? "…" : `${poolCount}টি লিড অপেক্ষায়`}
        </span>
      </header>

      <p className="text-xs text-muted-foreground">
        কিছু না দিলে প্রতিদিন সকালে প্রতি এজেন্ট স্বয়ংক্রিয়ভাবে নির্ধারিত সংখ্যক লিড পাবে (এখন{" "}
        {status.data?.dailyPerAgent ?? 50}টি)। অন্য সংখ্যা (যেমন ৩০) লিখে "শুধু আজ" দিলে আজ সবাই ততটি পাবে;
        একজন একজন করে দিতে নিচের "Agent + Quantity" অংশ ব্যবহার করুন। একই নম্বর দুইজনের কাছে বা একজনের
        কাছে দুইবার কখনো যাবে না।
      </p>

      {status.data ? (
        <p
          className={
            status.data.shortage
              ? "rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-xs"
              : "rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground"
          }
        >
          স্বয়ংক্রিয় দৈনিক বিতরণ: প্রতি এজেন্ট {status.data.dailyPerAgent}টি · সর্বশেষ বিতরণ{" "}
          {status.data.lastRunDate ?? "এখনো হয়নি"} ·{" "}
          {status.data.shortage
            ? "ডেটাবেজে এক দিনের ভাগও বাকি নেই — নতুন লিড আপলোড করুন"
            : `প্রায় ${status.data.daysLeft} দিনের লিড বাকি আছে`}
        </p>
      ) : null}

      {status.data?.latestImport ? (
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-surface-2 p-3 text-xs sm:grid-cols-4">
          <Result label="Incoming / এসেছে" value={status.data.latestImport.incoming} />
          <Result
            label="Worked / আগে কাজ"
            value={status.data.latestImport.excludedAlreadyWorkedOrAssigned}
          />
          <Result
            label="Duplicate / একই"
            value={status.data.latestImport.excludedDuplicate}
          />
          <Result label="Eligible / নতুন" value={status.data.latestImport.eligibleNew} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-xs text-muted-foreground">
          প্রতি এজেন্টকে কতটি লিড
          <Input
            value={perAgent}
            inputMode="numeric"
            placeholder={`খালি = ${status.data?.dailyPerAgent ?? 50}`}
            onChange={(event) => setPerAgent(event.target.value.replace(/\D/g, "").slice(0, 3))}
            className="h-9 w-28"
          />
        </label>
        <Button
          size="sm"
          disabled={send.isPending || !quantity || agentCount === 0 || poolCount === 0}
          onClick={() => send.mutate(false)}
        >
          {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
          শুধু আজ সবাইকে দিন
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={send.isPending || !quantity || agentCount === 0 || poolCount === 0}
          onClick={() => send.mutate(true)}
        >
          দিন ও প্রতিদিনের সংখ্যা করুন
        </Button>
        {quantity && agentCount ? (
          <p className="text-xs text-muted-foreground">
            {agentCount} জন × {quantity} = {willSend}টি যাবে · বাকি থাকবে {poolCount - willSend}টি
          </p>
        ) : null}
      </div>

      {status.data && status.data.agents.length > 0 ? (
        <div className="space-y-2">
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface-2 text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">এজেন্ট</th>
                <th className="px-3 py-2 text-right font-medium" title="দৈনিক কোটায় গোনা লিড / লক্ষ্য">দৈনিক কোটা</th>
                <th className="px-3 py-2 text-right font-medium" title="কোটার বাইরে আজ দেওয়া অতিরিক্ত">অতিরিক্ত</th>
                <th className="px-3 py-2 text-right font-medium" title="আজকের বরাদ্দ ইতিহাসে নতুন দেওয়া">আজ নতুন</th>
                <th className="px-3 py-2 text-right font-medium" title="আগের দিনের বাকি সহ আজকের বোর্ড">আজকের বোর্ড</th>
                <th className="px-3 py-2 text-right font-medium">বাকি</th>
                <th className="px-3 py-2 text-right font-medium">মোট</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {status.data.agents.map((agent) => (
                <tr key={agent.id}>
                  <td className="px-3 py-2">{agent.name}</td>
                  <td className="tabular px-3 py-2 text-right">
                    <span className={agent.quotaToday >= agent.quotaTarget ? "text-success" : ""}>
                      {agent.quotaToday}/{agent.quotaTarget}
                    </span>
                  </td>
                  <td className="tabular px-3 py-2 text-right">{agent.extraToday ? `+${agent.extraToday}` : "—"}</td>
                  <td className="tabular px-3 py-2 text-right">{agent.newToday}</td>
                  <td className="tabular px-3 py-2 text-right">{agent.today}</td>
                  <td className="tabular px-3 py-2 text-right">{agent.pending}</td>
                  <td className="tabular px-3 py-2 text-right font-medium">{agent.total}</td>
                </tr>
              ))}
              <tr className="bg-surface-2 font-medium">
                <td className="px-3 py-2">মোট</td>
                <td className="tabular px-3 py-2 text-right">
                  {status.data.agents.reduce((s, a) => s + a.quotaToday, 0)}
                </td>
                <td className="tabular px-3 py-2 text-right">
                  +{status.data.agents.reduce((s, a) => s + a.extraToday, 0)}
                </td>
                <td className="tabular px-3 py-2 text-right">
                  {status.data.agents.reduce((s, a) => s + a.newToday, 0)}
                </td>
                <td className="tabular px-3 py-2 text-right">
                  {status.data.agents.reduce((s, a) => s + a.today, 0)}
                </td>
                <td className="tabular px-3 py-2 text-right">
                  {status.data.agents.reduce((s, a) => s + a.pending, 0)}
                </td>
                <td className="tabular px-3 py-2 text-right">
                  {status.data.agents.reduce((s, a) => s + a.total, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground">
          দৈনিক কোটা = আজকের কোটায় গোনা লিড (বিতরণ এই সংখ্যা দেখেই বাকিটা দেয়) · অতিরিক্ত = IT Console/স্বয়ংক্রিয় রিফিল থেকে কোটার বাইরে ·
          আজ নতুন = আজকের বরাদ্দ ইতিহাসে লেখা নতুন লিড · আজকের বোর্ড = আগের দিনের অসম্পূর্ণ লিডসহ আজকের তালিকা।
        </p>
        </div>
      ) : null}

      {status.data && poolCount === 0 ? (
        <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
          ডেটাবেজ এখন খালি — আপলোড করা সব লিড ইতিমধ্যে এজেন্টদের কাছে চলে গেছে (মোট{" "}
          {status.data.agents.reduce((sum, agent) => sum + agent.total, 0)}টি এজেন্টের হাতে)। নতুন
          লিড আপলোড করলে সেগুলো এখানে দেখা যাবে।
        </p>
      ) : null}



      {status.data && status.data.preview.length > 0 ? (
        <details className="rounded-xl border border-border px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium">
            ডেটাবেজে থাকা লিড দেখুন ({poolCount}টি)
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {status.data.preview.map((lead) => (
              <li key={lead.id} className="flex justify-between gap-3">
                <span className="truncate">
                  <span className="tabular">#{lead.serial_no ?? "—"}</span> {lead.name}
                  {lead.reference_by ? (
                    <span className="ml-1 text-foreground/80">· রেফ: {lead.reference_by}</span>
                  ) : null}
                </span>
                <span className="tabular">{lead.phone_number}</span>
              </li>
            ))}
            {poolCount > status.data.preview.length ? (
              <li>… আরও {poolCount - status.data.preview.length}টি</li>
            ) : null}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function Result({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
      <p className="tabular text-base font-semibold">{typeof value === "number" ? value : "—"}</p>
    </div>
  );
}
