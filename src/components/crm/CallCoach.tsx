import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { GraduationCap } from "lucide-react";

import { getCallCoach } from "@/lib/sales-drafts.functions";
import { getAdminToken } from "@/lib/local-session";

/** After-call AI coach: scores the last submitted report against the buyer check. Advice only; saved to draft history. */
export function CallCoach({ leadId }: { leadId: string }) {
  const run = useServerFn(getCallCoach);
  const m = useMutation({ mutationFn: () => run({ data: { token: getAdminToken(), leadId } }) });
  const r = m.data;
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary"><GraduationCap className="size-4" /> কল কোচ</div>
        <button onClick={() => m.mutate()} disabled={m.isPending} className="rounded-md border border-primary px-3 py-1 text-xs font-semibold text-primary disabled:opacity-50">
          {m.isPending ? "বিশ্লেষণ হচ্ছে…" : "শেষ কল মূল্যায়ন"}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">শেষ জমা দেওয়া কল রিপোর্টকে ক্রেতা যাচাই অনুযায়ী স্কোর করে। শুধু পরামর্শ — কিছু পাঠানো হয় না।</p>
      {m.isError ? <p className="mt-2 text-xs text-destructive">{(m.error as Error).message}</p> : null}
      {r ? (
        <div className="mt-3 space-y-2 text-sm">
          {r.flagged ? <p className="text-xs text-destructive">নোটে সন্দেহজনক নির্দেশনা ছিল — তা উপেক্ষা করা হয়েছে।</p> : null}
          <p className="text-2xl font-semibold text-primary">{r.score}<span className="text-sm text-muted-foreground">/100</span></p>
          {r.covered.length ? <p><span className="text-muted-foreground">জানা গেছে: </span>{r.covered.join(" · ")}</p> : null}
          {r.missing.length ? <p><span className="text-muted-foreground">বাকি আছে: </span>{r.missing.join(" · ")}</p> : null}
          {r.praise ? <p><span className="text-muted-foreground">ভালো দিক: </span>{r.praise}</p> : null}
          {r.improve ? <p><span className="text-muted-foreground">উন্নতি: </span>{r.improve}</p> : null}
          <p className="rounded-md bg-primary/10 p-2"><b>পরের ফলো-আপ:</b> {r.next}{r.when ? ` (${r.when})` : ""}</p>
        </div>
      ) : null}
    </section>
  );
}
