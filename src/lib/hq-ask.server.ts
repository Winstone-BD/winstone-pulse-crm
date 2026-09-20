import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ChartSpec = {
  kind: "bar" | "line" | "none";
  title: string;
  xKey: string;
  series: { key: string; label: string }[];
  data: Record<string, string | number>[];
};

export type HqAnswer = { answer: string; chart: ChartSpec };

/**
 * Compact floor facts the model can turn into an answer and a chart.
 *
 * Calls come from the canonical call layer only (submitted post-call reports,
 * de-duplicated per session), so the analyst quotes the same dials, connected
 * calls and talk minutes as Executive HQ and the daily performance board.
 */
export async function buildFloorFacts() {
  const { fetchCanonicalCalls } = await import("@/lib/canonical-calls.server");
  const { talkTimeOf } = await import("@/lib/call-evidence");
  const { dhakaDateKey } = await import("@/lib/daily-performance");

  const [{ data: profiles }, { data: leads }, calls, { data: messages }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, name, role, approval_status, is_active"),
    supabaseAdmin.from("leads").select("id, assigned_to, status, outcome_category, created_at"),
    fetchCanonicalCalls({ limit: 5000 }),
    supabaseAdmin
      .from("whatsapp_interactions")
      .select("agent_id, sender_type, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
  ]);

  const agents = (profiles ?? []).filter((p) => p.approval_status !== "rejected");
  const talkOf = (rows: typeof calls) =>
    talkTimeOf(
      rows.map((c) => ({ connected: c.verifiedConnected, verifiedSeconds: c.verifiedSeconds })),
    );

  const perAgent = agents.map((agent) => {
    const myCalls = calls.filter((c) => c.agentId === agent.id);
    const myLeads = (leads ?? []).filter((l) => l.assigned_to === agent.id);
    const talk = talkOf(myCalls);
    return {
      agent: agent.name,
      role: agent.role,
      leads: myLeads.length,
      pending: myLeads.filter((l) => l.status === "pending").length,
      closed: myLeads.filter((l) => l.status === "closed").length,
      dials: myCalls.length,
      connected: myCalls.filter((c) => c.verifiedConnected).length,
      contacted_leads: new Set(
        myCalls.filter((c) => c.verifiedConnected).map((c) => c.leadId).filter(Boolean),
      ).size,
      talk_minutes: talk.measuredCalls ? Math.round(talk.seconds / 60) : null,
      calls_without_measured_time: talk.unmeasuredCalls,
      whatsapp: (messages ?? []).filter((m) => m.agent_id === agent.id).length,
    };
  });

  // Day buckets follow the Asia/Dhaka calendar day, never UTC.
  const byDay = new Map<string, { day: string; dials: number; connected: number }>();
  for (const call of calls) {
    const day = dhakaDateKey(new Date(call.at));
    const row = byDay.get(day) ?? { day, dials: 0, connected: 0 };
    row.dials += 1;
    if (call.verifiedConnected) row.connected += 1;
    byDay.set(day, row);
  }

  const floorTalk = talkOf(calls);

  return {
    metric_rules: {
      dials: "one submitted post-call report = one call attempt",
      connected_calls: "the phone proved the customer answered (measured duration, CDR or call log)",
      talk_minutes: "verified duration of connected calls only; null when nothing was measured",
      day: "Asia/Dhaka calendar day",
    },
    totals: {
      agents: perAgent.length,
      leads: (leads ?? []).length,
      unassigned_leads: (leads ?? []).filter((l) => l.assigned_to === null).length,
      dials: calls.length,
      connected_calls: calls.filter((c) => c.verifiedConnected).length,
      talk_minutes: floorTalk.measuredCalls ? Math.round(floorTalk.seconds / 60) : null,
      calls_without_measured_time: floorTalk.unmeasuredCalls,
      whatsapp_messages: (messages ?? []).length,
      closed_leads: (leads ?? []).filter((l) => l.status === "closed").length,
    },
    per_agent: perAgent,
    per_day: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)).slice(-30),
  };
}

const SYSTEM = `You are the Executive HQ analyst for a tele-sales floor.
You are given the complete current floor data as JSON. Answer the executive's question
using ONLY those numbers — never invent figures.
Reply with strict JSON:
{"answer": "2-5 short sentences of plain-language insight",
 "chart": {"kind": "bar" | "line" | "none", "title": "string", "xKey": "string",
           "series": [{"key": "string", "label": "string"}],
           "data": [{"<xKey>": "label", "<series key>": number}]}}
Use kind "none" only when a chart would not help. Keep data under 20 rows and use
short labels. Never include markdown fences.`;

export async function askFloorQuestion(question: string): Promise<HqAnswer> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured");
  const facts = await buildFloorFacts();

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "google/gemini-3-flash",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `Floor data JSON:\n${JSON.stringify(facts)}\n\nQuestion: ${question}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (response.status === 429) throw new Error("AI is busy right now — try again in a moment");
  if (response.status === 402) throw new Error("AI credits are exhausted for this workspace");
  if (!response.ok) throw new Error(`AI request failed (${response.status})`);

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(raw) as HqAnswer;
    return {
      answer: parsed.answer ?? "No answer returned.",
      chart:
        parsed.chart && parsed.chart.kind !== "none" && Array.isArray(parsed.chart.data)
          ? parsed.chart
          : { kind: "none", title: "", xKey: "", series: [], data: [] },
    };
  } catch {
    return {
      answer: raw || "No answer returned.",
      chart: { kind: "none", title: "", xKey: "", series: [], data: [] },
    };
  }
}
