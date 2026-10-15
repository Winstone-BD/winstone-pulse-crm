import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Handshake, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { getAdminToken } from "@/lib/local-session";
import { getNegotiationAdvice, getProjectCatalog } from "@/lib/sales-drafts.functions";

/** Safe negotiation advice from lead facts + verified catalog terms. Advice only; never offers discounts. */
export function NegotiationCoach({ leadId }: { leadId: string }) {
  const cat = useServerFn(getProjectCatalog);
  const run = useServerFn(getNegotiationAdvice);
  const [projectId, setProjectId] = useState("");
  const projects = useQuery({ queryKey: ["project-catalog"], queryFn: () => cat({ data: { token: getAdminToken() } }) });
  const advice = useMutation({
    mutationFn: () => run({ data: { token: getAdminToken(), leadId, projectId } }),
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "পরামর্শ তৈরি হয়নি"),
  });
  const d = advice.data;
  const List = ({ title, items, tone }: { title: string; items: string[]; tone?: string }) =>
    items.length ? (
      <div>
        <p className={`text-xs uppercase tracking-wide ${tone ?? "text-muted-foreground"}`}>{title}</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">{items.map((x) => <li key={x}>{x}</li>)}</ul>
      </div>
    ) : null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary">
        <Handshake className="size-4" /> দরকষাকষি সহায়ক
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        শুধু প্রকল্পের যাচাইকৃত শর্ত দিয়ে পরামর্শ — কোনো ছাড় বা মূল্য প্রতিশ্রুতি নয়; ছাড়ের অনুরোধ HQ অনুমোদনে যায়।
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select
          aria-label="প্রকল্প নির্বাচন"
          className="min-h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          <option value="">প্রকল্প বেছে নিন</option>
          {(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.name}{p.location ? ` · ${p.location}` : ""}</option>)}
        </select>
        <Button size="sm" variant="secondary" className="min-h-9" disabled={!projectId || advice.isPending} onClick={() => advice.mutate()}>
          {advice.isPending ? <Loader2 className="size-4 animate-spin" /> : null} পরামর্শ নিন
        </Button>
      </div>
      {d && (
        <div className="mt-3 space-y-3 text-sm">
          <p className="font-semibold">{d.project}: {d.position}</p>
          <List title="কৌশল" items={d.tactics} />
          <List title="যা দেওয়া যায় (তালিকাভুক্ত শর্তে)" items={d.allowed} />
          <List title="কখনো বলবেন না" items={d.never} tone="text-destructive" />
          {d.script && <div className="rounded-lg border border-border bg-muted/40 p-3">{d.script}</div>}
          {d.escalate && <p className="text-muted-foreground">HQ-তে পাঠান যখন: {d.escalate}</p>}
          {d.flagged && <p className="text-xs text-destructive">নোটে সন্দেহজনক নির্দেশ পাওয়া গেছে — উপেক্ষা করা হয়েছে।</p>}
        </div>
      )}
    </section>
  );
}
