import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Globe, Loader2, Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAdminToken } from "@/lib/local-session";
import { askWebsite } from "@/lib/website-knowledge.functions";

type Answer = {
  answer: string;
  covered: boolean;
  sources: { url: string; title: string; live: boolean }[];
  documents?: { fileId: string; name: string }[];
};

const QUICK = ["প্রকল্পের দাম কত?", "অবস্থান কোথায়?", "কী কী সুবিধা আছে?"];

/**
 * Agent helper: ask the company website a question and get a Bengali answer
 * grounded only in the website's own pages.
 */
export function WebsiteAnswerBox({
  leadContext,
  compact = false,
}: {
  leadContext?: string | null;
  compact?: boolean;
}) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const ask = useServerFn(askWebsite);

  const run = useMutation({
    mutationFn: (text: string) =>
      ask({
        data: { adminToken: getAdminToken() ?? null, question: text, leadContext: leadContext ?? null },
      }),
    onSuccess: (result) => setAnswer(result as Answer),
    onError: (error: Error) =>
      setAnswer({ answer: error.message, covered: false, sources: [], documents: [] }),
  });

  const submit = (text: string) => {
    const value = text.trim();
    if (value.length < 2 || run.isPending) return;
    setQuestion(value);
    run.mutate(value);
  };

  return (
    <div className={compact ? "rounded-lg border border-border p-3" : "rounded-2xl border border-border bg-card p-4"}>
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Globe className="size-3.5" /> ওয়েবসাইট থেকে উত্তর
      </p>

      <form
        className="mt-2 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          submit(question);
        }}
      >
        <Input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="গ্রাহকের প্রশ্ন লিখুন"
          className="h-9 text-sm"
        />
        <Button type="submit" size="sm" className="h-9" disabled={run.isPending}>
          {run.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {QUICK.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => submit(item)}
            className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:bg-surface-2"
          >
            {item}
          </button>
        ))}
      </div>

      {answer ? (
        <div className="mt-3 space-y-1.5">
          <p className="text-sm">{answer.answer}</p>
          {answer.sources.length > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              সূত্র:{" "}
              {answer.sources.map((source, index) => (
                <span key={source.url}>
                  {index > 0 ? ", " : ""}
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {source.title}
                  </a>
                  {source.live ? " (এখনকার)" : ""}
                </span>
              ))}
            </p>
          ) : null}
          {answer.documents && answer.documents.length > 0 ? (
            <p className="text-[11px] text-muted-foreground">
              অনুমোদিত ডকুমেন্ট: {answer.documents.map((doc) => doc.name).join(", ")}
            </p>
          ) : null}
          {!answer.covered ? (
            <p className="text-[11px] text-amber-600 dark:text-amber-400">
              ওয়েবসাইটে নিশ্চিত তথ্য নেই — অনুমান করে বলবেন না।
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
