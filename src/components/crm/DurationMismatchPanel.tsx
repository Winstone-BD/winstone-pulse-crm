import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { BadgeCheck, ClockAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

import { Badge } from "@/components/ui/badge";
import { listDurationMismatches, verifyDurationMismatch } from "@/lib/call-reports.functions";
import { fullDateTime } from "@/lib/crm-format";
import { useAdminToken } from "@/lib/local-session";

function fmtSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} মি ${s} সে` : `${s} সে`;
}

/**
 * HQ/IT review list: submitted reports whose stored call time disagrees with
 * the time the agent's phone measured. Read-only — review only, nothing is
 * changed from here. Agents never see this; the server returns an empty list.
 */
export function DurationMismatchPanel({ onOpenLead }: { onOpenLead: (leadId: string) => void }) {
  const adminToken = useAdminToken();
  const fetchMismatches = useServerFn(listDurationMismatches);
  const { data, isPending } = useQuery({
    queryKey: ["duration-mismatches", adminToken ? "pin" : "session"],
    queryFn: () => fetchMismatches({ data: { adminToken } }),
    refetchInterval: 60_000,
  });
  const mismatches = data?.mismatches ?? [];
  const openCount = mismatches.filter((m) => !m.verifiedAt).length;
  const queryClient = useQueryClient();
  const verify = useServerFn(verifyDurationMismatch);
  const mark = useMutation({
    mutationFn: (reportId: string) => verify({ data: { adminToken, reportId } }),
    onSuccess: () => {
      toast.success("যাচাই করা হয়েছে");
      void queryClient.invalidateQueries({ queryKey: ["duration-mismatches"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <ClockAlert className="size-5 text-primary" /> কলের সময় মেলেনি ({openCount} বাকি · {mismatches.length - openCount} যাচাই হয়েছে)
        </h2>
        <p className="text-xs text-muted-foreground sm:text-sm">
          ফোনের মাপা সময়ের সঙ্গে রিপোর্টের সময়ের ব্যবধান ১৫ সেকেন্ডের বেশি হলে এখানে দেখায় — শুধু পর্যালোচনার জন্য।
        </p>
      </div>
      {isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> যাচাই করা হচ্ছে…
        </p>
      ) : mismatches.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
          এই মুহূর্তে কোনো রিপোর্টের সময় ফোনের সঙ্গে মেলেনি এমন নেই।
        </p>
      ) : (
        <ul className="space-y-2">
          {mismatches.map((row) => (
            <li
              key={row.id}
              className={row.verifiedAt ? "flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3 opacity-80" : "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3"}
            >
              <div className="min-w-0 flex-1">
                <button
                  type="button"
                  disabled={!row.leadId}
                  onClick={() => row.leadId && onOpenLead(row.leadId)}
                  className="block max-w-full truncate text-left text-sm font-semibold text-primary hover:underline disabled:text-foreground disabled:no-underline"
                >
                  {row.leadName ?? row.phoneNumber ?? "অজানা নম্বর"}
                </button>
                <p className="truncate text-xs text-muted-foreground">
                  {row.phoneNumber ?? "—"}
                  {row.agentName ? ` · ${row.agentName}` : ""}
                  {` · ${fullDateTime(row.callEndedAt ?? row.submittedAt)}`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="outline" className="text-[11px]">
                  রিপোর্টে: {fmtSeconds(row.storedSeconds)}
                </Badge>
                <Badge variant="outline" className="text-[11px]">
                  ফোনে: {fmtSeconds(row.phoneSeconds)}
                </Badge>
                <Badge variant="destructive" className="text-[11px]">
                  ব্যবধান {fmtSeconds(row.differenceSeconds)}
                </Badge>
                {row.verifiedAt ? (
                  <Badge variant="secondary" className="gap-1 text-[11px]">
                    <BadgeCheck className="size-3" /> যাচাই হয়েছে{row.verifiedByName ? ` · ${row.verifiedByName}` : ""} · {fullDateTime(row.verifiedAt)}
                  </Badge>
                ) : (
                  <Button size="sm" variant="outline" disabled={mark.isPending} onClick={() => mark.mutate(row.id)}>
                    <BadgeCheck className="size-4" /> যাচাই করেছি
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
