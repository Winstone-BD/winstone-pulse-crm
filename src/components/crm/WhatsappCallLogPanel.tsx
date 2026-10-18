import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { listWhatsappCallAttempts } from "@/lib/call-reports.functions";
import { fullDateTime } from "@/lib/crm-format";
import { useAdminToken } from "@/lib/local-session";

function fmtSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return m > 0 ? `${m} মি ${s} সে` : `${s} সে`;
}

/** HQ/IT read-only log of WhatsApp call attempts. Agents get an empty list from the server. */
export function WhatsappCallLogPanel({ onOpenLead }: { onOpenLead: (leadId: string) => void }) {
  const adminToken = useAdminToken();
  const fetchAttempts = useServerFn(listWhatsappCallAttempts);
  const { data, isPending } = useQuery({
    queryKey: ["whatsapp-call-attempts", adminToken ? "pin" : "session"],
    queryFn: () => fetchAttempts({ data: { adminToken } }),
    refetchInterval: 60_000,
  });
  const attempts = data?.attempts ?? [];
  const pending = attempts.filter((a) => !a.submitted).length;

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <MessageCircle className="size-5 text-primary" /> WhatsApp কলের চেষ্টা ({attempts.length} · {pending} রিপোর্ট বাকি)
        </h2>
        <p className="text-xs text-muted-foreground sm:text-sm">
          এজেন্টরা CRM থেকে যেসব লিডে WhatsApp কল শুরু করেছেন। সময় এজেন্টের লেখা — ফোন WhatsApp কলের সময় মাপে না।
        </p>
      </div>
      {isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> লোড হচ্ছে…
        </p>
      ) : attempts.length === 0 ? (
        <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">এখনো কোনো WhatsApp কলের চেষ্টা নেই।</p>
      ) : (
        <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
          {attempts.map((row) => (
            <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background p-3">
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
                  {` · শুরু ${fullDateTime(row.startedAt)}`}
                </p>
              </div>
              {row.submitted ? (
                <Badge variant="outline" className="text-[11px]">
                  রিপোর্ট জমা · এজেন্টের লেখা সময় {fmtSeconds(row.typedSeconds ?? 0)}
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-[11px]">রিপোর্ট বাকি</Badge>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
