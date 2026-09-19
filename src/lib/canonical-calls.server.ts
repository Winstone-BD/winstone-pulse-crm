/**
 * The one server-side read of the canonical call layer.
 *
 * Every console — agent desk, Coordinator Deck, Executive HQ, reports, AI coach,
 * copilot, shift summaries, the Android app — asks this helper for calls, so a
 * call attempt, a connected call and proven talk time mean exactly one thing
 * across the whole CRM: a submitted post-call report, de-duplicated per call
 * session, connected only when the phone itself proved the customer answered.
 */
import {
  CALL_REPORT_CANONICAL_COLUMNS,
  type CanonicalCall,
  canonicalCallsOf,
} from "@/lib/call-evidence";

export type CanonicalCallQuery = {
  /** Only these agents. */
  agentIds?: string[];
  /** Only calls on these leads. */
  leadIds?: string[];
  /** Inclusive ISO lower bound on the call's effective time. */
  since?: string;
  /** Exclusive ISO upper bound on the call's effective time. */
  until?: string;
  limit?: number;
};

/** Canonical calls for one scope. Returns [] when the scope selects nothing. */
export async function fetchCanonicalCalls(
  query: CanonicalCallQuery = {},
): Promise<CanonicalCall[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let builder = supabaseAdmin
    .from("call_reports")
    .select(CALL_REPORT_CANONICAL_COLUMNS)
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(query.limit ?? 5000);

  if (query.agentIds) {
    if (query.agentIds.length === 0) return [];
    builder = builder.in("agent_id", query.agentIds);
  }
  if (query.leadIds) {
    if (query.leadIds.length === 0) return [];
    builder = builder.in("lead_id", query.leadIds);
  }
  // A late-syncing phone files the report after the call, so widen the raw
  // window and filter on the call's own effective time below.
  if (query.since) {
    builder = builder.gte("created_at", new Date(Date.parse(query.since) - 86_400_000).toISOString());
  }
  if (query.until) {
    builder = builder.lt("created_at", new Date(Date.parse(query.until) + 86_400_000).toISOString());
  }

  const { data, error } = await builder;
  if (error) throw new Error(error.message);

  const calls = canonicalCallsOf(data ?? []);
  const from = query.since ? Date.parse(query.since) : null;
  const to = query.until ? Date.parse(query.until) : null;
  return calls.filter((call) => {
    const at = Date.parse(call.at);
    if (from !== null && at < from) return false;
    if (to !== null && at >= to) return false;
    return true;
  });
}
