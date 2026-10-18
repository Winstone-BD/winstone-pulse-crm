/** Enforce already-issued HQ reviews without creating new locks during recovery. */
export async function requireAgentReviewClear(agentId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { dhakaDate } = await import("@/lib/accountability");
  const rows = await supabaseAdmin.from("agent_accountability_reviews").select("id").eq("agent_id", agentId).neq("status", "approved").lte("unlock_for_date", dhakaDate()).limit(1);
  if (rows.error) throw new Error("Unable to verify HQ review status");
  return rows.data?.length ? { blocked: true as const, reason: "Executive HQ পর্যালোচনা ও অনুমোদন প্রয়োজন; IT অনুমোদন দিতে পারে না" } : null;
}