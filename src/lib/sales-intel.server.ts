import {
  FACT_CATEGORY_CODES,
  OBJECTION_FACT_CATEGORIES,
  attributeOutcomes,
  canTransition,
  factEligibility,
  fallbackPitch,
  isAuthoritative,
  objectionLabel,
  pitchCorrelationKey,
  summarizeEffectiveness,
  validateGrounding,
  type AttrOutcome,
  type AttrPitch,
  type MarketFact,
  type ObjectionCode,
  type PitchAction,
} from "@/lib/sales-intel-rules";

type Db = Awaited<ReturnType<typeof admin>>;
async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type SiCaller = { scope: "authority" | "agent"; agentId: string | null; readOnly: boolean; actor: string };

/** Actor always comes from the server session / PIN token — never from client input. */
export async function siCaller(adminToken: string | null | undefined): Promise<SiCaller> {
  const { resolveCaller } = await import("@/lib/access.server");
  const c = await resolveCaller(adminToken ?? null);
  if (c.scope === "authority") return { scope: "authority", agentId: c.profile?.id ?? null, readOnly: c.readOnly, actor: c.profile?.name ?? (c.readOnly ? "Executive HQ" : "IT Console") };
  if (c.scope === "agent" && c.profile) return { scope: "agent", agentId: c.profile.id, readOnly: false, actor: c.profile.name ?? c.profile.id };
  throw new Error("সাইন ইন প্রয়োজন");
}

export function requireAdminWriter(c: SiCaller) {
  if (c.scope !== "authority") throw new Error("শুধু HQ/IT এই তথ্য বদলাতে পারে");
}

async function all<T>(page: (a: number, b: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const out: T[] = [];
  for (let a = 0; ; a += 1000) {
    const { data, error } = await page(a, a + 999);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

/** Agents may only touch leads assigned to them; HQ may read any lead. */
export async function leadForCaller(db: Db, c: SiCaller, leadId: string) {
  const { leadOwnerId, LEAD_NOT_YOURS } = await import("@/lib/lead-access.server");
  const { data: lead, error } = await db
    .from("leads")
    .select("id, name, phone_number, address, source, reference_by, temperature, grade, status, work_state, notes, assigned_to, assigned_agent_id")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw new Error("লিড পড়া যায়নি");
  if (!lead) throw new Error("লিড পাওয়া যায়নি");
  if (c.scope === "agent" && leadOwnerId(lead) !== c.agentId) throw new Error(LEAD_NOT_YOURS);
  return lead;
}

export async function listFacts(db: Db, opts: { onlyAuthoritative?: boolean | undefined; categories?: string[] | undefined } = {}) {
  let q = db.from("market_facts").select("*").order("effective_date", { ascending: false }).order("id");
  if (opts.categories?.length) q = q.in("category", opts.categories);
  const rows = await all<MarketFact & { created_by: string; updated_at: string; verified_at: string | null }>((a, b) => q.range(a, b));
  return opts.onlyAuthoritative ? rows.filter((f) => isAuthoritative(f)) : rows;
}

type Src = { kind: "lead" | "call_report" | "follow_up" | "pitch" | "fact"; id: string };
export type BriefLine = { label: string; value: string; sources: Src[] };

/** AI Sales Brief — every line built from existing rows; missing data says so. */
export async function buildSalesBrief(c: SiCaller, leadId: string) {
  const db = await admin();
  const lead = await leadForCaller(db, c, leadId);
  const [reports, followUps, pitches] = await Promise.all([
    all<{ id: string; created_at: string; connected: boolean | null; category: string | null; customer_response: string | null; next_action: string | null; summary: string | null; requirement: string | null; evaluation_score: number | null; follow_up_priority: string | null; status: string }>((a, b) =>
      db.from("call_reports").select("id, created_at, connected, category, customer_response, next_action, summary, requirement, evaluation_score, follow_up_priority, status").eq("lead_id", lead.id).order("created_at").order("id").range(a, b)),
    all<{ id: string; scheduled_at: string; status: string; reason_code: string | null; note: string | null }>((a, b) =>
      db.from("follow_up_events").select("id, scheduled_at, status, reason_code, note").eq("lead_id", lead.id).order("scheduled_at").order("id").range(a, b)),
    all<{ id: string; created_at: string; objection_code: string; action: string }>((a, b) =>
      db.from("pitch_events").select("id, created_at, objection_code, action").eq("lead_id", lead.id).order("created_at").order("id").range(a, b)),
  ]);
  const submitted = reports.filter((r) => r.status === "submitted");
  const last = submitted[submitted.length - 1];
  const req = [...submitted].reverse().find((r) => r.requirement?.trim());
  const openFu = followUps.find((f) => !["done", "completed", "cancelled", "canceled"].includes(f.status));
  const nr = "রেকর্ড করা নেই";
  const lines: BriefLine[] = [
    { label: "Requirement", value: req?.requirement ?? nr, sources: req ? [{ kind: "call_report", id: req.id }] : [] },
    { label: "Location", value: lead.address?.trim() || nr, sources: lead.address ? [{ kind: "lead", id: lead.id }] : [] },
    { label: "Budget", value: nr, sources: [] },
    { label: "Prior calls", value: `${reports.length} (connected ${reports.filter((r) => r.connected).length})`, sources: reports.slice(-3).map((r) => ({ kind: "call_report" as const, id: r.id })) },
    { label: "Last customer response", value: last?.customer_response ?? nr, sources: last ? [{ kind: "call_report", id: last.id }] : [] },
    { label: "Last call summary", value: last?.summary ?? nr, sources: last ? [{ kind: "call_report", id: last.id }] : [] },
    { label: "Prior objections / pitches", value: pitches.length ? [...new Set(pitches.map((p) => objectionLabel(p.objection_code)))].join(", ") : nr, sources: pitches.slice(-3).map((p) => ({ kind: "pitch" as const, id: p.id })) },
    { label: "Current follow-up", value: openFu ? `${openFu.scheduled_at} · ${openFu.reason_code ?? ""} ${openFu.note ?? ""}`.trim() : nr, sources: openFu ? [{ kind: "follow_up", id: openFu.id }] : [] },
    { label: "Score / category", value: [lead.temperature, lead.grade, last?.evaluation_score != null ? `score ${last.evaluation_score}` : null].filter(Boolean).join(" · ") || nr, sources: [{ kind: "lead", id: lead.id }] },
    {
      label: "Today's objective",
      value: openFu ? "নির্ধারিত ফলো-আপ সম্পন্ন করুন" : last?.next_action ? `পরবর্তী কাজ: ${last.next_action}` : reports.length === 0 ? "প্রথম কল করে প্রয়োজন জানুন" : "প্রয়োজন নিশ্চিত করে পরবর্তী ধাপ ঠিক করুন",
      sources: openFu ? [{ kind: "follow_up", id: openFu.id }] : last ? [{ kind: "call_report", id: last.id }] : [],
    },
  ];
  return { lead: { id: lead.id, name: lead.name, phone: lead.phone_number }, lines, lastReportId: last?.id ?? null, openFollowUpId: openFu?.id ?? null, contextText: lines.map((l) => `${l.label}: ${l.value}`).join("\n") };
}

/** Smart Pitchbook recommendation, grounded or falling back to the approved template. */
export async function recommendPitch(c: SiCaller, leadId: string, objection: ObjectionCode, note: string | null) {
  const db = await admin();
  const brief = await buildSalesBrief(c, leadId);
  const facts = await listFacts(db, { onlyAuthoritative: true, categories: OBJECTION_FACT_CATEGORIES[objection] });
  const { data: tpl } = await db.from("pitch_templates").select("id, title, body, version").eq("objection_code", objection).eq("status", "published").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  const base = tpl?.body ?? fallbackPitch(objection, brief.lead.name);
  const why = [
    `Objection selected: ${objectionLabel(objection)}`,
    ...brief.lines.filter((l) => l.sources.length && l.value !== "রেকর্ড করা নেই").slice(0, 4).map((l) => `${l.label}: ${l.value}`),
  ];
  let text = base;
  let factIds: string[] = [];
  let grounded = false;
  let aiNote: string | null = facts.length ? null : "কোনো যাচাই-কৃত তথ্য প্রকাশিত নেই — অনুমোদিত টেমপ্লেট দেখানো হচ্ছে";
  const key = process.env["LOVABLE_API_KEY"];
  if (key && facts.length) {
    try {
      const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: "google/gemini-3-flash",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "You write short Bengali sales replies for a Bangladesh real-estate agent. Use ONLY the verified facts and lead context provided. Never invent prices, rates, availability or regulations. Any number you write must appear in a cited fact or the context. Return JSON {\"text\":string,\"fact_ids\":string[]}." },
            { role: "user", content: JSON.stringify({ objection: objectionLabel(objection), agent_note: note, approved_template: base, lead_context: brief.contextText, verified_facts: facts.map((f) => ({ id: f.id, metric: f.metric, value: f.value, unit: f.unit, geography: f.geography, source: f.source_name, effective_date: f.effective_date })) }) },
          ],
        }),
      });
      if (r.ok) {
        const raw = ((await r.json()) as { choices?: { message?: { content?: string } }[] }).choices?.[0]?.message?.content ?? "";
        const parsed = JSON.parse(raw) as { text?: string; fact_ids?: string[] };
        const reply = { text: String(parsed.text ?? ""), fact_ids: Array.isArray(parsed.fact_ids) ? parsed.fact_ids.map(String) : [] };
        const check = validateGrounding(reply, facts, `${brief.contextText}\n${base}\n${note ?? ""}`);
        if (check.ok) { text = reply.text; factIds = reply.fact_ids; grounded = true; }
        else aiNote = `AI উত্তর বাতিল (${check.reason}) — অনুমোদিত টেমপ্লেট দেখানো হচ্ছে`;
      } else aiNote = r.status === 402 ? "AI ক্রেডিট শেষ — টেমপ্লেট দেখানো হচ্ছে" : "AI এখন ব্যস্ত — টেমপ্লেট দেখানো হচ্ছে";
    } catch {
      aiNote = "AI উত্তর পাওয়া যায়নি — টেমপ্লেট দেখানো হচ্ছে";
    }
  }
  const support = facts.filter((f) => factIds.includes(f.id) || !grounded).slice(0, 6);
  return {
    text,
    grounded,
    aiNote,
    templateId: tpl?.id ?? null,
    factIds,
    why,
    supportingFacts: support.map((f) => ({ id: f.id, category: f.category, metric: f.metric, value: f.value, unit: f.unit, geography: f.geography, source: f.source_name, sourceUrl: f.source_url, effectiveDate: f.effective_date, status: f.status, eligibility: factEligibility(f), reviewDate: f.review_date, expiryDate: f.expiry_date, version: f.version })),
    lead: brief.lead,
    lastReportId: brief.lastReportId,
    openFollowUpId: brief.openFollowUpId,
  };
}

/** Append-only pitch event. Idempotent on (agent, lead, action, clientActionId). */
export async function recordPitchEvent(
  c: SiCaller,
  input: { leadId: string; objection: ObjectionCode; action: PitchAction; clientActionId: string; templateId: string | null; generatedText: string | null; finalText: string | null; project: string | null; factIds: string[]; grounded: boolean; callId: string | null; followUpId: string | null },
  deps: { db?: Db; assertBriefing?: (agentId: string) => Promise<void> } = {},
) {
  if (c.scope !== "agent" || !c.agentId) throw new Error("শুধু নির্ধারিত এজেন্ট পিচ ব্যবহার লিখতে পারেন");
  const db = deps.db ?? (await admin());
  const assert = deps.assertBriefing ?? (async (id: string) => (await import("@/lib/agent-briefing.server")).assertAgentBriefing(id));
  await assert(c.agentId);
  await leadForCaller(db, c, input.leadId);
  // Facts must exist; unknown ids are dropped rather than stored as references.
  let factIds: string[] = [];
  if (input.factIds.length) {
    const { data } = await db.from("market_facts").select("id").in("id", input.factIds);
    factIds = (data ?? []).map((f) => f.id);
  }
  const correlation_key = pitchCorrelationKey(c.agentId, input.leadId, input.action, input.clientActionId);
  const row = {
    lead_id: input.leadId,
    agent_id: c.agentId,
    call_id: input.callId,
    follow_up_id: input.followUpId,
    objection_code: input.objection,
    template_id: input.templateId,
    action: input.action,
    generated_text: input.generatedText?.slice(0, 4000) ?? null,
    final_text: input.finalText?.slice(0, 4000) ?? null,
    project: input.project?.slice(0, 120) || null,
    fact_ids: factIds,
    ai_grounded: input.grounded,
    correlation_key,
  };
  const { data, error } = await db.from("pitch_events").insert(row).select("id, created_at").maybeSingle();
  if (error?.code === "23505") {
    const { data: existing } = await db.from("pitch_events").select("id, created_at").eq("correlation_key", correlation_key).maybeSingle();
    return { id: existing?.id ?? null, createdAt: existing?.created_at ?? null, duplicate: true };
  }
  if (error) throw new Error("পিচ ইতিহাস সংরক্ষণ হয়নি");
  return { id: data?.id ?? null, createdAt: data?.created_at ?? null, duplicate: false };
}

export type PitchFilters = {
  q?: string | null | undefined; leadId?: string | null | undefined; agentId?: string | null | undefined; objection?: string | null | undefined; templateId?: string | null | undefined;
  project?: string | null | undefined; action?: string | null | undefined; source?: string | null | undefined; outcome?: string | null | undefined; from?: string | null | undefined; to?: string | null | undefined;
};

/** Lead ids matching a phone / name / source search (server side). */
async function leadIdsFor(db: Db, f: PitchFilters): Promise<string[] | null> {
  const term = f.q?.replace(/[%,()]/g, " ").trim();
  if (!term && !f.source) return null;
  let q = db.from("leads").select("id");
  if (f.source) q = q.eq("source", f.source);
  if (term) {
    const digits = term.replace(/\D/g, "");
    const ors = [`name.ilike.%${term}%`, `serial_no.ilike.%${term}%`];
    if (digits.length >= 6) ors.push(`phone_number.ilike.%${digits.slice(-10)}%`);
    if (/^[0-9a-f-]{36}$/i.test(term)) ors.push(`id.eq.${term}`);
    q = q.or(ors.join(","));
  }
  return (await all<{ id: string }>((a, b) => q.range(a, b))).map((r) => r.id);
}

export function applyPitchFilters<Q extends { eq: (c: string, v: string) => Q; gte: (c: string, v: string) => Q; lt: (c: string, v: string) => Q; in: (c: string, v: string[]) => Q }>(q: Q, c: SiCaller, f: PitchFilters, leadIds: string[] | null) {
  if (c.scope === "agent") q = q.eq("agent_id", c.agentId!);
  else if (f.agentId) q = q.eq("agent_id", f.agentId);
  if (f.leadId) q = q.eq("lead_id", f.leadId);
  if (f.objection) q = q.eq("objection_code", f.objection);
  if (f.templateId) q = q.eq("template_id", f.templateId);
  if (f.project) q = q.eq("project", f.project);
  if (f.action) q = q.eq("action", f.action);
  if (f.from) q = q.gte("created_at", `${f.from}T00:00:00+06:00`);
  if (f.to) q = q.lt("created_at", new Date(Date.parse(`${f.to}T00:00:00+06:00`) + 86400_000).toISOString());
  if (leadIds) q = q.in("lead_id", leadIds.length ? leadIds.slice(0, 1000) : ["00000000-0000-0000-0000-000000000000"]);
  return q;
}

const PITCH_COLS = "id, lead_id, agent_id, call_id, follow_up_id, objection_code, template_id, action, generated_text, final_text, project, fact_ids, ai_grounded, created_at";
type PitchRow = { id: string; lead_id: string; agent_id: string; call_id: string | null; follow_up_id: string | null; objection_code: string; template_id: string | null; action: string; generated_text: string | null; final_text: string | null; project: string | null; fact_ids: string[]; ai_grounded: boolean; created_at: string };

/** Keyset (created_at, id) cursor pagination — no latest-N truncation. */
export async function searchPitchEvents(c: SiCaller, f: PitchFilters, cursor: { at: string; id: string } | null, pageSize: number) {
  const db = await admin();
  const leadIds = await leadIdsFor(db, f);
  let q = applyPitchFilters(db.from("pitch_events").select(PITCH_COLS, { count: "exact" }), c, f, leadIds);
  if (cursor) q = q.or(`created_at.lt.${cursor.at},and(created_at.eq.${cursor.at},id.lt.${cursor.id})`);
  const { data, error, count } = await q.order("created_at", { ascending: false }).order("id", { ascending: false }).limit(pageSize);
  if (error) throw new Error("পিচ ইতিহাস পড়া যায়নি");
  let rows = (data ?? []) as PitchRow[];
  if (f.outcome) {
    const attr = await attributionsFor(db, rows);
    const hit = new Set(attr.filter((a) => a.kind === f.outcome).map((a) => a.pitchId));
    rows = rows.filter((r) => hit.has(r.id));
  }
  const decorated = await decorate(db, rows);
  const lastRow = (data ?? [])[(data ?? []).length - 1] as PitchRow | undefined;
  return { rows: decorated, total: count ?? 0, nextCursor: (data ?? []).length === pageSize && lastRow ? { at: lastRow.created_at, id: lastRow.id } : null };
}

/** Full export: every matching row, paged 1000 at a time. */
export async function exportPitchEvents(c: SiCaller, f: PitchFilters) {
  const db = await admin();
  const leadIds = await leadIdsFor(db, f);
  let rows = await all<PitchRow>((a, b) => applyPitchFilters(db.from("pitch_events").select(PITCH_COLS), c, f, leadIds).order("created_at", { ascending: false }).order("id", { ascending: false }).range(a, b));
  if (f.outcome) {
    const attr = await attributionsFor(db, rows);
    const hit = new Set(attr.filter((a) => a.kind === f.outcome).map((a) => a.pitchId));
    rows = rows.filter((r) => hit.has(r.id));
  }
  return decorate(db, rows);
}

async function decorate(db: Db, rows: PitchRow[]) {
  const leadIds = [...new Set(rows.map((r) => r.lead_id))];
  const agentIds = [...new Set(rows.map((r) => r.agent_id))];
  const leads = new Map<string, { name: string | null; phone: string }>();
  for (let i = 0; i < leadIds.length; i += 500) {
    const { data } = await db.from("leads").select("id, name, phone_number").in("id", leadIds.slice(i, i + 500));
    for (const l of data ?? []) leads.set(l.id, { name: l.name, phone: l.phone_number });
  }
  const agents = new Map<string, string>();
  for (let i = 0; i < agentIds.length; i += 500) {
    const { data } = await db.from("profiles").select("id, name").in("id", agentIds.slice(i, i + 500));
    for (const p of data ?? []) agents.set(p.id, p.name ?? p.id);
  }
  return rows.map((r) => ({ ...r, lead_name: leads.get(r.lead_id)?.name ?? null, lead_phone: leads.get(r.lead_id)?.phone ?? null, agent: agents.get(r.agent_id) ?? null }));
}

/** Outcomes = existing canonical rows only: follow_up_events, call_reports (+ explicit site-visit/booking signals). */
async function outcomesFor(db: Db, leadIds: string[]): Promise<AttrOutcome[]> {
  const out: AttrOutcome[] = [];
  for (let i = 0; i < leadIds.length; i += 300) {
    const ids = leadIds.slice(i, i + 300);
    const [fu, cr] = await Promise.all([
      all<{ id: string; lead_id: string | null; created_at: string }>((a, b) => db.from("follow_up_events").select("id, lead_id, created_at").in("lead_id", ids).range(a, b)),
      all<{ id: string; lead_id: string; created_at: string; customer_response: string | null; next_action: string | null; category: string | null }>((a, b) => db.from("call_reports").select("id, lead_id, created_at, customer_response, next_action, category").in("lead_id", ids).range(a, b)),
    ]);
    for (const f of fu) if (f.lead_id) out.push({ id: f.id, lead_id: f.lead_id, at: f.created_at, kind: "follow_up" });
    for (const r of cr) {
      out.push({ id: r.id, lead_id: r.lead_id, at: r.created_at, kind: "call" });
      if (r.customer_response === "site_visit" || r.next_action === "site_visit") out.push({ id: r.id, lead_id: r.lead_id, at: r.created_at, kind: "site_visit" });
      if (r.category === "closed_converted") out.push({ id: r.id, lead_id: r.lead_id, at: r.created_at, kind: "booking" });
    }
  }
  return out;
}

async function attributionsFor(db: Db, rows: PitchRow[], windowDays = 14) {
  const outcomes = await outcomesFor(db, [...new Set(rows.map((r) => r.lead_id))]);
  return attributeOutcomes(rows as AttrPitch[], outcomes, windowDays);
}

/** Deterministic effectiveness over every matching pitch event (no sampling). */
export async function effectiveness(c: SiCaller, f: PitchFilters, windowDays: number) {
  const db = await admin();
  const leadIds = await leadIdsFor(db, f);
  const rows = await all<PitchRow>((a, b) => applyPitchFilters(db.from("pitch_events").select(PITCH_COLS), c, f, leadIds).order("created_at").order("id").range(a, b));
  const attr = await attributionsFor(db, rows, windowDays);
  const summary = summarizeEffectiveness(rows as AttrPitch[], attr);
  const names = new Map((await decorate(db, rows)).map((r) => [r.agent_id, r.agent ?? r.agent_id]));
  const { data: tpls } = await db.from("pitch_templates").select("id, title");
  const tplName = new Map((tpls ?? []).map((t) => [t.id, t.title]));
  return {
    ...summary,
    windowDays,
    byAgent: summary.byAgent.map((x) => ({ ...x, label: names.get(x.key) ?? x.key })),
    byTemplate: summary.byTemplate.map((x) => ({ ...x, label: tplName.get(x.key) ?? (x.key === "—" ? "Fallback / no template" : x.key) })),
    links: attr.slice(0, 500),
    linksTotal: attr.length,
  };
}

// ---------- Knowledge admin (HQ/IT write, versioned) ----------
async function snapshot(db: Db, entity: "market_fact" | "pitch_template", row: { id: string; version: number } & Record<string, unknown>, action: string, actor: string) {
  const { error } = await db.from("knowledge_versions").insert({ entity, entity_id: row.id, version: row.version, action, snapshot: row as never, actor });
  if (error) throw new Error("ভার্সন ইতিহাস সংরক্ষণ হয়নি");
}

export async function saveFact(c: SiCaller, input: { id?: string | null | undefined; category: string; geography: string | null; metric: string; value: string; unit: string | null; source_name: string; source_url: string | null; effective_date: string; review_date: string | null; expiry_date: string | null; notes: string | null }) {
  requireAdminWriter(c);
  if (c.readOnly) throw new Error("HQ ভিউ সেশন শুধু পড়তে পারে — IT PIN দিয়ে পরিবর্তন করুন");
  if (!(FACT_CATEGORY_CODES as readonly string[]).includes(input.category)) throw new Error("ভুল ক্যাটাগরি");
  const db = await admin();
  const { id, ...fields } = input;
  if (id) {
    const { data: cur } = await db.from("market_facts").select("version").eq("id", id).maybeSingle();
    if (!cur) throw new Error("তথ্য পাওয়া যায়নি");
    // Any edit returns the fact to draft: it must be re-verified before use.
    const { data, error } = await db.from("market_facts").update({ ...fields, status: "draft", verified_by: null, verified_at: null, version: cur.version + 1 }).eq("id", id).select("*").single();
    if (error) throw new Error("সংরক্ষণ হয়নি");
    await snapshot(db, "market_fact", data, "edited", c.actor);
    return data;
  }
  const { data, error } = await db.from("market_facts").insert({ ...fields, created_by: c.actor }).select("*").single();
  if (error) throw new Error("সংরক্ষণ হয়নি");
  await snapshot(db, "market_fact", data, "created", c.actor);
  return data;
}

export async function setFactStatus(c: SiCaller, id: string, to: string) {
  requireAdminWriter(c);
  if (c.readOnly) throw new Error("HQ ভিউ সেশন শুধু পড়তে পারে — IT PIN দিয়ে পরিবর্তন করুন");
  const db = await admin();
  const { data: cur } = await db.from("market_facts").select("*").eq("id", id).maybeSingle();
  if (!cur) throw new Error("তথ্য পাওয়া যায়নি");
  if (!canTransition(cur.status, to)) throw new Error(`${cur.status} থেকে ${to} করা যাবে না`);
  const patch = { status: to, version: cur.version + 1, ...(to === "verified" ? { verified_by: c.actor, verified_at: new Date().toISOString() } : {}) };
  const { data, error } = await db.from("market_facts").update(patch).eq("id", id).select("*").single();
  if (error) throw new Error("স্ট্যাটাস বদল হয়নি");
  await snapshot(db, "market_fact", data, to, c.actor);
  return data;
}

export async function saveTemplate(c: SiCaller, input: { id?: string | null | undefined; objection_code: string; title: string; body: string }) {
  requireAdminWriter(c);
  if (c.readOnly) throw new Error("HQ ভিউ সেশন শুধু পড়তে পারে — IT PIN দিয়ে পরিবর্তন করুন");
  const db = await admin();
  if (input.id) {
    const { data: cur } = await db.from("pitch_templates").select("version").eq("id", input.id).maybeSingle();
    if (!cur) throw new Error("টেমপ্লেট পাওয়া যায়নি");
    const { data, error } = await db.from("pitch_templates").update({ objection_code: input.objection_code, title: input.title, body: input.body, status: "draft", version: cur.version + 1 }).eq("id", input.id).select("*").single();
    if (error) throw new Error("সংরক্ষণ হয়নি");
    await snapshot(db, "pitch_template", data, "edited", c.actor);
    return data;
  }
  const { data, error } = await db.from("pitch_templates").insert({ objection_code: input.objection_code, title: input.title, body: input.body, created_by: c.actor }).select("*").single();
  if (error) throw new Error("সংরক্ষণ হয়নি");
  await snapshot(db, "pitch_template", data, "created", c.actor);
  return data;
}

export async function setTemplateStatus(c: SiCaller, id: string, to: string) {
  requireAdminWriter(c);
  if (c.readOnly) throw new Error("HQ ভিউ সেশন শুধু পড়তে পারে — IT PIN দিয়ে পরিবর্তন করুন");
  const db = await admin();
  const { data: cur } = await db.from("pitch_templates").select("*").eq("id", id).maybeSingle();
  if (!cur) throw new Error("টেমপ্লেট পাওয়া যায়নি");
  if (!canTransition(cur.status, to)) throw new Error(`${cur.status} থেকে ${to} করা যাবে না`);
  const { data, error } = await db.from("pitch_templates").update({ status: to, version: cur.version + 1 }).eq("id", id).select("*").single();
  if (error) throw new Error("স্ট্যাটাস বদল হয়নি");
  await snapshot(db, "pitch_template", data, to, c.actor);
  return data;
}

export async function listTemplates(c: SiCaller) {
  const db = await admin();
  let q = db.from("pitch_templates").select("*").order("objection_code").order("updated_at", { ascending: false });
  if (c.scope !== "authority") q = q.eq("status", "published");
  return all<{ id: string; objection_code: string; title: string; body: string; status: string; version: number; created_by: string; created_at: string; updated_at: string }>((a, b) => q.range(a, b));
}

export async function listVersions(c: SiCaller, entityId: string | null) {
  requireAdminWriter(c);
  const db = await admin();
  let q = db.from("knowledge_versions").select("id, entity, entity_id, version, action, snapshot, actor, created_at").order("created_at", { ascending: false }).order("id");
  if (entityId) q = q.eq("entity_id", entityId);
  const rows = await all<{ id: string; entity: string; entity_id: string; version: number; action: string; snapshot: unknown; actor: string; created_at: string }>((a, b) => q.range(a, b));
  return rows.map(({ snapshot: snap, ...r }) => {
    const o = (snap ?? {}) as Record<string, unknown>;
    return { ...r, label: String(o["metric"] ?? o["title"] ?? ""), status: String(o["status"] ?? "") };
  });
}

/** Agent's own assigned leads (for picking a lead in the pitchbook). */
export async function myLeads(c: SiCaller, q: string) {
  if (c.scope !== "agent") return [];
  const db = await admin();
  let query = db.from("leads").select("id, name, phone_number").or(`assigned_to.eq.${c.agentId},assigned_agent_id.eq.${c.agentId}`).order("updated_at", { ascending: false }).limit(50);
  const term = q.replace(/[%,()]/g, " ").trim();
  if (term) query = query.or(`name.ilike.%${term}%,phone_number.ilike.%${term.replace(/\D/g, "").slice(-10) || term}%`);
  const { data } = await query;
  return data ?? [];
}
