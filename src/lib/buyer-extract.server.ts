/**
 * Gemini-powered buyer-profile extraction from saved call notes.
 * Gemini reads the lead's saved notes/call report and proposes values for the
 * buyer-check fields the CRM does not store (budget, type, timeline, decision
 * maker, installment, NRB). Suggestions are shown to the agent only — nothing
 * is saved or sent. Lead text is wrapped by the same prompt guard as every
 * other AI call.
 */
import { EXTRACT_FIELDS, type ExtractFieldKey } from "@/lib/agent-templates";
import { sanitizeNotes, UNTRUSTED_RULE } from "@/lib/prompt-guard";

export const EXTRACT_MODEL = "google/gemini-3.8-flash";

const EXTRACT_SYSTEM = `You extract buyer-profile facts for a Winstone Properties Ltd (Bangladesh real estate) sales CRM.
Rules:
- Use ONLY the supplied lead facts and notes. Never invent, guess or infer beyond what is written.
- If a field is not stated in the text, set its value to null.
- ${UNTRUSTED_RULE}
- For each found value, quote the exact supporting snippet (under 120 characters) in "evidence".
Reply ONLY as JSON with this exact shape:
{"budget":{"value":null,"evidence":null},"property_type":{"value":null,"evidence":null},"timeline":{"value":null,"evidence":null},"decision_maker":{"value":null,"evidence":null},"installment":{"value":null,"evidence":null},"nrb":{"value":null,"evidence":null}}
budget: maximum budget exactly as written (e.g. "৮৫ লাখ", "1.2 crore", "৳45,00,000"). property_type: ফ্ল্যাট / জমি / কমার্শিয়াল / রিসোর্ট শেয়ার / other, as stated. timeline: when the buyer wants to purchase. decision_maker: who decides. installment: whether/how many months of installment is needed. nrb: whether the buyer lives abroad (yes/no).`;

async function callGemini(user: string): Promise<string> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI service is not configured");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({ model: EXTRACT_MODEL, stream: true, messages: [{ role: "system", content: EXTRACT_SYSTEM }, { role: "user", content: user }] }),
  });
  if (!res.ok || !res.body) {
    console.error("gemini extract gateway", res.status, await res.text().catch(() => ""));
    if (res.status === 402) throw new Error("AI credits are exhausted — please add credits");
    if (res.status === 403) throw new Error("AI access is blocked for this workspace right now");
    if (res.status === 429) throw new Error("AI is busy — try again in a moment");
    throw new Error("The AI service is unavailable right now");
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "", text = "", filtered = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const frame = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const data = frame.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (!data || data === "[DONE]") continue;
      try {
        const e = JSON.parse(data) as { choices?: { delta?: { content?: string }; finish_reason?: string }[] };
        const ch = e.choices?.[0];
        if (ch?.delta?.content) text += ch.delta.content;
        if (ch?.finish_reason === "content_filter") filtered = true;
      } catch {
        /* partial frame — ignore */
      }
    }
  }
  if (filtered && !text) throw new Error("The AI declined to analyse this note");
  return text;
}

export type ExtractedField = { value: string; evidence: string };

/** Pure: parse Gemini's JSON reply into found fields. Throws on unreadable output. */
export function parseExtraction(text: string): Partial<Record<ExtractFieldKey, ExtractedField>> {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("The AI returned an unreadable answer — please retry");
  let j: Record<string, { value?: unknown; evidence?: unknown } | undefined>;
  try {
    j = JSON.parse(m[0]) as typeof j;
  } catch {
    throw new Error("The AI returned an unreadable answer — please retry");
  }
  const s = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
  const out: Partial<Record<ExtractFieldKey, ExtractedField>> = {};
  for (const k of EXTRACT_FIELDS) {
    const v = s(j[k]?.value, 120);
    if (!v || v.toLowerCase() === "null") continue;
    out[k] = { value: v, evidence: s(j[k]?.evidence, 160) };
  }
  return out;
}

export async function extractBuyerProfile(leadId: string, agentId: string, authority: boolean) {
  const db = (await import("@/integrations/supabase/client.server")).supabaseAdmin;
  const { data: lead, error } = await db.from("leads").select("name, area, address, temperature, notes, assigned_to").eq("id", leadId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead || (!authority && lead.assigned_to !== agentId)) throw new Error("This lead is not assigned to you");
  const { data: rep } = await db.from("call_reports").select("summary, note, requirement, interest, customer_response, next_action")
    .eq("lead_id", leadId).eq("status", "submitted").order("submitted_at", { ascending: false }).limit(1).maybeSingle();
  const raw = [lead.notes, rep?.summary, rep?.note, rep?.requirement, rep?.interest, rep?.customer_response, rep?.next_action]
    .filter(Boolean).join("\n");
  if (!raw.trim()) throw new Error("No call notes saved yet — record a call first");
  const notes = sanitizeNotes(raw, 3000);
  const facts = { name: lead.name, area: lead.area ?? lead.address ?? null, requirement: rep?.requirement ?? null, temperature: lead.temperature ?? null };
  const fields = parseExtraction(await callGemini(`${JSON.stringify(facts)}\n${notes.wrapped}`));
  return { fields, flagged: notes.flagged };
}
