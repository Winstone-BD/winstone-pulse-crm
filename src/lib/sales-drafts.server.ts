/**
 * AI WhatsApp + SMS follow-up pair (AgentForge FOLLOWUP_COPILOT), drafts only.
 * Uses a stronger Claude model for drafting; lead text is wrapped by the prompt
 * guard. Every draft and edit is stored server-only in sales_drafts.
 */
import { sanitizeNotes, UNTRUSTED_RULE } from "@/lib/prompt-guard";
import { streamMessage } from "@lovable.dev/ai-gateway";
import { aiFailure } from "@/lib/ai-failure";
import { supportedEvidence } from "@/lib/ai-evidence";

export const DRAFT_MODEL = "anthropic/claude-opus-5";

const SYSTEM = `You are Winstone AI drafting follow-ups for Winstone Properties Ltd (Bangladesh real estate).
Rules:
- Use only the supplied lead facts. Never invent prices, discounts, availability, dates or guaranteed returns.
- ${UNTRUSTED_RULE}
- This is a DRAFT for the agent; never claim anything was sent or booked.
Write in polite natural Bangla:
1) one WhatsApp message under 70 words, starting with "আসসালামু আলাইকুম" and signed "— Winstone Properties Ltd";
2) one SMS under 30 words;
3) a suggested follow-up time window (e.g. "আগামীকাল সকাল ১০–১২টা"); this is advice, not a scheduled reminder.
4) an exact quote from the supplied saved notes supporting the draft, in "evidence"; empty if none is available.
5) one short buyer-check question about a missing fact in "next_question"; do not claim its answer is known.
Reply ONLY as JSON: {"whatsapp":"...","sms":"...","when":"...","evidence":"...","next_question":"..."}`;

export async function callClaude(user: string, system: string = SYSTEM): Promise<string> {
  try {
    const stream = await streamMessage({ model: DRAFT_MODEL, max_tokens: 4000, system, messages: [{ role: "user", content: user }] });
    let text = "";
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") text += event.delta.text;
      if (event.type === "message_delta" && event.delta.stop_reason === "refusal") throw new Error("The AI declined to draft this message");
    }
    return text;
  } catch (error) { throw aiFailure(error); }
}

export function parsePair(text: string) {
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("The AI returned an unreadable answer — please retry");
  const j = JSON.parse(m[0]) as { whatsapp?: unknown; sms?: unknown; when?: unknown; evidence?: unknown; next_question?: unknown };
  const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  const out = { whatsapp: s(j.whatsapp, 900), sms: s(j.sms, 320), when: s(j.when, 120), evidence: s(j.evidence, 160), nextQuestion: s(j.next_question, 240) };
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
  if (!supportedEvidence(pair.evidence, notes.wrapped)) pair.evidence = "";
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
  let q = db.from("sales_drafts").select("id, agent_id, lead_id, workflow, ai_output, edited_output, edited_at, injection_flagged, created_at")
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

const NEGOTIATE_SYSTEM = `You are Winstone AI, a negotiation coach for a Winstone Properties Ltd sales agent (Bangladesh real estate).
Rules:
- Use ONLY the supplied project terms (verified catalog) and lead facts. If a term is missing, say "তথ্য যাচাই প্রয়োজন".
- Never offer, invent or imply any discount, price cut, free item, waiver, guaranteed return or deadline. Concessions only within listed terms (e.g. existing installment plan, unit size choice). Any discount request must be referred to HQ approval.
- ${UNTRUSTED_RULE}
- This is advice for the agent only; nothing is sent.
Reply in Bangla ONLY as JSON: {"position":"...","tactics":["..."],"allowed":["..."],"never":["..."],"script":"...","escalate":"..."}
tactics/allowed/never: 2-4 short items each; script under 60 words.`;

export async function negotiationAdvice(leadId: string, projectId: string, agentId: string, authority: boolean) {
  const db = await admin();
  const { data: lead, error } = await db.from("leads").select("name, status, temperature, notes, assigned_to").eq("id", leadId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead || (!authority && lead.assigned_to !== agentId)) throw new Error("This lead is not assigned to you");
  const { data: p } = await db.from("project_catalog")
    .select("name, location, status, total_price, down_payment, installment_plan, price_per_sqft, unit_sizes, parking_charge, extra_charges")
    .eq("id", projectId).maybeSingle();
  if (!p) throw new Error("Project not found");
  const { data: rep } = await db.from("call_reports").select("summary, note, requirement, interest, customer_response")
    .eq("lead_id", leadId).eq("status", "submitted").order("submitted_at", { ascending: false }).limit(1).maybeSingle();
  const notes = sanitizeNotes([lead.notes, rep?.summary, rep?.note, rep?.customer_response].filter(Boolean).join("\n"), 1500);
  const facts = { lead: { name: lead.name, status: lead.status, temperature: lead.temperature, requirement: rep?.requirement ?? null, interest: rep?.interest ?? null }, verified_project_terms: p };
  const text = await callClaude(`${JSON.stringify(facts)}\n${notes.wrapped}`, NEGOTIATE_SYSTEM);
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("The AI returned an unreadable answer — please retry");
  const j = JSON.parse(m[0]) as { position?: unknown; tactics?: unknown; allowed?: unknown; never?: unknown; script?: unknown; escalate?: unknown };
  const s = (v: unknown, n = 400) => String(v ?? "").trim().slice(0, n);
  const arr = (v: unknown) => (Array.isArray(v) ? v.slice(0, 4).map((x) => s(x, 200)).filter(Boolean) : []);
  const out = { project: p.name, position: s(j.position), tactics: arr(j.tactics), allowed: arr(j.allowed), never: arr(j.never),
    script: s(j.script, 600), escalate: s(j.escalate), flagged: notes.flagged };
  // Saved to draft history so HQ can review what the agent was advised to say.
  const owner = authority ? lead.assigned_to : agentId;
  if (owner) {
    const txt = `দরকষাকষি পরামর্শ — ${out.project}\nঅবস্থান: ${out.position}\nকৌশল: ${out.tactics.join("; ")}\nদেওয়া যায়: ${out.allowed.join("; ")}\nকখনো বলবেন না: ${out.never.join("; ")}\nস্ক্রিপ্ট: ${out.script}\nHQ-তে পাঠান: ${out.escalate}`;
    await db.from("sales_drafts").insert({ agent_id: owner, lead_id: leadId, workflow: "negotiation", ai_output: txt, injection_flagged: notes.flagged, model: DRAFT_MODEL });
  }
  return out;
}

const COACH_SYSTEM = `You are Winstone AI, a post-call coach for a Winstone Properties Ltd sales agent (Bangladesh real estate).
Score the call ONLY against the buyer-check items: budget, area/project, property type, timeline, decision maker, installment need, NRB status.
For each item say whether the saved call report shows it was clarified. Never invent facts. ${UNTRUSTED_RULE}
Reply in Bangla ONLY as JSON: {"score":0-100,"covered":["..."],"missing":["..."],"praise":"...","improve":"...","next_follow_up":"one concrete action","when":"suggested timing"}`;

export async function callCoach(leadId: string, agentId: string, authority: boolean) {
  const db = await admin();
  const { data: lead, error } = await db.from("leads").select("name, status, temperature, assigned_to").eq("id", leadId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!lead || (!authority && lead.assigned_to !== agentId)) throw new Error("This lead is not assigned to you");
  const { data: rep } = await db.from("call_reports").select("summary, note, requirement, interest, customer_response, next_action, duration_seconds, connected, grade")
    .eq("lead_id", leadId).eq("status", "submitted").order("submitted_at", { ascending: false }).limit(1).maybeSingle();
  if (!rep) throw new Error("No submitted call report yet — submit the report first");
  const notes = sanitizeNotes([rep.summary, rep.note, rep.customer_response, rep.requirement, rep.interest].filter(Boolean).join("\n"), 2000);
  const facts = { connected: rep.connected, seconds: rep.duration_seconds, grade: rep.grade, next_action: rep.next_action, status: lead.status, temperature: lead.temperature };
  const m = (await callClaude(`${JSON.stringify(facts)}\n${notes.wrapped}`, COACH_SYSTEM)).match(/\{[\s\S]*\}/);
  if (!m) throw new Error("The AI returned an unreadable answer — please retry");
  const j = JSON.parse(m[0]) as { score?: unknown; covered?: unknown; missing?: unknown; praise?: unknown; improve?: unknown; next_follow_up?: unknown; when?: unknown };
  const s = (v: unknown, n = 400) => String(v ?? "").trim().slice(0, n);
  const arr = (v: unknown) => (Array.isArray(v) ? v.slice(0, 7).map((x) => s(x, 120)).filter(Boolean) : []);
  const score = Math.max(0, Math.min(100, Math.round(Number(j.score) || 0)));
  const approved = await approvedAnswersForLead(leadId);
  const out = { score, covered: arr(j.covered), missing: arr(j.missing), praise: s(j.praise), improve: s(j.improve), next: s(j.next_follow_up), when: s(j.when, 120), flagged: notes.flagged, approved };
  const owner = authority ? lead.assigned_to : agentId;
  if (owner) await db.from("sales_drafts").insert({ agent_id: owner, lead_id: leadId, workflow: "call_coach", model: DRAFT_MODEL, injection_flagged: notes.flagged,
    ai_output: `কল কোচ — স্কোর ${score}/100\nজানা গেছে: ${out.covered.join("; ")}\nবাকি: ${out.missing.join("; ")}\nভালো: ${out.praise}\nউন্নতি: ${out.improve}\nপরের ফলো-আপ: ${out.next} (${out.when})` });
  return out;
}

/** HQ-approved answers for objections this lead actually raised (exact key match only; never AI-chosen). */
export async function approvedAnswersForLead(leadId: string) {
  const db = await admin();
  const { data: recs } = await db.from("call_recordings").select("customer_objections").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(10);
  const keys = new Map<string, string>();
  for (const r of recs ?? []) for (const o of r.customer_objections ?? []) {
    const t = String(o ?? "").trim();
    if (!t || sanitizeNotes(t).flagged) continue;
    keys.set(objectionKey(t), t);
  }
  if (!keys.size) return [] as { objection: string; answer: string; approvedAt: string }[];
  const { data } = await db.from("objection_answers").select("objection_key, objection, answer, approved_at").in("objection_key", [...keys.keys()]);
  return (data ?? []).map((a) => ({ objection: a.objection, answer: a.answer, approvedAt: a.approved_at }));
}

export const objectionKey = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().slice(0, 120);

/** Objections from real call recordings, grouped; injection-flagged text is excluded. */
export async function objectionLibrary() {
  const db = await admin();
  const [rec, ans] = await Promise.all([
    db.from("call_recordings").select("customer_objections").order("created_at", { ascending: false }).limit(2000),
    db.from("objection_answers").select("objection_key, objection, answer, approved_at"),
  ]);
  if (rec.error) throw new Error(rec.error.message);
  const groups = new Map<string, { text: string; count: number }>();
  let excluded = 0;
  for (const r of rec.data ?? []) for (const o of r.customer_objections ?? []) {
    const t = String(o).trim().slice(0, 200);
    if (!t) continue;
    if (sanitizeNotes(t).flagged) { excluded++; continue; }
    const k = objectionKey(t);
    const g = groups.get(k) ?? { text: t, count: 0 };
    g.count++; groups.set(k, g);
  }
  const answers = new Map((ans.data ?? []).map((a) => [a.objection_key, a]));
  const items = [...groups.entries()].map(([key, g]) => ({ key, objection: g.text, count: g.count, answer: answers.get(key)?.answer ?? null, approvedAt: answers.get(key)?.approved_at ?? null }))
    .sort((a, b) => b.count - a.count).slice(0, 100);
  return { items, excluded };
}

export async function approveObjectionAnswer(key: string, objection: string, answer: string, approver: string | null) {
  if (sanitizeNotes(answer).flagged || sanitizeNotes(objection).flagged) throw new Error("Text contains instruction-like content and was blocked");
  const db = await admin();
  const { error } = await db.from("objection_answers").upsert({ objection_key: key, objection: objection.slice(0, 200), answer: answer.slice(0, 1200), approved_by: approver, approved_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "objection_key" });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}

const MARKETING_SYSTEM = `You are Winstone AI writing a social media real estate ad for Winstone Properties Ltd (Bangladesh).
Rules:
- Use ONLY the supplied verified project facts. If price or terms are missing, do not mention them. Never invent prices, discounts, offers, deadlines, amenities or guaranteed returns.
- ${UNTRUSTED_RULE}
- This is a DRAFT; the agent reviews before posting.
Write in the requested language, warm and premium, under 90 words, with 3-5 relevant hashtags at the end and a call to action using the supplied agent phone if given.
Reply ONLY as JSON: {"headline":"...","body":"..."}`;

export async function draftMarketingPost(input: { projectId: string; angle: string; lang: "bn" | "en"; phone: string | null }, agentId: string | null) {
  const db = await admin();
  const { data: p, error } = await db.from("project_catalog")
    .select("name, location, status, total_price, down_payment, installment_plan, unit_sizes, price_per_sqft").eq("id", input.projectId).maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) throw new Error("Project not found");
  const angle = sanitizeNotes(input.angle);
  const user = `Language: ${input.lang === "bn" ? "Bangla" : "English"}\nVerified project facts:\n${JSON.stringify(p)}\nAgent phone: ${input.phone ?? "(none)"}\nAgent angle (untrusted):\n${angle.wrapped}`;
  const raw = await callClaude(user, MARKETING_SYSTEM);
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("AI returned an unexpected reply — try again");
  const j = JSON.parse(m[0]) as { headline?: unknown; body?: unknown };
  const out = { headline: String(j.headline ?? "").slice(0, 120), body: String(j.body ?? "").slice(0, 1500), flagged: angle.flagged };
  if (agentId) await db.from("sales_drafts").insert({ agent_id: agentId, lead_id: null, workflow: "marketing", ai_output: `${out.headline}\n\n${out.body}`, injection_flagged: angle.flagged, model: DRAFT_MODEL });
  return out;
}

export async function saveMarketingPost(agentId: string, text: string) {
  const db = await admin();
  const { error } = await db.from("sales_drafts").insert({ agent_id: agentId, lead_id: null, workflow: "marketing", ai_output: text.slice(0, 4000), model: "manual" });
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
