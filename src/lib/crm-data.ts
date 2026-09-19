import { queryOptions, useQuery, useQueryClient } from "@tanstack/react-query";

import { leadOwner } from "./lead-owner";
import { type CanonicalCall, talkTimeOf } from "@/lib/call-evidence";
import { dhakaDateKey } from "@/lib/daily-performance";
import { useEffect } from "react";

import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { getCrmSnapshot } from "@/lib/crm.functions";
import { useAdminToken } from "@/lib/local-session";
import type { SafeProfile } from "@/lib/profile-columns";

export type Profile = SafeProfile;
export type Lead = Database["public"]["Tables"]["leads"]["Row"];
export type CallRecording = Database["public"]["Tables"]["call_recordings"]["Row"];
export type WhatsappMessage = Database["public"]["Tables"]["whatsapp_interactions"]["Row"];
export type LeadEvent = Database["public"]["Tables"]["lead_events"]["Row"];
export type LeadStatus = Database["public"]["Enums"]["lead_status"];

export const LEAD_STATUSES: { key: LeadStatus; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "contacted", label: "Contacted" },
  { key: "follow_up", label: "Follow-up" },
  { key: "closed", label: "Closed" },
];

export type CrmSnapshot = Awaited<ReturnType<typeof getCrmSnapshot>>;

/**
 * One server round-trip for the board, scoped to who is asking.
 * Authority PIN and coordinators see the whole floor, an agent sees only
 * their own leads, and anyone else receives an empty snapshot.
 */
/**
 * One submitted call report = one call attempt. `verifiedConnected` means the
 * phone proved the call was answered (measured duration, synced recording or a
 * logged call start) — a written report alone never counts as a conversation.
 * `verifiedSeconds` is null when no duration was measured (talk time unavailable).
 */
export type { CanonicalCall };

export const snapshotQueryFor = (scope: { token: string | null }) =>
  queryOptions({
    queryKey: ["crm-snapshot", scope.token ? "authority" : "session"],
    queryFn: () => getCrmSnapshot({ data: { token: scope.token } }),
    refetchInterval: 10_000,
    staleTime: 2_000,
  });

const EMPTY_SNAPSHOT = {
  profiles: [] as Profile[],
  leads: [] as Lead[],
  calls: [] as CallRecording[],
  callEvents: [] as CanonicalCall[],
  messages: [] as WhatsappMessage[],
  events: [] as LeadEvent[],
};

/**
 * Live push refresh: whenever the phone app writes a call lifecycle event, a
 * recording or a WhatsApp message, the board reloads itself — no manual refresh.
 * The 10s poll above stays as a safety net for PIN-only (not signed-in) boards.
 */
function useLiveCrmRefresh() {
  const queryClient = useQueryClient();
  useEffect(() => {
    const invalidate = () => {
      void queryClient.invalidateQueries({ queryKey: ["crm-snapshot"] });
    };
    // A submitted report must land instantly on Reports, Executive HQ and the
    // Coordinator Deck, so report/follow-up writes refresh those panels too.
    const invalidateReports = () => {
      invalidate();
      for (const key of ["call-ops", "my-call-reports", "follow-ups", "pending-call-report"]) {
        void queryClient.invalidateQueries({ queryKey: [key] });
      }
    };
    // Each snapshot consumer mounts its own listener. Reusing one channel name
    // makes the client return an already-subscribed channel, then adding another
    // callback throws and takes down the whole desk.
    const channel = supabase
      .channel(`crm-snapshot-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lead_events" }, invalidate)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_recordings" },
        invalidate,
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, invalidate)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "call_reports" },
        invalidateReports,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "follow_up_events" },
        invalidateReports,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_interactions" },
        invalidate,
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient]);
}

/** Snapshot for the current device; customer data requires an authority token. */
export function useSnapshot() {
  const token = useAdminToken();
  const query = useQuery(snapshotQueryFor({ token }));
  useLiveCrmRefresh();
  return { ...(query.data ?? EMPTY_SNAPSHOT), isPending: query.isPending };
}

/**
 * Per-agent floor numbers. Built from canonical calls (submitted post-call
 * reports, de-duplicated per call session) — never from recordings, and never
 * from a claimed outcome the phone did not back up. "Today" is the Asia/Dhaka
 * calendar day, so the browser clock cannot move the boundary.
 */
export type AgentStats = {
  profile: Profile;
  /** Call attempts: one submitted report = one attempt. */
  dials: number;
  /** Connected calls: the phone proved the customer answered. */
  connected: number;
  /** Proven talk seconds of connected calls only. */
  talkSeconds: number;
  /** Connected calls whose duration the phone measured. */
  measuredCalls: number;
  /** Connected calls with no measured duration — talk time is partly unavailable. */
  unmeasuredCalls: number;
  /** False when no connected call carries a measured duration. */
  talkTimeAvailable: boolean;
  avgCallSeconds: number;
  /** Distinct leads with at least one connected call. */
  contactedLeads: number;
  whatsappTouches: number;
  syncedAudio: number;
  closedWon: number;
  assigned: number;
  conversionRate: number;
  /** Classification counts on the agent's own leads. */
  hot: number;
  warm: number;
  cold: number;
  /** Assigned leads that are not COMPLETED yet (unclassified or not reached). */
  pendingWork: number;
};

export function buildAgentStats(
  profiles: Profile[],
  leads: Lead[],
  callEvents: CanonicalCall[],
  messages: WhatsappMessage[],
  todayOnly = false,
  recordings: CallRecording[] = [],
): AgentStats[] {
  const agents = profiles.filter((p) => p.role === "agent");
  const today = dhakaDateKey();
  const inWindow = (iso: string) => (todayOnly ? dhakaDateKey(new Date(iso)) === today : true);

  return agents
    .map((profile) => {
      const agentCalls = callEvents.filter((c) => c.agentId === profile.id && inWindow(c.at));
      const connectedCalls = agentCalls.filter((c) => c.verifiedConnected);
      const talk = talkTimeOf(
        agentCalls.map((c) => ({
          connected: c.verifiedConnected,
          verifiedSeconds: c.verifiedSeconds,
        })),
      );
      const agentMessages = messages.filter(
        (m) => m.agent_id === profile.id && m.sender_type === "agent" && inWindow(m.created_at),
      );
      const assignedLeads = leads.filter((l) => leadOwner(l) === profile.id);
      const closedWon = assignedLeads.filter(
        (l) => l.status === "closed" && l.outcome_category === "deal_won",
      ).length;
      const contactedLeads = new Set(
        connectedCalls.map((c) => c.leadId).filter((id): id is string => !!id),
      ).size;

      return {
        profile,
        dials: agentCalls.length,
        connected: connectedCalls.length,
        talkSeconds: talk.seconds,
        measuredCalls: talk.measuredCalls,
        unmeasuredCalls: talk.unmeasuredCalls,
        talkTimeAvailable: talk.measuredCalls > 0,
        avgCallSeconds: talk.measuredCalls ? talk.seconds / talk.measuredCalls : 0,
        contactedLeads,
        whatsappTouches: agentMessages.length,
        syncedAudio: recordings.filter(
          (c) => c.agent_id === profile.id && c.sync_status === "verified" && inWindow(c.created_at),
        ).length,
        closedWon,
        assigned: assignedLeads.length,
        conversionRate: assignedLeads.length ? (closedWon / assignedLeads.length) * 100 : 0,
        hot: assignedLeads.filter((l) => l.temperature === "hot").length,
        warm: assignedLeads.filter((l) => l.temperature === "warm").length,
        cold: assignedLeads.filter((l) => l.temperature === "cold").length,
        pendingWork: assignedLeads.filter((l) => l.work_state !== "completed").length,
      };
    })
    .sort((a, b) => b.connected - a.connected || b.talkSeconds - a.talkSeconds);
}

export type TimelineEntry =
  | { kind: "call"; at: string; call: CallRecording }
  | { kind: "message"; at: string; message: WhatsappMessage }
  | { kind: "event"; at: string; event: LeadEvent };

/** Bengali labels for the automatic call lifecycle trail. */
export const LEAD_EVENT_LABELS: Record<string, string> = {
  call_started: "কল শুরু হয়েছে",
  call_connected: "কল সংযুক্ত হয়েছে",
  call_ended: "কল শেষ হয়েছে",
  recording_saved: "রেকর্ডিং সার্ভারে জমা হয়েছে",
  transcript_ready: "ট্রান্সক্রিপ্ট প্রস্তুত",
  transcript_failed: "ট্রান্সক্রিপ্ট তৈরি হয়নি",
  outcome_logged: "কলের ফল জমা হয়েছে",
  whatsapp_message: "হোয়াটসঅ্যাপ কথা হয়েছে",
  self_claimed: "এজেন্ট নিজে লিড নিয়েছেন",
};

export function buildTimeline(
  calls: CallRecording[],
  messages: WhatsappMessage[],
  leadId: string,
  events: LeadEvent[] = [],
): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...calls
      .filter((c) => c.lead_id === leadId)
      .map((call) => ({ kind: "call" as const, at: call.created_at, call })),
    ...messages
      .filter((m) => m.lead_id === leadId)
      .map((message) => ({ kind: "message" as const, at: message.created_at, message })),
    ...events
      .filter((e) => e.lead_id === leadId)
      .map((event) => ({ kind: "event" as const, at: event.created_at, event })),
  ];
  return entries.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

export function latestVerifiedCall(calls: CallRecording[], leadId: string) {
  return calls
    .filter((c) => c.lead_id === leadId && c.sync_status === "verified" && c.ai_summary)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
}

/** Default carrier estimate in BDT per outgoing minute (editable on the IT board). */
export const DEFAULT_RATE_PER_MINUTE = 0.4;

export type BillingSummary = {
  monthLabel: string;
  dials: number;
  connected: number;
  connectedPct: number;
  billableMinutes: number;
  /** Connected calls with a measured duration (the minutes above come from these). */
  measuredCalls: number;
  /** Connected calls with no measured duration — minutes are understated, not invented. */
  unmeasuredCalls: number;
  carrierCost: number;
  dealsWon: number;
  newLeads: number;
};

/** Same Asia/Dhaka calendar month — never the browser's month. */
function sameDhakaMonth(iso: string, ref: Date) {
  return dhakaDateKey(new Date(iso)).slice(0, 7) === dhakaDateKey(ref).slice(0, 7);
}

/**
 * Monthly floor rollup, computed from canonical calls: attempts, connected
 * calls and proven talk minutes. Nothing is estimated from a recording row.
 */
export function buildBillingSummary(
  callEvents: CanonicalCall[],
  leads: Lead[],
  ratePerMinute = DEFAULT_RATE_PER_MINUTE,
  ref = new Date(),
): BillingSummary {
  const monthCalls = callEvents.filter((c) => sameDhakaMonth(c.at, ref));
  const talk = talkTimeOf(
    monthCalls.map((c) => ({ connected: c.verifiedConnected, verifiedSeconds: c.verifiedSeconds })),
  );
  const connected = monthCalls.filter((c) => c.verifiedConnected).length;
  const billableMinutes = Math.ceil(talk.seconds / 60);
  return {
    monthLabel: ref.toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
    dials: monthCalls.length,
    connected,
    connectedPct: monthCalls.length ? (connected / monthCalls.length) * 100 : 0,
    billableMinutes,
    measuredCalls: talk.measuredCalls,
    unmeasuredCalls: talk.unmeasuredCalls,
    carrierCost: billableMinutes * ratePerMinute,
    dealsWon: leads.filter(
      (l) =>
        l.status === "closed" &&
        l.outcome_category === "deal_won" &&
        sameDhakaMonth(l.updated_at, ref),
    ).length,
    newLeads: leads.filter((l) => sameDhakaMonth(l.created_at, ref)).length,
  };
}
