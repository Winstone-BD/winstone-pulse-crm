import {
  EVALUATION_QUESTIONS,
  EVALUATION_QUESTIONS_LABEL_EN,
  categoryForScore,
  type EvaluationKey,
} from "@/lib/lead-evaluation";
import { CONTACT_CLOSE_REASONS, contactCloseReasonLabelFor } from "@/lib/contact-close-reasons";
import {
  FOLLOW_UP_REASONS,
  FOLLOW_UP_REASONS_EN,
  type FollowUpReasonCode,
} from "@/lib/follow-up-reasons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bot, Check, Loader2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { clearReportDraft, loadReportDraft, saveReportDraft } from "@/lib/report-draft";
import { toast } from "sonner";

import { createSaveLatch, matchCallShortcut, SHORTCUT_LABELS } from "@/lib/call-shortcuts";
import { useLang, useT, type Lang } from "@/lib/i18n";
import { OutreachTemplates } from "@/components/crm/OutreachTemplates";
import { DictateButton } from "@/components/crm/DictateButton";
import {
  DEFAULT_RETRY_PICK,
  NoAnswerRetryPicker,
  type RetryPick,
} from "@/components/crm/NoAnswerRetryPicker";
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
 * {t({bn:"কলের রিপোর্ট",en:"Call report"})}.
 *
 *   CALL ENDED -> AI ANALYSIS -> agent Confirms / Changes each row -> SUBMIT
 *
 * AI only recommends (with a one-line reason). Nothing is saved until the agent
 * picks every required value himself — tapping "Confirm" is that pick. The
 * server re-checks the same rules, so the desk can never skip them.
 */

type Opt = { value: string; label: string };

function categoriesFor(lang: Lang): Opt[] {
  return lang === "bn"
    ? [
        { value: "hot_lead", label: "হট লিড" },
        { value: "follow_up", label: "ফলো-আপ" },
        { value: "interested", label: "আগ্রহী" },
        { value: "callback", label: "কলব্যাক" },
        { value: "not_interested", label: "অনাগ্রহী" },
        { value: "no_answer", label: "কল ধরেনি" },
        { value: "wrong_number", label: "ভুল নম্বর" },
        { value: "closed_converted", label: "বন্ধ / কনভার্টেড" },
      ]
    : [
        { value: "hot_lead", label: "HOT LEAD" },
        { value: "follow_up", label: "FOLLOW UP" },
        { value: "interested", label: "INTERESTED" },
        { value: "callback", label: "CALLBACK" },
        { value: "not_interested", label: "NOT INTERESTED" },
        { value: "no_answer", label: "NO ANSWER" },
        { value: "wrong_number", label: "WRONG NUMBER" },
        { value: "closed_converted", label: "CLOSED / CONVERTED" },
      ];
}
const NEEDS_REASON = new Set(["not_interested", "wrong_number"]);

function callStatesFor(lang: Lang): Opt[] {
  return lang === "bn"
    ? [
        { value: "connected", label: "কথা হয়েছে" },
        { value: "no_answer", label: "ধরেনি" },
        { value: "busy", label: "ব্যস্ত" },
        { value: "failed", label: "কল যায়নি" },
      ]
    : [
        { value: "connected", label: "Connected" },
        { value: "no_answer", label: "Not Connected" },
        { value: "busy", label: "Busy" },
        { value: "failed", label: "Failed" },
      ];
}
function directionsFor(lang: Lang): Opt[] {
  return lang === "bn"
    ? [
        { value: "outgoing", label: "আউটগোয়িং — আমি কল করেছি" },
        { value: "incoming", label: "ইনকামিং — ক্রেতা কল করেছেন" },
      ]
    : [
        { value: "outgoing", label: "Outgoing — I called" },
        { value: "incoming", label: "Incoming — customer called" },
      ];
}
function interestFor(lang: Lang): Opt[] {
  return lang === "bn"
    ? [
        { value: "high", label: "বেশি" },
        { value: "medium", label: "মাঝারি" },
        { value: "low", label: "কম" },
        { value: "fake", label: "ভুয়া / অবৈধ" },
      ]
    : [
        { value: "high", label: "High" },
        { value: "medium", label: "Medium" },
        { value: "low", label: "Low" },
        { value: "fake", label: "Fake / Invalid" },
      ];
}
function responsesFor(lang: Lang): Opt[] {
  return lang === "bn"
    ? [
        { value: "interested", label: "আগ্রহী" },
        { value: "need_info", label: "আরও তথ্য প্রয়োজন" },
        { value: "price_concern", label: "দাম নিয়ে আপত্তি" },
        { value: "family_discussion", label: "পরিবারের সাথে আলোচনা" },
        { value: "need_time", label: "সময় প্রয়োজন" },
        { value: "site_visit", label: "সাইট ভিজিটে আগ্রহী" },
        { value: "decide_later", label: "পরে সিদ্ধান্ত নেবেন" },
        { value: "not_interested", label: "অনাগ্রহী" },
        { value: "other", label: "অন্যান্য" },
      ]
    : [
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
}
function nextActionsFor(lang: Lang): Opt[] {
  return lang === "bn"
    ? [
        { value: "call_again", label: "আবার কল করুন" },
        { value: "send_details", label: "বিস্তারিত পাঠান" },
        { value: "send_price", label: "দাম পাঠান" },
        { value: "site_visit", label: "সাইট ভিজিট ঠিক করুন" },
        { value: "send_location", label: "লোকেশন পাঠান" },
        { value: "no_action", label: "কোনো কাজ নেই" },
        { value: "other", label: "অন্যান্য" },
      ]
    : [
        { value: "call_again", label: "Call Again" },
        { value: "send_details", label: "Send Details" },
        { value: "send_price", label: "Send Price" },
        { value: "site_visit", label: "Arrange Site Visit" },
        { value: "send_location", label: "Send Location" },
        { value: "no_action", label: "No Action" },
        { value: "other", label: "Other" },
      ];
}
function noFuReasonsFor(lang: Lang): Opt[] {
  return CONTACT_CLOSE_REASONS.map((r) => ({
    value: r.code,
    label: contactCloseReasonLabelFor(r.code, lang),
  }));
}
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
function buildRecs(connected: boolean, s: Suggestion, inventory: string[], lang: Lang): Recs {
  if (!connected) {
    return {
      category: {
        value: "no_answer",
        reason:
          lang === "bn"
            ? "কল ধরেনি — লিড কিউ-এর শেষে আবার আসবে।"
            : "No answer — the lead will come back to the end of the queue.",
      },
    };
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
          ? lang === "bn"
            ? "আগ্রহ আছে, তবে সিদ্ধান্ত এখনো হয়নি।"
            : "Interested, but no decision yet."
          : s.suggestedCategory === "hot_lead"
            ? lang === "bn"
              ? "কথায় ইতিবাচক সাড়া পাওয়া গেছে।"
              : "Positive response in the call."
            : s.suggestedCategory === "callback"
              ? lang === "bn"
                ? "ক্রেতা পরে কল করতে বলেছেন।"
                : "Customer asked to be called back later."
              : s.suggestedCategory === "not_interested"
                ? lang === "bn"
                  ? "কথায় স্পষ্ট অনাগ্রহ।"
                  : "Clear disinterest in the call."
                : lang === "bn"
                  ? "কল বিশ্লেষণ অনুযায়ী।"
                  : "Based on call analysis.",
    };
  }
  if (s.interest !== "unknown") {
    recs.interest = {
      value: s.interest,
      reason:
        s.interest === "high"
          ? lang === "bn"
            ? "কথার সুর ইতিবাচক।"
            : "Positive tone in the call."
          : s.interest === "medium"
            ? lang === "bn"
              ? "নিরপেক্ষ সুর।"
              : "Neutral tone."
            : lang === "bn"
              ? "নেতিবাচক সুর।"
              : "Negative tone.",
    };
  }
  const req = inventory.find((label) => text.includes(label.toLowerCase()));
  if (req)
    recs.requirement = {
      value: req,
      reason:
        lang === "bn" ? `কথায় "${req}" এর উল্লেখ আছে।` : `"${req}" was mentioned in the call.`,
    };

  let response: Rec | null = null;
  if (/দাম|price|বাজেট|budget/.test(objections))
    response = {
      value: "price_concern",
      reason: lang === "bn" ? "দাম নিয়ে আপত্তি ছিল।" : "There was an objection about price.",
    };
  else if (/পরিবার|family|ফ্যামিলি/.test(objections + text))
    response = {
      value: "family_discussion",
      reason: lang === "bn" ? "পরিবারের সাথে আলোচনা করবেন।" : "Will discuss with family.",
    };
  else if (/সাইট|visit|ভিজিট/.test(text))
    response = {
      value: "site_visit",
      reason: lang === "bn" ? "সাইট দেখতে আগ্রহী।" : "Interested in seeing the site.",
    };
  else if (/সময়|time|পরে/.test(objections))
    response = {
      value: "need_time",
      reason: lang === "bn" ? "সময় চেয়েছেন।" : "Asked for more time.",
    };
  else if (s.interest === "high")
    response = {
      value: "interested",
      reason: lang === "bn" ? "আগ্রহ দেখিয়েছেন।" : "Showed interest.",
    };
  if (response) recs.response = response;

  const cat = s.suggestedCategory ?? "";
  if (["follow_up", "callback", "hot_lead", "interested"].includes(cat)) {
    recs.nextAction = {
      value: "call_again",
      reason:
        lang === "bn"
          ? "আলোচনা চালিয়ে যেতে আবার কল দরকার।"
          : "Another call is needed to continue the discussion.",
    };
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(17, 0, 0, 0);
    recs.followUp = {
      value: localInput(tomorrow),
      reason:
        lang === "bn"
          ? "আবার আলোচনার জন্য পরের দিন বিকেল।"
          : "Tomorrow afternoon, for a follow-up discussion.",
    };
  } else if (cat === "not_interested" || cat === "closed_converted") {
    recs.nextAction = {
      value: "no_action",
      reason: lang === "bn" ? "আর কোনো কাজ বাকি নেই।" : "No further action needed.",
    };
  }
  if (s.suggestedTemperature)
    recs.temperature = {
      value: s.suggestedTemperature,
      reason: lang === "bn" ? "কল বিশ্লেষণের তাপমাত্রা।" : "Temperature from call analysis.",
    };
  if (s.suggestedGrade)
    recs.grade = {
      value: s.suggestedGrade,
      reason: lang === "bn" ? "কল বিশ্লেষণের গ্রেড।" : "Grade from call analysis.",
    };
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
  const t = useT();
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
              <Check className="size-3.5" /> {t({ bn: "নিশ্চিত", en: "Confirmed" })}
            </span>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                className="h-7 gap-1 px-2 text-[11px]"
                onClick={() => onChange(rec.value)}
              >
                <Check className="size-3" /> {t({ bn: "Confirm", en: "Confirm" })}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 gap-1 px-2 text-[11px]"
                onClick={onSkip}
              >
                <X className="size-3" /> {t({ bn: "Skip", en: "Skip" })}
              </Button>
            </>
          )}
        </div>
      ) : null}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-md border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="">
          {rec && !skipped
            ? t({ bn: "Change — অন্যটি বাছাই করুন", en: "Change — pick another" })
            : t({ bn: "বাছাই করুন", en: "Select" })}
        </option>
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
  const t = useT();
  const lang = useLang();
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

  const CATEGORIES = useMemo(() => categoriesFor(lang), [lang]);
  const CALL_STATES = useMemo(() => callStatesFor(lang), [lang]);
  const DIRECTIONS = useMemo(() => directionsFor(lang), [lang]);
  const INTEREST = useMemo(() => interestFor(lang), [lang]);
  const RESPONSES = useMemo(() => responsesFor(lang), [lang]);
  const NEXT_ACTIONS = useMemo(() => nextActionsFor(lang), [lang]);
  const NO_FU_REASONS = useMemo(() => noFuReasonsFor(lang), [lang]);

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
  const [retryPick, setRetryPick] = useState<RetryPick>(DEFAULT_RETRY_PICK);
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
  const draftReadyRef = useRef<string | null>(null);
  useEffect(() => {
    draftReadyRef.current = null;
    setCategory("");
    setInterest("");
    setRequirement("");
    setResponse("");
    setResponseNote("");
    setNextAction("");
    setNextActionNote("");
    setFollowMode("set");
    setRetryPick(DEFAULT_RETRY_PICK);
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
    setDirection(
      detail.recording?.call_direction === "incoming_callback" ? "incoming" : "outgoing",
    );
    setCallState(detail.report.connected === false ? "no_answer" : "connected");
    setDuration(String(detail.report.duration_seconds ?? 0));
    setFuReason(null);
    setFuReasonNote("");
    // Autosave recovery: refill what the agent had typed before a reload.
    const draft = loadReportDraft(detail.report.id);
    if (draft) {
      const str = (k: string) => (typeof draft[k] === "string" ? (draft[k] as string) : null);
      const set = (k: string, fn: (v: string) => void) => {
        const v = str(k);
        if (v !== null) fn(v);
      };
      set("direction", setDirection);
      set("callState", setCallState);
      set("duration", setDuration);
      set("category", setCategory);
      set("interest", setInterest);
      set("requirement", setRequirement);
      set("response", setResponse);
      set("responseNote", setResponseNote);
      set("nextAction", setNextAction);
      set("nextActionNote", setNextActionNote);
      set("when", setWhen);
      set("fuReasonNote", setFuReasonNote);
      set("noFuReason", setNoFuReason);
      set("noFuNote", setNoFuNote);
      set("grade", setGrade);
      set("voiceNote", setVoiceNote);
      if (draft["followMode"] === "set" || draft["followMode"] === "none")
        setFollowMode(draft["followMode"]);
      if (typeof draft["fuReason"] === "string")
        setFuReason(draft["fuReason"] as FollowUpReasonCode);
      if (draft["answers"] && typeof draft["answers"] === "object") {
        setAnswers(draft["answers"] as Partial<Record<EvaluationKey, boolean>>);
      }
      toast.info(
        lang === "bn"
          ? "আপনার অসমাপ্ত রিপোর্ট ফিরিয়ে আনা হয়েছে"
          : "Your unfinished report was restored",
      );
    }
    draftReadyRef.current = detail.report.id;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  // Autosave every change (debounced) so a reload never loses typed work.
  useEffect(() => {
    if (!reportId || draftReadyRef.current !== reportId) return;
    const timer = setTimeout(() => {
      saveReportDraft(reportId, {
        direction,
        callState,
        duration,
        category,
        interest,
        requirement,
        response,
        responseNote,
        nextAction,
        nextActionNote,
        followMode,
        when,
        fuReason,
        fuReasonNote,
        noFuReason,
        noFuNote,
        answers,
        grade,
        voiceNote,
      });
    }, 400);
    return () => clearTimeout(timer);
  }, [
    reportId,
    direction,
    callState,
    duration,
    category,
    interest,
    requirement,
    response,
    responseNote,
    nextAction,
    nextActionNote,
    followMode,
    when,
    fuReason,
    fuReasonNote,
    noFuReason,
    noFuNote,
    answers,
    grade,
    voiceNote,
  ]);

  const connected = callState === "connected";
  const suggestion = (detail?.suggestion ?? null) as Suggestion;
  const recs = useMemo(
    () =>
      buildRecs(
        connected,
        suggestion,
        inventoryOpts.map((o) => o.value),
        lang,
      ),
    [connected, suggestion, inventoryOpts, lang],
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
    ? t({ bn: "কলের দিক বাছাই করুন", en: "Select the call direction" })
    : !callState
      ? t({ bn: "Call Status বাছাই করুন", en: "Select Call Status" })
      : connected && seconds < 1
        ? t({
            bn: "কথা হওয়া কলের সময়কাল (সেকেন্ড) দিন",
            en: "Enter the connected call's duration (seconds)",
          })
        : !connected &&
            retryPick.mode === "custom" &&
            (!retryPick.customAt || Date.parse(retryPick.customAt) <= Date.now())
          ? t({ bn: "ভবিষ্যতের তারিখ ও সময় বাছাই করুন", en: "Pick a future date and time" })
          : !category
            ? t({
                bn: "Lead Category বাছাই করুন (Confirm বা Change)",
                en: "Select Lead Category (Confirm or Change)",
              })
            : connected && category === "no_answer"
              ? t({
                  bn: "কথা হওয়া কলে NO ANSWER দেওয়া যাবে না",
                  en: "A connected call cannot be marked NO ANSWER",
                })
              : connected && !interest
                ? t({ bn: "Customer Interest বাছাই করুন", en: "Select Customer Interest" })
                : connected && !requirement
                  ? t({ bn: "Requirement বাছাই করুন", en: "Select Requirement" })
                  : connected && !response
                    ? t({ bn: "Customer Response বাছাই করুন", en: "Select Customer Response" })
                    : connected && response === "other" && responseNote.trim().length < 2
                      ? t({
                          bn: "Customer Response-এ Other হলে ছোট নোট দিন",
                          en: "Add a short note when Customer Response is Other",
                        })
                      : connected && !nextAction
                        ? t({ bn: "Next Action বাছাই করুন", en: "Select Next Action" })
                        : connected && nextAction === "other" && nextActionNote.trim().length < 2
                          ? t({
                              bn: "Next Action-এ Other হলে ছোট নোট দিন",
                              en: "Add a short note when Next Action is Other",
                            })
                          : connected && !answeredAll
                            ? t({
                                bn: "ছয়টি প্রশ্নের সবগুলোর হ্যাঁ / না দিন",
                                en: "Answer Yes / No for all six questions",
                              })
                            : connected && !grade
                              ? t({
                                  bn: "Grade (A / B / C / D) বাছাই করুন",
                                  en: "Select Grade (A / B / C / D)",
                                })
                              : connected && followMode === "set" && !when
                                ? t({
                                    bn: "Follow-up সময় দিন, নয়তো 'No Follow-up Required' বাছাই করুন",
                                    en: "Set a follow-up time, or select 'No Follow-up Required'",
                                  })
                                : connected && followMode === "none" && !noFuReason
                                  ? t({
                                      bn: "Follow-up না লাগার কারণ বাছাই করুন",
                                      en: "Select why no follow-up is needed",
                                    })
                                  : connected &&
                                      noFuReason === "other" &&
                                      noFuNote.trim().length < 2
                                    ? t({
                                        bn: "কারণ Other হলে ছোট নোট দিন",
                                        en: "Add a short note when the reason is Other",
                                      })
                                    : NEEDS_REASON.has(category) && !reasonText
                                      ? t({
                                          bn: "NOT INTERESTED / WRONG NUMBER-এ 'No Follow-up Required' বেছে কারণ দিন",
                                          en: "For NOT INTERESTED / WRONG NUMBER, select 'No Follow-up Required' and give a reason",
                                        })
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
          `${t({ bn: "আগ্রহ", en: "Interest" })}: ${labelOf(INTEREST, interest)}`,
          `${t({ bn: "চাহিদা", en: "Requirement" })}: ${requirement}`,
          `${t({ bn: "প্রতিক্রিয়া", en: "Response" })}: ${responseLabel}`,
        ].join(" · ")
      : `${t({ bn: "কল অবস্থা", en: "Call status" })}: ${labelOf(CALL_STATES, callState)}`;
    const note = [
      connected
        ? `${t({ bn: "পরের কাজ", en: "Next action" })}: ${actionLabel}`
        : t({
            bn: "কথা হয়নি — কিউ-এর শেষে আবার কল হবে",
            en: "No answer — will be called again from the end of the queue",
          }),
      voiceNote.trim(),
    ]
      .filter(Boolean)
      .join(" — ");
    const followUpAt =
      connected && followMode === "set" && when ? new Date(when).toISOString() : null;
    const smartReasons: Record<string, string> = {};
    for (const [key, rec] of Object.entries(recs))
      if (rec) smartReasons[key] = `${rec.value}: ${rec.reason}`;
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
          : t({
              bn: "কথা হয়নি — কিউ-এর শেষে আবার আসবে",
              en: "No answer — will come back to the end of the queue",
            }),
      interest: connected ? (interest as "high" | "medium" | "low" | "fake") : null,
      requirement: connected ? requirement : null,
      customerResponse: connected ? response : null,
      nextAction: connected ? nextAction : null,
      noFollowUpReason: followUpAt ? null : connected ? noFuReason || null : "not_connected",
      smartReasons: Object.keys(smartReasons).length ? smartReasons : null,
      evaluationAnswers: connected && answeredAll ? (answers as Record<string, boolean>) : null,
      retryPlan:
        !connected && (callState === "no_answer" || callState === "busy")
          ? {
              mode: retryPick.mode,
              slot: retryPick.slot,
              time: retryPick.slot === "custom" && retryPick.time ? retryPick.time : null,
              customAt:
                retryPick.mode === "custom" && retryPick.customAt
                  ? new Date(retryPick.customAt).toISOString()
                  : null,
            }
          : null,
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
          <Bot className="size-3.5" /> {t({ bn: "রিপোর্টের সাজেশন", en: "Report suggestions" })}
        </p>
        <p className="text-[11px] text-muted-foreground">
          {aiUsed
            ? t({
                bn: "কলের তথ্য থেকে সম্ভাব্য রিপোর্ট সাজানো হয়েছে। প্রতিটি ঘরে Confirm চাপুন, অথবা নিচের তালিকা থেকে বদলান।",
                en: "A likely report was drafted from the call. Tap Confirm on each row, or change it from the list below.",
              })
            : connected
              ? t({
                  bn: "এই কলের AI বিশ্লেষণ এখনো নেই — প্রতিটি ঘর নিজে বাছাই করুন।",
                  en: "No AI analysis yet for this call — pick each field yourself.",
                })
              : t({
                  bn: "কথা হয়নি — শুধু ক্যাটাগরি নিশ্চিত করুন।",
                  en: "No answer — just confirm the category.",
                })}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <SmartRow
          id="sr-direction"
          label={t({ bn: "কলের দিক", en: "Call direction" })}
          required
          options={DIRECTIONS}
          value={direction}
          onChange={setDirection}
        />
        <SmartRow
          id="sr-status"
          label={t({ bn: "কলের অবস্থা", en: "Call Status" })}
          required
          options={CALL_STATES}
          value={callState}
          onChange={setCallState}
        />
      </div>
      {!connected && (callState === "no_answer" || callState === "busy") ? (
        <NoAnswerRetryPicker value={retryPick} onChange={setRetryPick} />
      ) : !connected && callState ? (
        <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
          {t({
            bn: "কথা হয়নি — লিডটি কিউ-এর শেষে চলে যাবে এবং আবার নিজে থেকেই আসবে।",
            en: "No answer — the lead will go to the end of the queue and come back on its own.",
          })}
        </p>
      ) : null}
      {connected ? (
        <div className="space-y-1">
          <Label htmlFor="sr-duration" className="text-xs font-semibold">
            {t({ bn: "সময়কাল (সেকেন্ড)", en: "Duration (seconds)" })}{" "}
            <span className="text-destructive">*</span>
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
        label={t({ bn: "ফলাফল", en: "Lead Category" })}
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
          <SmartRow
            id="sr-interest"
            label={t({ bn: "আগ্রহ", en: "Customer Interest" })}
            required
            options={INTEREST}
            value={interest}
            onChange={setInterest}
            rec={recs.interest}
            skipped={skipped["interest"]}
            onSkip={skip("interest")}
          />
          <SmartRow
            id="sr-requirement"
            label={t({ bn: "চাহিদা", en: "Requirement" })}
            required
            options={inventoryOpts}
            value={requirement}
            onChange={setRequirement}
            rec={recs.requirement}
            skipped={skipped["requirement"]}
            onSkip={skip("requirement")}
          />
          {inventory.isSuccess && inventoryOpts.length === 0 ? (
            <p className="text-[11px] text-destructive">
              {t({
                bn: "ইনভেন্টরি তালিকা খালি — HQ-কে ইনভেন্টরি পেজে যোগ করতে বলুন।",
                en: "Inventory list is empty — ask HQ to add items on the Inventory page.",
              })}
            </p>
          ) : null}
          <SmartRow
            id="sr-response"
            label={t({ bn: "গ্রাহকের উত্তর", en: "Customer Response" })}
            required
            options={RESPONSES}
            value={response}
            onChange={setResponse}
            rec={recs.response}
            skipped={skipped["response"]}
            onSkip={skip("response")}
          />
          {response === "other" ? (
            <Input
              value={responseNote}
              maxLength={120}
              onChange={(e) => setResponseNote(e.target.value)}
              placeholder={t({ bn: "ছোট নোট", en: "Short note" })}
              aria-label={t({ bn: "Customer Response নোট", en: "Customer Response note" })}
            />
          ) : null}
          <SmartRow
            id="sr-next"
            label={t({ bn: "পরের কাজ", en: "Next Action" })}
            required
            options={NEXT_ACTIONS}
            value={nextAction}
            onChange={(v) => {
              setNextAction(v);
              if (v === "call_again") setFollowMode("set");
            }}
            rec={recs.nextAction}
            skipped={skipped["nextAction"]}
            onSkip={skip("nextAction")}
          />
          {nextAction === "other" ? (
            <Input
              value={nextActionNote}
              maxLength={120}
              onChange={(e) => setNextActionNote(e.target.value)}
              placeholder={t({ bn: "ছোট নোট", en: "Short note" })}
              aria-label={t({ bn: "Next Action নোট", en: "Next Action note" })}
            />
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
                    followMode === mode
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  {mode === "set"
                    ? t({ bn: "Follow-up দিন", en: "Set follow-up" })
                    : t({ bn: "No Follow-up Required", en: "No Follow-up Required" })}
                </button>
              ))}
            </div>
            {followMode === "set" ? (
              <>
                {recs.followUp && !skipped["followUp"] ? (
                  <div
                    className={`flex flex-wrap items-center gap-2 rounded-md px-2 py-1.5 text-xs ${when === recs.followUp.value ? "bg-success/10" : "bg-primary/5"}`}
                  >
                    <Bot className="size-3.5 text-primary" />
                    <span className="font-bold">
                      {new Date(recs.followUp.value).toLocaleString(
                        lang === "bn" ? "bn-BD" : "en-GB",
                        { weekday: "short", hour: "numeric", minute: "2-digit" },
                      )}
                    </span>
                    <span className="min-w-0 flex-1 text-muted-foreground">
                      {recs.followUp.reason}
                    </span>
                    {when === recs.followUp.value ? (
                      <span className="flex items-center gap-1 font-semibold text-success">
                        <Check className="size-3.5" /> {t({ bn: "নিশ্চিত", en: "Confirmed" })}
                      </span>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 px-2 text-[11px]"
                          onClick={() => setWhen(recs.followUp!.value)}
                        >
                          <Check className="size-3" /> {t({ bn: "Accept", en: "Accept" })}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px]"
                          onClick={skip("followUp")}
                        >
                          <X className="size-3" /> {t({ bn: "Skip", en: "Skip" })}
                        </Button>
                      </>
                    )}
                  </div>
                ) : null}
                <Input
                  type="datetime-local"
                  value={when}
                  onChange={(e) => setWhen(e.target.value)}
                  aria-label={t({ bn: "ফলো-আপের তারিখ ও সময়", en: "Follow-up date and time" })}
                />
                <div className="space-y-1">
                  <p className="text-[11px] font-semibold text-muted-foreground">
                    {t({ bn: "কেন ফলো-আপ?", en: "Why follow up?" })}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(lang === "bn" ? FOLLOW_UP_REASONS : FOLLOW_UP_REASONS_EN).map((r) => (
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
                    <Input
                      value={fuReasonNote}
                      maxLength={120}
                      onChange={(e) => setFuReasonNote(e.target.value)}
                      placeholder={t({ bn: "ছোট নোট (ঐচ্ছিক)", en: "Short note (optional)" })}
                    />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {t({
                    bn: "রিমাইন্ডার: ৩০ মিনিট আগে, ১৫ মিনিট আগে এবং ঠিক সময়ে — শব্দসহ। সময়ে কল না হলে Overdue দেখাবে।",
                    en: "Reminders: 30 minutes before, 15 minutes before and right on time — with sound. Shows Overdue if not called in time.",
                  })}
                </p>
              </>
            ) : (
              <>
                <select
                  value={noFuReason}
                  onChange={(e) => setNoFuReason(e.target.value)}
                  aria-label={t({
                    bn: "Follow-up না লাগার কারণ",
                    en: "Reason no follow-up is needed",
                  })}
                  className="min-h-11 w-full rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="">{t({ bn: "কারণ বাছাই করুন", en: "Select a reason" })} *</option>
                  {NO_FU_REASONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
                {noFuReason === "other" ? (
                  <Input
                    value={noFuNote}
                    maxLength={200}
                    onChange={(e) => setNoFuNote(e.target.value)}
                    placeholder={t({ bn: "ছোট নোট", en: "Short note" })}
                    aria-label={t({ bn: "কারণের নোট", en: "Reason note" })}
                  />
                ) : null}
              </>
            )}
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5 rounded-lg border border-border p-2.5 sm:col-span-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span>
                  {t({
                    bn: "লিড মূল্যায়ন (শুধু হ্যাঁ / না)",
                    en: "Lead evaluation (Yes / No only)",
                  })}
                </span>
                <span aria-live="polite">
                  {t({ bn: "স্কোর", en: "Score" })} {liveScore}/90
                  {temperature
                    ? ` · ${temperature.toUpperCase()} (${t({ bn: "স্বয়ংক্রিয়", en: "automatic" })})`
                    : ""}
                </span>
              </div>
              {EVALUATION_QUESTIONS.map((q) => (
                <div key={q.key} className="flex items-center justify-between gap-2 text-xs">
                  <span>
                    {lang === "bn" ? q.label : EVALUATION_QUESTIONS_LABEL_EN[q.key]}{" "}
                    <span className="text-muted-foreground">+{q.points}</span>
                  </span>
                  <div className="flex gap-1">
                    {[true, false].map((v) => (
                      <Button
                        key={String(v)}
                        type="button"
                        size="sm"
                        variant={answers[q.key] === v ? "default" : "outline"}
                        className="h-7 px-2"
                        onClick={() => setAnswers((a) => ({ ...a, [q.key]: v }))}
                      >
                        {v ? t({ bn: "হ্যাঁ", en: "Yes" }) : t({ bn: "না", en: "No" })}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <SmartRow
              id="sr-grade"
              label={t({ bn: "গ্রেড", en: "Grade" })}
              required
              options={GRADES}
              value={grade}
              onChange={setGrade}
              rec={recs.grade}
              skipped={skipped["grade"]}
              onSkip={skip("grade")}
            />
          </div>
        </>
      ) : null}

      <details className="border-t border-border pt-3">
        <summary className="min-h-11 cursor-pointer text-sm font-medium">
          {t({ bn: "নিজের নোট · ঐচ্ছিক", en: "Agent note · optional" })}
        </summary>
        <div className="space-y-1.5 rounded-lg border border-dashed border-border p-2.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="sr-voice" className="text-xs">
              {t({ bn: "Voice Note (ঐচ্ছিক)", en: "Voice Note (optional)" })}
            </Label>
            <DictateButton
              onAppend={(text) =>
                setVoiceNote((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text))
              }
            />
          </div>
          <Textarea
            id="sr-voice"
            rows={2}
            value={voiceNote}
            onChange={(e) => setVoiceNote(e.target.value)}
            placeholder={t({
              bn: "চাইলে মুখে ১০–২০ সেকেন্ড বলুন — ছোট নোট হয়ে যাবে",
              en: "Optionally speak for 10–20 seconds — it will become a short note",
            })}
          />
        </div>
      </details>
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
  const t = useT();
  const send = useMutation({
    mutationFn: async () => {
      const payload = payloadOf();
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        enqueue(
          "report_submit",
          `${t({ bn: "কল রিপোর্ট", en: "Call report" })} (${detail.lead?.name ?? t({ bn: "লিড", en: "lead" })})`,
          {
            ...payload,
            clientEventId: `report-${detail.report.id}`,
          },
        );
        return { offline: true as const };
      }
      await submit({ data: payload } as never);
      return { offline: false as const };
    },
    onSuccess: (result) => {
      clearReportDraft(detail.report.id);
      toast.success(
        result.offline
          ? t({
              bn: "ইন্টারনেট নেই — রিপোর্ট এই ফোনে সেভ হয়েছে, নেট ফিরলে নিজেই সার্ভারে যাবে",
              en: "No internet — the report is saved on this phone and will sync once you're back online",
            })
          : t({
              bn: "রিপোর্ট জমা হয়েছে — পরের লিড খুলে গেল",
              en: "Report submitted — the next lead has opened",
            }),
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

  // Ctrl/⌘+Enter runs the exact same send.mutate() as the button, under the same guards.
  const latchRef = useRef(createSaveLatch());
  const guardRef = { missing, pending: send.isPending, open: !dismissed };
  useEffect(() => {
    if (dismissed) return;
    const onKey = (e: KeyboardEvent) => {
      if (matchCallShortcut(e) !== "save") return;
      const dialog = document.querySelector("[data-call-report-dialog]");
      if (
        !dialog ||
        !(e.target instanceof Node) ||
        !(dialog.contains(e.target) || e.target === document.body)
      )
        return;
      e.preventDefault();
      const r = latchRef.current.try(guardRef, () =>
        send.mutate(undefined, { onSettled: () => latchRef.current.release() }),
      );
      if (r === "blocked" && guardRef.missing)
        toast.error(`${t({ bn: "জমা দিতে বাকি", en: "Still required" })}: ${guardRef.missing}`);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const secs = Math.max(0, detail.report.duration_seconds ?? 0);
  const durationLabel =
    secs >= 60
      ? `${Math.floor(secs / 60)} ${t({ bn: "মি", en: "m" })} ${secs % 60} ${t({ bn: "সে", en: "s" })}`
      : `${secs} ${t({ bn: "সে", en: "s" })}`;

  return (
    <>
      {dismissed ? (
        <Button className="fixed bottom-4 right-4 z-50 gap-1.5 shadow-lg" onClick={onReopen}>
          <AlertTriangle className="size-4" />{" "}
          {t({ bn: "কল রিপোর্ট বাকি আছে — খুলুন", en: "Call report pending — open it" })}
        </Button>
      ) : null}
      <Dialog open={!dismissed} onOpenChange={(open) => (!open ? onDismiss() : undefined)}>
        <DialogContent
          data-call-report-dialog
          className="h-[100dvh] max-h-[100dvh] w-full max-w-lg space-y-1 overflow-y-auto rounded-none p-4 pb-8 sm:h-auto sm:max-h-[90vh] sm:rounded-xl sm:p-6"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="size-4 text-warning" />{" "}
              {t({ bn: "কলের রিপোর্ট", en: "Call report" })}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs">
            <div className="min-w-0">
              <p className="truncate font-semibold">
                {detail.lead?.name ?? t({ bn: "লিড", en: "Lead" })}
              </p>
              <p className="truncate tabular-nums text-muted-foreground">
                {detail.lead?.phone_number ?? detail.report.phone_number ?? ""}
              </p>
            </div>
            <p className="font-semibold tabular-nums">
              {durationLabel}
              {detail.report.connected ? "" : ` · ${t({ bn: "কথা হয়নি", en: "No answer" })}`}
            </p>
          </div>
          {(detail.lead as { id?: string } | null)?.id ? (
            <OutreachTemplates
              leadId={(detail.lead as { id: string }).id}
              phone={detail.lead?.phone_number ?? detail.report.phone_number}
              name={detail.lead?.name ?? ""}
            />
          ) : null}
          {(detail.queuedCount ?? 0) > 0 ? (
            <p className="rounded-lg bg-warning/10 px-3 py-2 text-xs text-warning">
              {t({
                bn: `আরও ${detail.queuedCount}টি কলের রিপোর্ট অপেক্ষায় — এটি জমা দিলেই পরেরটি খুলবে।`,
                en: `${detail.queuedCount} more call report(s) pending — the next one opens once this is submitted.`,
              })}
            </p>
          ) : null}
          <div className="space-y-2">{children}</div>
          {missing ? (
            <p
              role="status"
              aria-live="polite"
              className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs font-medium"
            >
              {t({ bn: "জমা দিতে বাকি", en: "Still required" })}: {missing}
            </p>
          ) : null}
          <Button
            className="sticky bottom-0 z-20 min-h-12 w-full shadow-sm"
            disabled={Boolean(missing) || send.isPending}
            onClick={() => send.mutate()}
          >
            {send.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {t({ bn: "নিশ্চিত করে জমা দিন", en: "Confirm & Submit" })}
          </Button>
          <p className="text-center text-[11px] text-muted-foreground">
            <kbd className="rounded border border-border bg-muted px-1 font-mono">
              Ctrl/⌘ + Enter
            </kbd>{" "}
            {t(SHORTCUT_LABELS.save).split("—")[1]}
          </p>
          <p className="text-center text-[11px] text-muted-foreground">
            {t({
              bn: "রিপোর্ট জমা না দিলে পরের কল শুরু করা যাবে না।",
              en: "The next call cannot start until the report is submitted.",
            })}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
