/**
 * Winstone AI features: lead call-order suggestion, follow-up message drafts
 * and the HQ daily team summary. Every feature only proposes — the agent or
 * HQ confirms before anything is saved or sent. The AI never writes to the
 * database and never invents facts: prompts forbid it and answers are
 * filtered back to known record ids.
 */
import { aiChatJson } from "@/lib/ai-model.server";

export type RankedLead = { leadId: string; name: string; reason: string };

const COMMON = `You are "Winstone AI", the assistant inside Winstone Pulse, a real-estate sales CRM in Bangladesh.
Rules:
- Use only the data given to you. Never invent names, numbers, prices or facts.
- Money is Bangladeshi Taka (৳).
- Reply with strict JSON only, matching the requested shape.`;

/** Ranks an agent's open leads by likelihood to close, with a one-line reason each. */
export async function leadPriorityForAgent(agentId: string): Promise<{ items: RankedLead[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: leads, error } = await supabaseAdmin
    .from("leads")
    .select("id, name, company, status, notes, updated_at")
    .eq("assigned_to", agentId)
    .in("status", ["pending", "contacted", "follow_up"])
    .order("updated_at", { ascending: false })
    .limit(40);
  if (error) throw new Error(error.message);
  if (!leads?.length) return { items: [] };

  const evidence = leads.map((l) => ({
    lead_id: l.id,
    name: l.name,
    company: l.company,
    status: l.status,
    notes: (l.notes ?? "").slice(0, 200),
    last_touched: l.updated_at,
  }));

  const out = await aiChatJson<{ ranked?: { lead_id?: string; reason?: string }[] }>({
    system: `${COMMON}
Task: rank these sales leads by likelihood to close soon. Consider status, recency and notes.
Return at most 5, best first: {"ranked":[{"lead_id":"...","reason":"one short sentence"}]}`,
    user: JSON.stringify(evidence),
  });

  const known = new Map(leads.map((l) => [l.id, l.name] as const));
  const items: RankedLead[] = [];
  for (const row of out.ranked ?? []) {
    const id = row.lead_id ?? "";
    const name = known.get(id);
    if (!name || items.some((i) => i.leadId === id)) continue;
    items.push({ leadId: id, name, reason: (row.reason ?? "").trim() || "Suggested by AI" });
    if (items.length >= 5) break;
  }
  return { items };
}

/** Drafts a short follow-up message for one lead. The agent edits and sends it themselves. */
export async function draftLeadMessage(
  leadId: string,
  agentId: string,
  lang: "bn" | "en",
): Promise<{ draft: string }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: lead, error } = await supabaseAdmin
    .from("leads")
    .select("id, name, company, status, notes, assigned_to")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead || lead.assigned_to !== agentId) throw new Error("This lead is not assigned to you");

  const { data: lastReport } = await supabaseAdmin
    .from("call_reports")
    .select("summary, note, category, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const evidence = {
    lead: {
      name: lead.name,
      company: lead.company,
      status: lead.status,
      notes: (lead.notes ?? "").slice(0, 300),
    },
    last_call: lastReport
      ? {
          summary: (lastReport.summary ?? "").slice(0, 300),
          note: (lastReport.note ?? "").slice(0, 300),
          at: lastReport.created_at,
        }
      : null,
  };

  const out = await aiChatJson<{ draft?: string }>({
    system: `${COMMON}
Task: write a short, polite WhatsApp follow-up message from the sales agent to this lead.
- Language: ${lang === "bn" ? "Bengali" : "English"}.
- Maximum 4 sentences, no pressure tactics, no invented offers or prices.
Return: {"draft":"..."}`,
    user: JSON.stringify(evidence),
  });
  const draft = (out.draft ?? "").trim();
  if (!draft) throw new Error("The AI could not draft a message — please retry");
  return { draft };
}

export type TeamDayStats = {
  agent: string;
  reports: number;
  connected: number;
  talkMinutes: number;
};

/** HQ daily team summary: today's call activity per agent, summarised by AI. */
export async function teamDailySummary(
  lang: "bn" | "en",
): Promise<{ summary: string; stats: TeamDayStats[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { dhakaToday } = await import("@/lib/lead-pool.server");
  const today = dhakaToday();

  const { data: reports, error } = await supabaseAdmin
    .from("call_reports")
    .select("agent_id, connected, duration_seconds")
    .gte("created_at", `${today}T00:00:00+06:00`)
    .limit(5000);
  if (error) throw new Error(error.message);

  const { data: profiles } = await supabaseAdmin.from("profiles").select("id, name");
  const names = new Map((profiles ?? []).map((p) => [p.id, p.name] as const));

  const byAgent = new Map<string, TeamDayStats>();
  for (const r of reports ?? []) {
    const key = r.agent_id ?? "unknown";
    const row =
      byAgent.get(key) ??
      ({ agent: names.get(key) ?? "Unknown", reports: 0, connected: 0, talkMinutes: 0 } as TeamDayStats);
    row.reports += 1;
    if (r.connected) row.connected += 1;
    row.talkMinutes += Math.round((r.duration_seconds ?? 0) / 60);
    byAgent.set(key, row);
  }
  const stats = [...byAgent.values()].sort((a, b) => b.reports - a.reports);
  if (!stats.length) return { summary: "", stats: [] };

  const out = await aiChatJson<{ summary?: string }>({
    system: `${COMMON}
Task: summarise today's sales-floor activity for the HQ authority.
- Language: ${lang === "bn" ? "Bengali" : "English"}.
- Maximum 6 short lines: overall picture, standout agent, who may need support, one coaching note.
Return: {"summary":"..."}`,
    user: JSON.stringify({ date: today, agents: stats }),
  });
  const summary = (out.summary ?? "").trim();
  if (!summary) throw new Error("The AI could not summarise today — please retry");
  return { summary, stats };
}
