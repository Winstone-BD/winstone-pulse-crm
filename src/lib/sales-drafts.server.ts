/**
 * AI WhatsApp + SMS follow-up pair (AgentForge FOLLOWUP_COPILOT), drafts only.
 * Uses a stronger Claude model for drafting; lead text is wrapped by the prompt
 * guard. Every draft and edit is stored server-only in sales_drafts.
 */
import { sanitizeNotes, UNTRUSTED_RULE } from "@/lib/prompt-guard";

export const DRAFT_MODEL = "anthropic/claude-opus-5";

const SYSTEM = `You are Winstone AI drafting follow-ups for Winstone Properties Ltd (Bangladesh real estate).
Rules:
- Use only the supplied lead facts. Never invent prices, discounts, availability, dates or guaranteed returns.
- ${UNTRUSTED_RULE}
- This is a DRAFT for the agent; never claim anything was sent or booked.
Write in polite natural Bangla:
1) one WhatsApp message under 70 words, starting with "আসসালামু আলাইকুম" and signed "— Winstone Properties Ltd";
2) one SMS under 30 words;
3) a suggested follow-up time window (e.g. "আগামীকাল সকাল ১০–১২টা").
Reply ONLY as JSON: {"whatsapp":"...","sms":"...","when":"..."}`;

async function callClaude(user: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI service is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/messages", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: DRAFT_MODEL, max_tokens: 4000, stream: true, system: SYSTEM, messages: [{ role: "user", content: user }] }),
  });
  if (!res.ok || !res.body) {
    console.error("draft gateway", res.status, await res.text().catch(() => ""));
    if (res.status === 402) throw new Error("AI credits are exhausted — please add credits");
    if (res.status === 403) throw new Error("AI access is blocked for this workspace right now");
    if (res.status === 429) throw new Error("AI is busy — try again in a moment");
    throw new Error("The AI service is unavailable right now");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", refused = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = frame.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (!data) continue;
      try {
        const e = JSON.parse(data) as { type?: string; delta?: { type?: string; text?: string; stop_reason?: string } };
        if (e.type === "content_block_delta" && e.delta?.type === "text_delta") text += e.delta.text ?? "";
        if (e.type === "message_delta" && e.delta?.stop_reason === "refusal") refused = true;
        if (e.type === "error") throw new Error("The AI stopped unexpectedly — please retry");
      } catch (err) {
        if (err instanceof Error && err.message.startsWith("The AI")) throw err;
      }
    }
  }
  if (refused) throw new Error("The AI declined to draft this message");
  return text;
}

export function parsePair(text: string) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("The AI returned an unreadable answer — please retry");
  const j = JSON.parse(m[0]) as { whatsapp?: unknown; sms?: unknown; when?: unknown };
  const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const out = { whatsapp: s(j.whatsapp, 900), sms: s(j.sms, 320), when: s(j.when, 120) };
  if (!out.whatsapp || !out.sms) throw new Error("The AI returned an incomplete draft — please retry");
  return out;
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

export async function draftFollowupPair(leadId: string, agentId: string, authority: boolean) {
  const db = await admin();
  const { data: lead, error } = await db.from("leads").select("id, name, status, notes, assigned_to").eq("id", leadId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead || (!authority && lead.assigned_to !== agentId)) throw new Error("This lead is not assigned to you");
  const { data: rep } = await db.from("call_reports").select("summary, note, requirement, next_action")
    .eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const notes = sanitizeNotes([lead.notes, rep?.summary, rep?.note].filter(Boolean).join("\n"), 1500);
  const facts = { name: lead.name, status: lead.status, requirement: rep?.requirement ?? null, last_next_action: rep?.next_action ?? null };
  const pair = parsePair(await callClaude(`${JSON.stringify(facts)}\n${notes.wrapped}`));
  const output = `WhatsApp:\n${pair.whatsapp}\n\nSMS:\n${pair.sms}\n\nপরের ফলো-আপ: ${pair.when}`;
  const { data: row, error: insErr } = await db.from("sales_drafts").insert({
    agent_id: authority ? (lead.assigned_to ?? agentId) : agentId, lead_id: leadId, workflow: "followup_pair",
    ai_output: output, injection_flagged: notes.flagged, model: DRAFT_MODEL,
  }).select("id").single();
  if (insErr) throw new Error(insErr.message);
  return { id: row.id, ...pair, flagged: notes.flagged };
}

export async function listDrafts(agentId: string | null) {
  const db = await admin();
  let q = db.from("sales_drafts").select("id, agent_id, lead_id, ai_output, edited_output, edited_at, injection_flagged, created_at")
    .order("created_at", { ascending: false }).limit(30);
  if (agentId) q = q.eq("agent_id", agentId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const leadIds = [...new Set((data ?? []).map((d) => d.lead_id).filter(Boolean))] as string[];
  const { data: leads } = leadIds.length ? await db.from("leads").select("id, name").in("id", leadIds) : { data: [] };
  const names = new Map((leads ?? []).map((l) => [l.id, l.name] as const));
  return (data ?? []).map((d) => ({ ...d, leadName: d.lead_id ? names.get(d.lead_id) ?? "" : "" }));
}

export async function saveDraftEdit(id: string, agentId: string | null, text: string) {
  const db = await admin();
  let q = db.from("sales_drafts").update({ edited_output: text.slice(0, 4000), edited_at: new Date().toISOString() }).eq("id", id);
  if (agentId) q = q.eq("agent_id", agentId);
  const { data, error } = await q.select("id");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error("Draft not found");
  return { ok: true as const };
}

export async function loadCatalog() {
  const db = await admin();
  const { data, error } = await db.from("project_catalog")
    .select("id, name, location, status, total_price, down_payment, installment_plan").order("name").limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}
