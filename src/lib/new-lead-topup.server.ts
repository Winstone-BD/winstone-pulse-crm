/** Counts NEW leads (taken from the unassigned pool, no previous owner) per agent for a Dhaka day. */
export async function newLeadCountsForDay(day: string): Promise<Map<string, number>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const counts = new Map<string, number>();
  for (let page = 0; page < 50; page++) {
    const { data: rows, error } = await supabaseAdmin
      .from("lead_assignments").select("to_agent_id")
      .is("from_agent_id", null)
      .gte("created_at", `${day}T00:00:00+06:00`)
      .lte("created_at", `${day}T23:59:59.999+06:00`)
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(error.message);
    for (const r of rows ?? []) if (r.to_agent_id) counts.set(r.to_agent_id, (counts.get(r.to_agent_id) ?? 0) + 1);
    if ((rows ?? []).length < 1000) break;
  }
  return counts;
}
