import { clampBrief, ruleBrief, type BriefFacts, type QuickBrief } from "@/lib/precall-brief";
import type { CallRecording, Lead } from "@/lib/crm-data";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.8-flash";

export type PreCallBrief = {
  leadId: string;
  leadName: string;
  headline: string;
  opener: string;
  talkingPoints: string[];
  objections: { objection: string; response: string }[];
  nextAction: string;
  risk: string | null;
  generatedAt: string;
  aiAvailable: boolean;
};

const SYSTEM = `You are the AI pre-call assistant inside "Winstone Connect" for Winstone Properties Ltd (real estate, Bangladesh).
You read ONE lead's real history (past call transcripts, AI summaries, submitted call reports, notes) and prepare the agent for the next phone call.
Rules:
- Write everything in Bengali (Bangla). Money is Bangladeshi Taka (৳).
- Use ONLY the supplied evidence. Never invent a fact, price, quote or promise.
- Keep it short and usable while the phone is ringing.
- If there is no history, say so plainly and give a clean first-contact opener.
Reply as strict JSON only:
{"headline":"max 10 words","opener":"1-2 sentences the agent can say","talking_points":["..."],"objections":[{"objection":"...","response":"..."}],"next_action":"one concrete action","risk":"one short warning or null"}`;

async function loadLead(leadId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [leadRes, callsRes, reportsRes] = await Promise.all([
    supabaseAdmin.from("leads").select("*").eq("id", leadId).maybeSingle(),
    supabaseAdmin
      .from("call_recordings")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabaseAdmin
      .from("call_reports")
      .select("category, summary, note, reason, follow_up_at, submitted_at")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  if (leadRes.error) throw new Error(leadRes.error.message);
  if (!leadRes.data) throw new Error("লিড পাওয়া যায়নি");
  if (callsRes.error) throw new Error(callsRes.error.message);
  if (reportsRes.error) throw new Error(reportsRes.error.message);
  return {
    lead: leadRes.data as Lead,
    calls: (callsRes.data ?? []) as CallRecording[],
    reports: reportsRes.data ?? [],
  };
}

function fallback(
  lead: Lead,
  hasHistory: boolean,
): Omit<PreCallBrief, "leadId" | "leadName" | "generatedAt" | "aiAvailable"> {
  return {
    headline: hasHistory ? "আগের কথাবার্তা পড়ে কল করুন" : "প্রথম যোগাযোগ",
    opener: hasHistory
      ? `আসসালামু আলাইকুম, ${lead.name}। Winstone Properties থেকে বলছি — আগের আলোচনার সূত্রে ফোন করলাম।`
      : `আসসালামু আলাইকুম, ${lead.name}। Winstone Properties থেকে বলছি, দুই মিনিট সময় হবে?`,
    talkingPoints: [
      lead.notes ? `নোট: ${lead.notes.slice(0, 160)}` : "প্রয়োজন ও বাজেট জেনে নিন।",
      `এখন পর্যন্ত ${lead.call_attempts}টি কল চেষ্টা হয়েছে।`,
    ].filter(Boolean),
    objections: [],
    nextAction: "কল শেষে ক্যাটাগরি, সারসংক্ষেপ, নোট ও ফলো-আপ তারিখ দিয়ে রিপোর্ট জমা দিন।",
    risk: null,
  };
}

/** Grounded pre-call briefing for a single lead. */
export async function buildPreCallBrief(leadId: string): Promise<PreCallBrief> {
  const { lead, calls, reports } = await loadLead(leadId);
  const hasHistory = calls.length > 0 || reports.length > 0;
  const base = {
    leadId: lead.id,
    leadName: lead.name,
    generatedAt: new Date().toISOString(),
  };

  const key = process.env["LOVABLE_API_KEY"];
  if (!key) return { ...base, ...fallback(lead, hasHistory), aiAvailable: false };

  const evidence = {
    lead: {
      name: lead.name,
      company: lead.company,
      status: lead.status,
      outcome_category: lead.outcome_category,
      attempts: lead.call_attempts,
      last_call_at: lead.last_call_at,
      notes: (lead.notes ?? "").slice(0, 600),
    },
    calls: calls.map((c) => ({
      at: c.created_at.slice(0, 16).replace("T", " "),
      seconds: c.duration_seconds,
      sentiment: c.sentiment,
      objections: c.customer_objections,
      summary: (c.ai_summary ?? "").slice(0, 400),
      transcript: (c.transcription_text ?? "").slice(0, 900),
    })),
    reports,
  };

  try {
    const res = await fetch(GATEWAY, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: "system",
            content: `${SYSTEM}\nToday is ${new Date().toISOString().slice(0, 10)}.`,
          },
          { role: "user", content: JSON.stringify(evidence) },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error("precall gateway error", res.status, detail);
      throw new Error(
        res.status === 402 || res.status === 403
          ? "AI ক্রেডিট নেই — শুধু তথ্য দেখানো হলো"
          : "AI ব্রিফিং এখন পাওয়া যাচ্ছে না",
      );
    }
    const body = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const parsed = JSON.parse(body.choices?.[0]?.message?.content ?? "{}") as {
      headline?: string;
      opener?: string;
      talking_points?: string[];
      objections?: { objection?: string; response?: string }[];
      next_action?: string;
      risk?: string | null;
    };
    const fb = fallback(lead, hasHistory);
    return {
      ...base,
      headline: parsed.headline?.trim() || fb.headline,
      opener: parsed.opener?.trim() || fb.opener,
      talkingPoints: (parsed.talking_points ?? []).filter(Boolean).slice(0, 5).map(String),
      objections: (parsed.objections ?? [])
        .filter((o) => o?.objection && o?.response)
        .slice(0, 4)
        .map((o) => ({ objection: String(o.objection), response: String(o.response) })),
      nextAction: parsed.next_action?.trim() || fb.nextAction,
      risk: parsed.risk?.toString().trim() || null,
      aiAvailable: true,
    };
  } catch (error) {
    console.error("precall failed", error);
    return { ...base, ...fallback(lead, hasHistory), aiAvailable: false };
  }
}

// ---------------------------------------------------------------------------
// Compact 1-line brief shown right before dialling (never blocks the call).


async function loadFacts(leadId: string): Promise<{ facts: BriefFacts; inventory: string[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const [leadRes, repRes, fuRes, invRes] = await Promise.all([
    supabaseAdmin
      .from("leads")
      .select("name, reference_by, source, temperature, grade, call_attempts, last_call_at")
      .eq("id", leadId)
      .maybeSingle(),
    supabaseAdmin
      .from("call_reports")
      .select("category, summary, requirement, interest, customer_response, next_action, submitted_at")
      .eq("lead_id", leadId)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false })
      .limit(1),
    supabaseAdmin
      .from("follow_up_events")
      .select("scheduled_at")
      .eq("lead_id", leadId)
      .neq("status", "done")
      .order("scheduled_at", { ascending: true })
      .limit(1),
    supabaseAdmin.from("inventory_requirements").select("label").eq("active", true).limit(60),
  ]);
  if (leadRes.error) throw new Error(leadRes.error.message);
  if (!leadRes.data) throw new Error("লিড পাওয়া যায়নি");
  const lead = leadRes.data;
  const rep = repRes.data?.[0] ?? null;
  const fu = fuRes.data?.[0] ?? null;
  const inventory = (invRes.data ?? []).map((r) => r.label);
  const requirement = rep?.requirement ?? null;
  return {
    facts: {
      name: lead.name ?? "",
      referenceBy: lead.reference_by ?? null,
      source: lead.source ?? null,
      temperature: lead.temperature ?? null,
      grade: lead.grade ?? null,
      attempts: lead.call_attempts ?? 0,
      lastCallAt: lead.last_call_at ?? null,
      requirement,
      interest: rep?.interest ?? null,
      customerResponse: rep?.customer_response ?? null,
      lastNextAction: rep?.next_action ?? null,
      lastCategory: rep?.category ?? null,
      lastSummary: rep?.summary ? rep.summary.slice(0, 300) : null,
      followUpAt: fu?.scheduled_at ?? null,
      followUpOverdue: Boolean(fu && new Date(fu.scheduled_at).getTime() < Date.now()),
      inventoryMatch: requirement && inventory.includes(requirement) ? requirement : null,
    },
    inventory,
  };
}

const QUICK_SYSTEM = `You write a pre-call brief for a Bangladesh real-estate tele-sales agent (Winstone Properties).
Use ONLY the JSON facts given. Never invent budgets, prices, locations, projects or promises. Omit anything missing.
Write in Bengali. Output JSON with:
- "line": ONE line, max 25 words, format WHO/CONTEXT · CONTEXT · NEXT MOVE (e.g. "Uttara 3-bed, budget ~৳90L; আগে দাম জানতে চেয়েছেন; আজ বাজেট ও সাইট ভিজিট নিশ্চিত করুন").
- "opener": one polite opening sentence the agent can say.`;

async function aiBrief(facts: BriefFacts, key: string): Promise<QuickBrief | null> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra",
      stream: true,
      store: false,
      reasoning: { effort: "low" },
      input: [
        { role: "system", content: [{ type: "input_text", text: QUICK_SYSTEM }] },
        { role: "user", content: [{ type: "input_text", text: JSON.stringify(facts) }] },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "brief",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["line", "opener"],
            properties: { line: { type: "string" }, opener: { type: "string" } },
          },
        },
      },
    }),
  });
  if (!res.ok || !res.body) {
    console.error("quick brief gateway", res.status, await res.text().catch(() => ""));
    return null;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let text = "";
  let failed = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const data = frame.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (!data || data === "[DONE]") continue;
      try {
        const evt = JSON.parse(data) as { type?: string; delta?: string };
        if (evt.type === "response.output_text.delta" && evt.delta) text += evt.delta;
        if (evt.type === "response.failed" || evt.type === "error" || evt.type === "response.refusal.delta") failed = true;
      } catch {
        /* partial frame */
      }
    }
  }
  if (failed || !text) return null;
  try {
    const parsed = JSON.parse(text) as { line?: unknown; opener?: unknown };
    const line = clampBrief(parsed.line);
    const opener = clampBrief(parsed.opener, 200);
    return line && opener ? { line, opener, source: "ai" } : null;
  } catch {
    return null;
  }
}

/** Deterministic brief instantly; AI rephrasing only when asked and available. */
export async function buildQuickBrief(leadId: string, useAi: boolean): Promise<QuickBrief> {
  const { facts } = await loadFacts(leadId);
  const rules = ruleBrief(facts);
  const key = process.env["LOVABLE_API_KEY"];
  if (!useAi || !key) return rules;
  try {
    return (await aiBrief(facts, key)) ?? rules;
  } catch (error) {
    console.error("quick brief failed", error);
    return rules;
  }
}
