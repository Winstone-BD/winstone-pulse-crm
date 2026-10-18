import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, GitCompareArrows, HelpCircle, Unplug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AppShell } from "@/components/crm/AppShell";
import { RoleGate } from "@/components/crm/RoleGate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { getAdminToken } from "@/lib/local-session";
import {
  CHECKLIST_KIND_LABEL,
  CHECKLIST_STATUSES,
  CHECKLIST_STATUS_LABEL,
  DEFAULT_STATE,
  MIGRATION_CHECKLIST,
  checklistProgress,
  type ChecklistItem,
  type ChecklistKind,
  type ChecklistState,
  type ChecklistStatus,
} from "@/lib/migration-checklist";
import {
  getMigrationChecklist,
  setMigrationChecklistItem,
} from "@/lib/migration-checklist.functions";

export const Route = createFileRoute("/migration")({
  head: () => ({
    meta: [
      { title: "মাইগ্রেশন চেকলিস্ট — Winstone Pulse" },
      {
        name: "description",
        content:
          "পুরনো CRM থেকে নতুন CRM-এ ডেটা আনার সিদ্ধান্ত, target নেই এমন field এবং ঝুঁকি এক জায়গায় ট্র্যাক করার বোর্ড।",
      },
      { property: "og:title", content: "মাইগ্রেশন চেকলিস্ট — Winstone Pulse" },
      {
        property: "og:description",
        content: "V1 → V2 ডেটা মাইগ্রেশনের সিদ্ধান্ত, ফাঁক ও ঝুঁকির অগ্রগতি বোর্ড।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MigrationPage,
});

function MigrationPage() {
  return (
    <AppShell>
      <RoleGate
        allow={["authority"]}
        icon={<GitCompareArrows className="size-7" />}
        title="মাইগ্রেশন চেকলিস্ট"
        description="পুরনো CRM থেকে ডেটা আনার সিদ্ধান্ত ও ঝুঁকির বোর্ড। মাস্টার পিন লাগবে।"
      >
        <MigrationBoard />
      </RoleGate>
    </AppShell>
  );
}

const KIND_ICON: Record<ChecklistKind, React.ReactNode> = {
  decision: <HelpCircle className="size-4" />,
  unmapped: <Unplug className="size-4" />,
  risk: <AlertTriangle className="size-4" />,
};

const STATUS_CLASS: Record<ChecklistStatus, string> = {
  open: "border-border/60 bg-muted/30 text-muted-foreground",
  in_progress: "border-primary/50 bg-primary/10 text-primary",
  resolved: "border-success/40 bg-success/10 text-success",
  skipped: "border-border/60 bg-muted/20 text-muted-foreground line-through",
};

function MigrationBoard() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | ChecklistKind>("all");
  const [onlyOpen, setOnlyOpen] = useState(false);

  const query = useQuery({
    queryKey: ["migration-checklist"],
    queryFn: () => getMigrationChecklist({ data: { adminToken: getAdminToken() } }),
  });
  const states = query.data?.states ?? {};

  const save = useMutation({
    mutationFn: (input: { id: string; status?: ChecklistStatus; note?: string }) =>
      setMigrationChecklistItem({ data: { adminToken: getAdminToken(), ...input } }),
    onSuccess: (result) => {
      queryClient.setQueryData(["migration-checklist"], result);
      toast.success("চেকলিস্ট সংরক্ষিত হয়েছে");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const progress = checklistProgress(states);
  const items = MIGRATION_CHECKLIST.filter(
    (item) =>
      (filter === "all" || item.kind === filter) &&
      (!onlyOpen || (states[item.id]?.status ?? "open") === "open"),
  );

  const countOf = (kind: ChecklistKind) =>
    MIGRATION_CHECKLIST.filter((i) => i.kind === kind).length;

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-border/60 bg-card/60 p-4 sm:p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">V1 → V2 মাইগ্রেশন অগ্রগতি</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              ম্যাপিং রিপোর্ট: <code className="text-xs">docs/migration-plan-v1-to-v2-full.md</code>{" "}
              — এই বোর্ড থেকে কোনো ডেটা সরানো হয় না, শুধু সিদ্ধান্ত ও ঝুঁকি ট্র্যাক হয়।
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-semibold tabular-nums text-primary">
              {progress.percent}%
            </div>
            <div className="text-xs text-muted-foreground">
              {progress.resolved + progress.skipped}/{progress.total} নিষ্পত্তি
            </div>
          </div>
        </div>
        <Progress value={progress.percent} className="mt-4" />
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(
            [
              ["বাকি", progress.open],
              ["কাজ চলছে", progress.inProgress],
              ["সমাধান", progress.resolved],
              ["বাদ", progress.skipped],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="rounded-xl border border-border/50 bg-background/40 p-3">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-xl font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ["all", `সব (${MIGRATION_CHECKLIST.length})`],
            ["decision", `${CHECKLIST_KIND_LABEL.decision} (${countOf("decision")})`],
            ["unmapped", `${CHECKLIST_KIND_LABEL.unmapped} (${countOf("unmapped")})`],
            ["risk", `${CHECKLIST_KIND_LABEL.risk} (${countOf("risk")})`],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            size="sm"
            variant={filter === key ? "default" : "outline"}
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
        <Button
          size="sm"
          variant={onlyOpen ? "default" : "outline"}
          onClick={() => setOnlyOpen((v) => !v)}
        >
          শুধু বাকিগুলো
        </Button>
      </div>

      {query.isPending ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl border border-border/50 bg-card/40" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="rounded-2xl border border-border/60 bg-card/50 p-6 text-center text-sm text-muted-foreground">
          এই ফিল্টারে কিছু বাকি নেই।
        </p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              state={states[item.id] ?? DEFAULT_STATE}
              saving={save.isPending}
              onSave={(input) => save.mutate({ id: item.id, ...input })}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ChecklistRow({
  item,
  state,
  saving,
  onSave,
}: {
  item: ChecklistItem;
  state: ChecklistState;
  saving: boolean;
  onSave: (input: { status?: ChecklistStatus; note?: string }) => void;
}) {
  const [note, setNote] = useState(state.note);
  const [open, setOpen] = useState(false);

  return (
    <li className="rounded-2xl border border-border/60 bg-card/60 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="gap-1.5">
              {KIND_ICON[item.kind]}
              {CHECKLIST_KIND_LABEL[item.kind]}
            </Badge>
            <span
              className={`rounded-full border px-2.5 py-0.5 text-xs ${STATUS_CLASS[state.status]}`}
            >
              {CHECKLIST_STATUS_LABEL[state.status]}
            </span>
          </div>
          <h3 className="mt-2 text-base font-semibold break-words">{item.title}</h3>
          <p className="mt-1 text-xs break-words text-muted-foreground">{item.scope}</p>
        </div>
        <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
          {open ? "গুটিয়ে নিন" : "বিস্তারিত"}
        </Button>
      </div>

      {open ? (
        <div className="mt-3 space-y-2 rounded-xl border border-border/50 bg-background/40 p-3 text-sm">
          <p className="break-words">{item.detail}</p>
          <p className="flex gap-2 break-words text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <strong className="text-foreground">প্রস্তাব:</strong> {item.suggestion}
            </span>
          </p>
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        {CHECKLIST_STATUSES.map((status) => (
          <Button
            key={status}
            size="sm"
            variant={state.status === status ? "default" : "outline"}
            disabled={saving}
            onClick={() => onSave({ status })}
          >
            {CHECKLIST_STATUS_LABEL[status]}
          </Button>
        ))}
      </div>

      <div className="mt-3 space-y-2">
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder="সিদ্ধান্ত বা মন্তব্য লিখুন…"
          rows={2}
          maxLength={1000}
        />
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs text-muted-foreground">
            {state.updatedAt
              ? `সর্বশেষ হালনাগাদ: ${new Date(state.updatedAt).toLocaleString("bn-BD", {
                  timeZone: "Asia/Dhaka",
                })} (ঢাকা)`
              : "এখনো কোনো মন্তব্য নেই"}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={saving || note === state.note}
            onClick={() => onSave({ note })}
          >
            মন্তব্য সংরক্ষণ
          </Button>
        </div>
      </div>
    </li>
  );
}
