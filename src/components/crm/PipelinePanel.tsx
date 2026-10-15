import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { BarChart3, Loader2, RotateCcw } from "lucide-react";

import { getAdminToken } from "@/lib/local-session";
import { askPipeline } from "@/lib/pipeline-intel.functions";
import { PIPELINE_QUESTIONS, type PipelineQuestion } from "@/lib/pipeline-intel";
import { useLang } from "@/lib/i18n";

/** Winstone AI · Pipeline: fixed questions answered from real database counts (no model guesses). */
export function PipelinePanel() {
  const run = useServerFn(askPipeline);
  const { lang } = useLang();
  const m = useMutation({ mutationFn: (q: PipelineQuestion) => run({ data: { token: getAdminToken(), question: q } }) });
  const asked = m.variables ? PIPELINE_QUESTIONS.find((q) => q.id === m.variables) : null;
  return (
    <section className="card-elevated p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-primary"><BarChart3 className="size-4" /> Winstone AI · Pipeline</div>
      <p className="mt-1 text-xs text-muted-foreground">{lang === "bn" ? "সংখ্যাগুলো সরাসরি CRM রেকর্ড থেকে গোনা — অনুমান নয়।" : "Numbers are counted directly from CRM records — never estimated."}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PIPELINE_QUESTIONS.map((q) => (
          <button key={q.id} disabled={m.isPending} onClick={() => m.mutate(q.id)} className="rounded-full border border-border px-3 py-1 text-xs hover:border-primary hover:text-primary disabled:opacity-50">
            {lang === "bn" ? q.bn : q.en}
          </button>
        ))}
      </div>
      {m.isPending ? <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Counting…</p> : null}
      {m.isError ? (
        <div className="mt-3 flex items-center gap-2 text-sm text-destructive">
          {(m.error as Error).message}
          {m.variables ? <button onClick={() => m.mutate(m.variables!)} className="inline-flex items-center gap-1 underline"><RotateCcw className="size-3" /> Retry</button> : null}
        </div>
      ) : null}
      {m.data && asked ? (
        <div className="mt-3 rounded-lg border border-border p-3 text-sm">
          <p className="font-semibold">{lang === "bn" ? asked.bn : asked.en}</p>
          <ul className="mt-2 list-disc space-y-0.5 pl-5">{m.data.lines.map((l) => <li key={l}>{l}</li>)}</ul>
          <p className="mt-2 text-xs text-muted-foreground">{m.data.scope} · {m.data.period} · {m.data.limits}</p>
        </div>
      ) : null}
    </section>
  );
}
