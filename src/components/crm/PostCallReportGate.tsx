import { EVALUATION_QUESTIONS, categoryForScore, type EvaluationKey } from "@/lib/lead-evaluation";
import { CONTACT_CLOSE_REASONS } from "@/lib/contact-close-reasons";
import { FOLLOW_UP_REASONS, type FollowUpReasonCode } from "@/lib/follow-up-reasons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bot, Check, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { DictateButton } from "@/components/crm/DictateButton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { myPendingReport, submitMyReport } from "@/lib/call-reports.functions";
import { listInventory } from "@/lib/inventory.functions";
import { useAdminToken } from "@/lib/local-session";
import { enqueue, subscribeQueue } from "@/lib/offline-queue";

/**
 * Post-Call Smart Report.
 *
 *   CALL ENDED -> AI ANALYSIS -> agent Confirms / Changes each row -> SUBMIT
 *
 * AI only recommends (with a one-line reason). Nothing is saved until the agent
 * picks every required value himself — tapping "Confirm" is that pick. The
 * server re-checks the same rules, so the desk can never skip them.
 */

type Opt = { value: string; label: string };

const CATEGORIES: Opt[] = [
  { value: "hot_lead", label: "HOT LEAD" },
  { value: "follow_up", label: "FOLLOW UP" },
  { value: "interested", label: "INTERESTED" },
  { value: "callback", label: "CALLBACK" },
  { value: "not_interested", label: "NOT INTERESTED" },
  { value: "no_answer", label: "NO ANSWER" },
  { value: "wrong_number", label: "WRONG NUMBER" },
  { value: "closed_converted", label: "CLOSED / CONVERTED" },
];
const NEEDS_REASON = new Set(["not_interested", "wrong_number"]);

const CALL_STATES: Opt[] = [
  { value: "connected", label: "Connected — কথা হয়েছে" },
  { value: "no_answer", label: "Not Connected — ধরেনি" },
  { value: "busy", label: "Busy — ব্যস্ত" },
  { value: "failed", label: "Failed — কল যায়নি" },
];
const DIRECTIONS: Opt[] = [
  { value: "outgoing", label: "আউটগোয়িং — আমি কল করেছি" },
  { value: "incoming", label: "ইনকামিং — ক্রেতা কল করেছেন" },
];
const INTEREST: Opt[] = [
  { value: "high", label: "High — বেশি" },
  { value: "medium", label: "Medium — মাঝারি" },
  { value: "low", label: "Low — কম" },
  { value: "fake", label: "Fake / Invalid" },
];
const RESPONSES: Opt[] = [
  { value: "interested", label: "Interested" },
  { value: "need_info", label: "Need More Information" },
  { value: "price_concern", label: "Price Concern" },
  { value: "family_discussion", label: "Family Discussion" },
  { value: "need_time", label: "Need Time" },
  { value: "site_visit", label: "Site Visit Interested" },
  { value: "decide_later", label: "Will Decide Later" },
  { value: "not_interested", label: "Not Interested" },
  { value: "other", label: "Other" },
];
const NEXT_ACTIONS: Opt[] = [
  { value: "call_again", label: "Call Again" },
  { value: "send_details", label: "Send Details" },
  { value: "send_price", label: "Send Price" },
  { value: "site_visit", label: "Arrange Site Visit" },
  { value: "send_location", label: "Send Location" },
  { value: "no_action", label: "No Action" },
  { value: "other", label: "Other" },
];
const NO_FU_REASONS: Opt[] = CONTACT_CLOSE_REASONS.map((r) => ({ value: r.code, label: r.label }));
export const _LEGACY_TEMPERATURES: Opt[] = [
  { value: "hot", label: "HOT" },
  { value: "warm", label: "WARM" },
  { value: "cold", label: "COLD" },
];
const GRADES: Opt[] = ["A", "B", "C", "D"].map((g) => ({ value: g, label: g }));

const labelOf = (opts: Opt[], value: string) => opts.find((o) => o.value === value)?.label ?? value;

/** datetime-local value in the browser's own clock. */
function localInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

type Rec = { value: string; reason: string };
type Recs = Partial<
  Record<
    | "category"
    | "interest"
    | "requirement"
    | "response"
    | "nextAction"
    | "followUp"
    | "temperature"
    | "grade",
    Rec
  >
>;

type Suggestion = {
  summary: string[];
  requirements: string[];
  objections: string[];
  interest: "high" | "medium" | "low" | "unknown";
  suggestedCategory: string | null;
  suggestedTemperature: string | null;
  suggestedGrade: string | null;
} | null;

/** Recommendations from the stored call analysis only — nothing invented. */
function buildRecs(connected: boolean, s: Suggestion, inventory: string[]): Recs {
  if (!connected) {
    return { category: { value: "no_answer", reason: "কল ধরেনি — লিড কিউ-এর শেষে আবার আসবে।" } };
  }
  if (!s) return {};
  const recs: Recs = {};
  const objections = s.objections.join(" ").toLowerCase();
  const text = [...s.summary, ...s.requirements].join(" ").toLowerCase();

  if (s.suggestedCategory) {
    recs.category = {
      value: s.suggestedCategory,
      reason:
        s.suggestedCategory === "follow_up"
          ? "আগ্রহ আছে, তবে সিদ্ধান্ত এখনো হয়নি।"
          : s.suggestedCategory === "hot_lead"
            ? "কথায় ইতিবাচক সাড়া পাওয়া গেছে।"
            : s.suggestedCategory === "callback"
              ? "ক্রেতা পরে কল করতে বলেছেন।"
              : s.suggestedCategory === "not_interested"
                ? "কথায় স্পষ্ট অনাগ্রহ।"
                : "কল বিশ্লেষণ অনুযায়ী।",
    };
  }
  if (s.interest !== "unknown") {
    recs.interest = {
      value: s.interest,
      reason: s.interest === "high" ? "কথার সুর ইতিবাচক।" : s.interest === "medium" ? "নিরপেক্ষ সুর।" : "নেতিবাচক সুর।",
    };
  }
  const req = inventory.find((label) => text.includes(label.toLowerCase()));
  if (req) recs.requirement = { value: req, reason: `কথায় "${req}" এর উল্লেখ আছে।` };

  let response: Rec | null = null;
  if (/দাম|price|বাজেট|budget/.test(objections)) response = { value: "price_concern", reason: "দাম নিয়ে আপত্তি ছিল।" };
  else if (/পরিবার|family|ফ্যামিলি/.test(objections + text)) response = { value: "family_discussion", reason: "পরিবারের সাথে আলোচনা করবেন।" };
  else if (/সাইট|visit|ভিজিট/.test(text)) response = { value: "site_visit", reason: "সাইট দেখতে আগ্রহী।" };
  else if (/সময়|time|পরে/.test(objections)) response = { value: "need_time", reason: "সময় চেয়েছেন।" };
  else if (s.interest === "high") response = { value: "interested", reason: "আগ্রহ দেখিয়েছেন।" };
  if (response) recs.response = response;

  const cat = s.suggestedCategory ?? "";
  if (["follow_up", "callback", "hot_lead", "interested"].includes(cat)) {
    recs.nextAction = { value: "call_again", reason: "আলোচনা চালিয়ে যেতে আবার কল দরকার।" };
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);
    recs.followUp = { value: localInput(tomorrow), reason: "আবার আলোচনার জন্য পরের দিন বিকেল।" };
  } else if (cat === "not_interested" || cat === "closed_converted") {
    recs.nextAction = { value: "no_action", reason: "আর কোনো কাজ বাকি নেই।" };
  }
  if (s.suggestedTemperature)
    recs.temperature = { value: s.suggestedTemperature, reason: "কল বিশ্লেষণের তাপমাত্রা।" };
  if (s.suggestedGrade) recs.grade = { value: s.suggestedGrade, reason: "কল বিশ্লেষণের গ্রেড।" };
  return recs;
}

/** One report row: AI recommendation (Confirm / Skip) + the agent's own pick. */
function SmartRow({
  id,
  label,
  required,
  options,
  value,
  onChange,
  rec,
  onSkip,
  skipped,
}: {
  id: string;
  label: string;
  required?: boolean;
  options: Opt[];
  value: string;
  onChange: (value: string) => void;
  rec?: Rec | undefined;
  skipped?: boolean | undefined;
  onSkip?: (() => void) | undefined;
}) {
  const confirmed = Boolean(rec && value === rec.value);
  return (
    <div className="space-y-1.5 rounded-lg border border-border bg-card p-2.5">
      <Label htmlFor={id} className="text-xs font-semibold">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {rec && !skipped ? (
        <div
          className={`flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-xs ${
            confirmed ? "bg-success/10" : "bg-primary/5"
          }`}
        >
          <Bot className="size-3.5 shrink-0 text-primary" />
          <span className="font-bold">{labelOf(options, rec.value)}</span>
          <span className="min-w-0 flex-1 text-muted-foreground">{rec.reason}</span>
          {confirmed ? (
            <span className="flex items-center gap-1 font-semibold text-success">
              <Check className="size-3.5" /> নিশ্চিত
            </span>
          ) : (
            <>
              <Button type="button" size="sm" className="h-7 gap-1 px-2 text-[11px]" onClick={() => onChange(rec.value)}>
                <Check className="size-3" /> Confirm
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-[11px]" onClick={onSkip}>
                <X className="size-3" /> Skip
              </Button>
            </>
          )}
        </div>
      ) : null}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">{rec && !skipped ? "Change — অন্যটি বাছাই করুন" : "বাছাই করুন"}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function PostCallReportGate() {
  const adminToken = useAdminToken();
  const queryClient = useQueryClient();
  const fetchPending = useServerFn(myPendingReport);
  const submit = useServerFn(submitMyReport);
  const fetchInventory = useServerFn(listInventory);

  const pending = useQuery({
    queryKey: ["pending-call-report", adminToken ? "pin" : "session"],
    queryFn: () => fetchPending({ data: { adminToken } }),
    refetchInterval: 20_000,
  });
  const detail = pending.data;

  const inventory = useQuery({
    queryKey: ["inventory-requirements"],
    enabled: Boolean(detail),
    staleTime: 5 * 60_000,
    queryFn: () => fetchInventory({ data: { adminToken } }),
  });
  const inventoryOpts: Opt[] = useMemo(
    () => (inventory.data?.items ?? []).map((i) => ({ value: i.label, label: i.label })),
    [inventory.data],
  );

  const [direction, setDirection] = useState("");
  const [callState, setCallState] = useState("");
  const [duration, setDuration] = useState("");
  const [category, setCategory] = useState("");
  const [interest, setInterest] = useState("");
  const [requirement, setRequirement] = useState("");
  const [response, setResponse] = useState("");
  const [responseNote, setResponseNote] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [nextActionNote, setNextActionNote] = useState("");
  const [followMode, setFollowMode] = useState<"set" | "none">("set");
  const [when, setWhen] = useState("");
  const [fuReason, setFuReason] = useState<FollowUpReasonCode | null>(null);
  const [fuReasonNote, setFuReasonNote] = useState("");
  const [noFuReason, setNoFuReason] = useState("");
  const [noFuNote, setNoFuNote] = useState("");
  const [answers, setAnswers] = useState<Partial<Record<EvaluationKey, boolean>>>({});
  const answeredAll = EVALUATION_QUESTIONS.every((q) => typeof answers[q.key] === "boolean");
  const liveScore = EVALUATION_QUESTIONS.reduce((n, q) => n + (answers[q.key] ? q.points : 0), 0);
  const temperature = answeredAll ? categoryForScore(liveScore) : "";
  const [grade, setGrade] = useState("");
  const [voiceNote, setVoiceNote] = useState("");
  const [skipped, setSkipped] = useState<Record<string, boolean>>({});
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  const [queuedReportIds, setQueuedReportIds] = useState<string[]>([]);
  useEffect(
    () =>
      subscribeQueue((items) =>
        setQueuedReportIds(
          items
            .filter((item) => item.kind === "report_submit")
            .map((item) => String(item.payload["reportId"] ?? "")),
        ),
      ),
    [],
  );

  const reportId = detail?.report?.id ?? null;
  useEffect(() => {
    setCategory("");
    setInterest("");
    setRequirement("");
    setResponse("");
    setResponseNote("");
    setNextAction("");
    setNextActionNote("");
    setFollowMode("set");
    setWhen("");
    setNoFuReason("");
    setNoFuNote("");
    setAnswers({});
    setGrade("");
    setVoiceNote("");
    setSkipped({});
    setDismissedId(null);
    if (!detail) {
      setDirection("");
      setCallState("");
      setDuration("");
      return;
    }
    // What the phone already measured is filled in — the agent can correct it.
    setDirection(detail.recording?.call_direction === "incoming_callback" ? "incoming" : "outgoing");
    setCallState(detail.report.connected === false ? "no_answer" : "connected");
    setDuration(String(detail.report.duration_seconds ?? 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  const connected = callState === "connected";
  const suggestion = (detail?.suggestion ?? null) as Suggestion;
  const recs = useMemo(
    () => buildRecs(connected, suggestion, inventoryOpts.map((o) => o.value)),
    [connected, suggestion, inventoryOpts],
  );
  const skip = (key: string) => () => setSkipped((prev) => ({ ...prev, [key]: true }));

  if (!detail || queuedReportIds.includes(detail.report.id)) return null;

  const seconds = Math.max(0, Math.round(Number(duration) || 0));
  const noFuLabel = noFuReason
    ? `${labelOf(NO_FU_REASONS, noFuReason)}${noFuReason === "other" && noFuNote.trim() ? ` — ${noFuNote.trim()}` : ""}`
    : "";
  const responseLabel = response
    ? `${labelOf(RESPONSES, response)}${response === "other" && responseNote.trim() ? ` — ${responseNote.trim()}` : ""}`
    : "";
  const actionLabel = nextAction
    ? `${labelOf(NEXT_ACTIONS, nextAction)}${nextAction === "other" && nextActionNote.trim() ? ` — ${nextActionNote.trim()}` : ""}`
    : "";
  const reasonText = noFuLabel || (connected && response === "not_interested" ? responseLabel : "");

  // First missing requirement, in form order.
  const missing: string | null = !direction
    ? "কলের দিক বাছাই করুন"
    : !callState
      ? "Call Status বাছাই করুন"
      : connected && seconds < 1
        ? "কথা হওয়া কলের সময়কাল (সেকেন্ড) দিন"
        : !category
          ? "Lead Category বাছাই করুন (Confirm বা Change)"
          : connected && category === "no_answer"
            ? "কথা হওয়া কলে NO ANSWER দেওয়া যাবে না"
            : connected && !interest
              ? "Customer Interest বাছাই করুন"
              : connected && !requirement
                ? "Requirement বাছাই করুন"
                : connected && !response
                  ? "Customer Response বাছাই করুন"
                  : connected && response === "other" && responseNote.trim().length < 2
                    ? "Customer Response-এ Other হলে ছোট নোট দিন"
                    : connected && !nextAction
                      ? "Next Action বাছাই করুন"
                      : connected && nextAction === "other" && nextActionNote.trim().length < 2
                        ? "Next Action-এ Other হলে ছোট নোট দিন"
                        : connected && !answeredAll
                          ? "ছয়টি প্রশ্নের সবগুলোর হ্যাঁ / না দিন"
                          : connected && !grade
                            ? "Grade (A / B / C / D) বাছাই করুন"
                            : connected && followMode === "set" && !when
                              ? "Follow-up সময় দিন, নয়তো 'No Follow-up Required' বাছাই করুন"
                              : connected && followMode === "none" && !noFuReason
                                ? "Follow-up না লাগার কারণ বাছাই করুন"
                                : connected && noFuReason === "other" && noFuNote.trim().length < 2
                                  ? "কারণ Other হলে ছোট নোট দিন"
                                  : NEEDS_REASON.has(category) && !reasonText
                                    ? "NOT INTERESTED / WRONG NUMBER-এ 'No Follow-up Required' বেছে কারণ দিন"
                                    : null;

  const aiUsed = Object.keys(recs).length > 0;
  const aiAllConfirmed =
    aiUsed &&
    (recs.category?.value === category || !recs.category) &&
    (recs.temperature?.value === temperature || !recs.temperature) &&
    (recs.grade?.value === grade || !recs.grade);

  const payloadOf = () => {
    const summary = connected
      ? [
          `আগ্রহ: ${labelOf(INTEREST, interest)}`,
          `চাহিদা: ${requirement}`,
          `প্রতিক্রিয়া: ${responseLabel}`,
        ].join(" · ")
      : `কল অবস্থা: ${labelOf(CALL_STATES, callState)}`;
    const note =
      [connected ? `পরের কাজ: ${actionLabel}` : "কথা হয়নি — কিউ-এর শেষে আবার কল হবে", voiceNote.trim()]
        .filter(Boolean)
        .join(" — ");
    const followUpAt = connected && followMode === "set" && when ? new Date(when).toISOString() : null;
    const smartReasons: Record<string, string> = {};
    for (const [key, rec] of Object.entries(recs)) if (rec) smartReasons[key] = `${rec.value}: ${rec.reason}`;
    return {
      adminToken,
      reportId: detail.report.id,
      category,
      summary,
      note,
      reason: reasonText || null,
      followUpAt,
      followUpReason: followUpAt ? fuReason : null,
      followUpReasonNote: followUpAt && fuReason === "other" ? fuReasonNote.trim() || null : null,
      reminderMinutes: 30,
      temperature: connected ? (temperature as "hot" | "warm" | "cold") : null,
      grade: connected ? (grade as "A" | "B" | "C" | "D") : null,
      aiDecision: aiUsed ? (aiAllConfirmed ? ("accepted" as const) : ("edited" as const)) : null,
      direction: direction as "outgoing" | "incoming",
      callStatus: callState as "connected" | "no_answer" | "busy" | "failed",
      durationSeconds: seconds,
      followUpNeeded: Boolean(followUpAt),
      followUpNote: followUpAt
        ? null
        : connected
          ? noFuNote.trim() || null
          : "কথা হয়নি — কিউ-এর শেষে আবার আসবে",
      interest: connected ? (interest as "high" | "medium" | "low" | "fake") : null,
      requirement: connected ? requirement : null,
      customerResponse: connected ? response : null,
      nextAction: connected ? nextAction : null,
      noFollowUpReason: followUpAt ? null : connected ? noFuReason || null : "not_connected",
      smartReasons: Object.keys(smartReasons).length ? smartReasons : null,
      evaluationAnswers: connected && answeredAll ? (answers as Record<string, boolean>) : null,
    };
  };

  return (
    <ReportDialog
      detail={detail}
      dismissed={dismissedId === detail.report.id}
      onDismiss={() => setDismissedId(detail.report.id)}
      onReopen={() => setDismissedId(null)}
      payloadOf={payloadOf}
      missing={missing}
      submit={submit}
      queryClient={queryClient}
    >
      <div className="space-y-2 rounded-xl border border-primary/25 bg-primary/5 p-3">
        <p className="flex items-center gap-1.5 text-xs font-bold text-primary">
          <Bot className="size-3.5" /> AI Analysis
        </p>
        <p className="text-[11px] text-muted-foreground">
          {aiUsed
            ? "কলের তথ্য থেকে সম্ভাব্য রিপোর্ট সাজানো হয়েছে। প্রতিটি ঘরে Confirm চাপুন, অথবা নিচের তালিকা থেকে বদলান।"
            : connected
              ? "এই কলের AI বিশ্লেষণ এখনো নেই — প্রতিটি ঘর নিজে বাছাই করুন।"
              : "কথা হয়নি — শুধু ক্যাটাগরি নিশ্চিত করুন।"}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <SmartRow id="sr-direction" label="কলের দিক" required options={DIRECTIONS} value={direction} onChange={setDirection} />
        <SmartRow id="sr-status" label="Call Status" required options={CALL_STATES} value={callState} onChange={setCallState} />
      </div>
      {!connected && callState ? (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          কথা হয়নি — লিডটি কিউ-এর শেষে চলে যাবে এবং আবার নিজে থেকেই আসবে।
        </p>
      ) : null}
      {connected ? (
        <div className="space-y-1">
          <Label htmlFor="sr-duration" className="text-xs font-semibold">
            সময়কাল (সেকেন্ড) <span className="text-destructive">*</span>
          </Label>
          <Input
            id="sr-duration"
            type="number"
            min={0}
            inputMode="numeric"
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
          />
        </div>
      ) : null}

      <SmartRow
        id="sr-category"
        label="Lead Category"
        required
        options={CATEGORIES}
        value={category}
        onChange={setCategory}
        rec={recs.category}
        skipped={skipped["category"]}
        onSkip={skip("category")}
      />

      {connected ? (
        <>
          <SmartRow id="sr-interest" label="Customer Interest" required options={INTEREST} value={interest} onChange={setInterest} rec={recs.interest} skipped={skipped["interest"]} onSkip={skip("interest")} />
          <SmartRow
            id="sr-requirement"
            label="Requirement"
            required
            options={inventoryOpts}
            value={requirement}
            onChange={setRequirement}
            rec={recs.requirement}
            skipped={skipped["requirement"]}
            onSkip={skip("requirement")}
          />
          {inventory.isSuccess && inventoryOpts.length === 0 ? (
            <p className="text-[11px] text-destructive">ইনভেন্টরি তালিকা খালি — HQ-কে ইনভেন্টরি পেজে যোগ করতে বলুন।</p>
          ) : null}
          <SmartRow id="sr-response" label="Customer Response" required options={RESPONSES} value={response} onChange={setResponse} rec={recs.response} skipped={skipped["response"]} onSkip={skip("response")} />
          {response === "other" ? (
            <Input value={responseNote} maxLength={120} onChange={(e) => setResponseNote(e.target.value)} placeholder="ছোট নোট" aria-label="Customer Response নোট" />
          ) : null}
          <SmartRow id="sr-next" label="Next Action" required options={NEXT_ACTIONS} value={nextAction} onChange={(v) => { setNextAction(v); if (v === "call_again") setFollowMode("set"); }} rec={recs.nextAction} skipped={skipped["nextAction"]} onSkip={skip("nextAction")} />
          {nextAction === "other" ? (
            <Input value={nextActionNote} maxLength={120} onChange={(e) => setNextActionNote(e.target.value)} placeholder="ছোট নোট" aria-label="Next Action নোট" />
          ) : null}

          <div className="space-y-2 rounded-lg border border-border bg-card p-2.5">
            <p className="text-xs font-semibold">
              Follow-up <span className="text-destructive">*</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["set", "none"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setFollowMode(mode)}
                  aria-pressed={followMode === mode}
                  className={`rounded-md border px-2 py-2 text-xs font-medium transition ${
                    followMode === mode ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  {mode === "set" ? "Follow-up দিন" : "No Follow-up Required"}
                </button>
              ))}
            </div>
            {followMode === "set" ? (
              <>
                {recs.followUp && !skipped["followUp"] ? (
                  <div className={`flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-xs ${when === recs.followUp.value ? "bg-success/10" : "bg-primary/5"}`}>
                    <Bot className="size-3.5 text-primary" />
                    <span className="font-bold">
                      {new Date(recs.followUp.value).toLocaleString("bn-BD", { weekday: "short", hour: "numeric", minute: "2-digit" })}
                    </span>
                    <span className="min-w-0 flex-1 text-muted-foreground">{recs.followUp.reason}</span>
                    {when === recs.followUp.value ? (
                      <span className="flex items-center gap-1 font-semibold text-success"><Check className="size-3.5" /> নিশ্চিত</span>
                    ) : (
                      <>
                        <Button type="button" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setWhen(recs.followUp!.value)}>
                          <Check className="size-3" /> Accept
                        </Button>
                        <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={skip("followUp")}>
                          <X className="size-3" /> Skip
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
                <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="ফলো-আপের তারিখ ও সময়" />
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">কেন ফলো-আপ?</p>
                  <div className="flex flex-wrap gap-1">
                    {FOLLOW_UP_REASONS.map((r) => (
                      <button
                        key={r.code}
                        type="button"
                        onClick={() => setFuReason(r.code)}
                        aria-pressed={fuReason === r.code}
                        className={`rounded-full border px-2 py-1 text-[11px] font-medium ${fuReason === r.code ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground"}`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                  {fuReason === "other" && (
                    <Input value={fuReasonNote} maxLength={120} onChange={(e) => setFuReasonNote(e.target.value)} placeholder="ছোট নোট (ঐচ্ছিক)" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  রিমাইন্ডার: ৩০ মিনিট আগে, ১৫ মিনিট আগে এবং ঠিক সময়ে — শব্দসহ। সময়ে কল না হলে Overdue দেখাবে।
                </p>
              </>
            ) : (
              <>
                <select
                  value={noFuReason}
                  onChange={(e) => setNoFuReason(e.target.value)}
                  aria-label="Follow-up না লাগার কারণ"
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">কারণ বাছাই করুন *</option>
                  {NO_FU_REASONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                {noFuReason === "other" ? (
                  <Input value={noFuNote} maxLength={200} onChange={(e) => setNoFuNote(e.target.value)} placeholder="ছোট নোট" aria-label="কারণের নোট" />
                ) : null}
              </>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5 rounded-lg border border-border p-2.5 sm:col-span-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>লিড মূল্যায়ন (শুধু হ্যাঁ / না)</span>
                <span aria-live="polite">স্কোর {liveScore}/90{temperature ? ` · ${temperature.toUpperCase()} (স্বয়ংক্রিয়)` : ""}</span>
              </div>
              {EVALUATION_QUESTIONS.map((q) => (
                <div key={q.key} className="flex items-center justify-between gap-2 text-xs">
                  <span>{q.label} <span className="text-muted-foreground">+{q.points}</span></span>
                  <div className="flex gap-1">
                    {[true, false].map((v) => (
                      <Button key={String(v)} type="button" size="sm" variant={answers[q.key] === v ? "default" : "outline"} className="h-7 px-2" onClick={() => setAnswers((a) => ({ ...a, [q.key]: v }))}>
                        {v ? "হ্যাঁ" : "না"}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <SmartRow id="sr-grade" label="Grade" required options={GRADES} value={grade} onChange={setGrade} rec={recs.grade} skipped={skipped["grade"]} onSkip={skip("grade")} />
          </div>
        </>
      ) : null}

      <div className="space-y-1.5 rounded-lg border border-dashed border-border p-2.5">
        <div className="flex items-center justify-between gap-2">
          <Label htmlFor="sr-voice" className="text-xs">Voice Note (ঐচ্ছিক)</Label>
          <DictateButton onAppend={(text) => setVoiceNote((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))} />
        </div>
        <Textarea id="sr-voice" rows={2} value={voiceNote} onChange={(e) => setVoiceNote(e.target.value)} placeholder="চাইলে মুখে ১০–২০ সেকেন্ড বলুন — ছোট নোট হয়ে যাবে" />
      </div>
    </ReportDialog>
  );
}

/** Dialog shell + submit (online or saved offline). */
function ReportDialog({
  detail,
  dismissed,
  onDismiss,
  onReopen,
  payloadOf,
  missing,
  submit,
  queryClient,
  children,
}: {
  detail: NonNullable<Awaited<ReturnType<typeof myPendingReport>>>;
  dismissed: boolean;
  onDismiss: () => void;
  onReopen: () => void;
  payloadOf: () => Record<string, unknown> & { reportId: string };
  missing: string | null;
  submit: ReturnType<typeof useServerFn<typeof submitMyReport>>;
  queryClient: ReturnType<typeof useQueryClient>;
  children: React.ReactNode;
}) {
  const send = useMutation({
    mutationFn: async () => {
      const payload = payloadOf();
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueue("report_submit", `কল রিপোর্ট (${detail.lead?.name ?? "লিড"})`, {
          ...payload,
          clientEventId: `report-${detail.report.id}`,
        });
        return { offline: true as const };
      }
      await submit({ data: payload } as never);
      return { offline: false as const };
    },
    onSuccess: (result) => {
      toast.success(
        result.offline
          ? "ইন্টারনেট নেই — রিপোর্ট এই ফোনে সেভ হয়েছে, নেট ফিরলে নিজেই সার্ভারে যাবে"
          : "রিপোর্ট জমা হয়েছে — পরের লিড খুলে গেল",
      );
      void queryClient.invalidateQueries({ queryKey: ["pending-call-report"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-snapshot"] });
      void queryClient.invalidateQueries({ queryKey: ["follow-ups"] });
      void queryClient.invalidateQueries({ queryKey: ["followup-reminders"] });
      // Call mode on the desk listens for this to open the next suitable lead.
      window.dispatchEvent(
        new CustomEvent("winstone:report-submitted", {
          detail: { leadId: (detail.lead as { id?: string } | null)?.id ?? null },
        }),
      );
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const secs = Math.max(0, detail.report.duration_seconds ?? 0);
  const durationLabel = secs >= 60 ? `${Math.floor(secs / 60)} মি ${secs % 60} সে` : `${secs} সে`;

  return (
    <>
      {dismissed ? (
        <Button className="fixed bottom-4 right-4 z-50 gap-1.5 shadow-lg" onClick={onReopen}>
          <AlertTriangle className="size-4" /> কল রিপোর্ট বাকি আছে — খুলুন
        </Button>
      ) : null}
      <Dialog open={!dismissed} onOpenChange={(open) => (!open ? onDismiss() : undefined)}>
        <DialogContent className="h-[100dvh] max-h-[100dvh] w-full max-w-lg space-y-1 overflow-y-auto rounded-none p-4 pb-8 sm:h-auto sm:max-h-[90vh] sm:rounded-xl sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning" /> Post-Call Smart Report
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs">
            <div className="min-w-0">
              <p className="truncate font-semibold">{detail.lead?.name ?? "লিড"}</p>
              <p className="truncate tabular-nums text-muted-foreground">
                {detail.lead?.phone_number ?? detail.report.phone_number ?? ""}
              </p>
            </div>
            <p className="font-semibold tabular-nums">
              {durationLabel}
              {detail.report.connected ? "" : " · কথা হয়নি"}
            </p>
          </div>
          {(detail.queuedCount ?? 0) > 0 ? (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              আরও {detail.queuedCount}টি কলের রিপোর্ট অপেক্ষায় — এটি জমা দিলেই পরেরটি খুলবে।
            </p>
          ) : null}
          <div className="space-y-2">{children}</div>
          {missing ? (
            <p role="status" aria-live="polite" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-medium">
              জমা দিতে বাকি: {missing}
            </p>
          ) : null}
          <Button className="w-full" disabled={Boolean(missing) || send.isPending} onClick={() => send.mutate()}>
            {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Confirm &amp; Submit
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            রিপোর্ট জমা না দিলে পরের কল শুরু করা যাবে না।
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
