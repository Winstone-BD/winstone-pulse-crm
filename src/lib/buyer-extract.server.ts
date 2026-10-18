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
import { streamChatCompletion } from "@lovable.dev/ai-gateway";
import { aiFailure } from "@/lib/ai-failure";
import { supportedEvidence } from "@/lib/ai-evidence";

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
  try {
    const stream = await streamChatCompletion({ model: EXTRACT_MODEL, messages: [{ role: "system", content: EXTRACT_SYSTEM }, { role: "user", content: user }] });
    let text = "";
    for await (const event of stream) {
      const choice = event.choices?.[0];
      if (choice?.finish_reason === "content_filter") throw new Error("The AI declined to analyse this note");
      text += choice?.delta?.content ?? "";
    }
    return text;
  } catch (error) { throw aiFailure(error); }
}

export type ExtractedField = { value: string; evidence: string };

export function groundExtraction(fields: Partial<Record<ExtractFieldKey, ExtractedField>>, source: string) {
  const grounded: Partial<Record<ExtractFieldKey, ExtractedField>> = {};
  for (const key of EXTRACT_FIELDS) {
    const field = fields[key];
    if (field && supportedEvidence(field.evidence, source)) grounded[key] = field;
  }
  return grounded;
}

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
  const source = `${JSON.stringify(facts)}\n${notes.text}`;
  const fields = groundExtraction(parseExtraction(await callGemini(`${JSON.stringify(facts)}\n${notes.wrapped}`)), source);
  return { fields, flagged: notes.flagged };
}
