/**
 * Sales Intelligence — pure rules shared by server, UI and tests.
 * No market numbers live here: every fact comes from the market_facts table.
 */

export const SI_DOC_VERSION = "SI-1.0.0";

export const OBJECTIONS = [
  { code: "price_high", label: "Price is high", bn: "দাম বেশি" },
  { code: "loan_rate_high", label: "Loan rate is high", bn: "লোনের সুদ বেশি" },
  { code: "market_may_fall", label: "Market may fall", bn: "বাজার কমতে পারে" },
  { code: "family_discuss", label: "Need to discuss with family", bn: "পরিবারের সাথে আলোচনা" },
  { code: "not_ready", label: "Not ready now", bn: "এখন প্রস্তুত নন" },
  { code: "more_info", label: "Wants more information", bn: "আরও তথ্য চান" },
  { code: "comparing", label: "Comparing other projects", bn: "অন্য প্রজেক্টের সাথে তুলনা" },
  { code: "lower_budget", label: "Wants lower budget", bn: "কম বাজেট চান" },
  { code: "location", label: "Location concern", bn: "লোকেশন নিয়ে চিন্তা" },
  { code: "payment", label: "Payment concern", bn: "পেমেন্ট নিয়ে চিন্তা" },
  { code: "trust", label: "Trust / developer concern", bn: "ডেভেলপারে বিশ্বাস" },
  { code: "ready_property", label: "Wants ready property", bn: "রেডি প্রপার্টি চান" },
  { code: "other", label: "Other", bn: "অন্যান্য" },
] as const;
export type ObjectionCode = (typeof OBJECTIONS)[number]["code"];
export const OBJECTION_CODES = OBJECTIONS.map((o) => o.code) as [ObjectionCode, ...ObjectionCode[]];
export const objectionLabel = (code: string) => OBJECTIONS.find((o) => o.code === code)?.label ?? code;

/** Which fact categories support which objection (used to pick supporting facts). */
export const OBJECTION_FACT_CATEGORIES: Record<ObjectionCode, FactCategory[]> = {
  price_high: ["area_price", "project_property", "daily_market"],
  loan_rate_high: ["finance_loan"],
  market_may_fall: ["daily_market", "area_price"],
  family_discuss: ["project_property"],
  not_ready: ["daily_market", "project_property"],
  more_info: ["project_property", "regulatory"],
  comparing: ["project_property", "area_price"],
  lower_budget: ["project_property", "finance_loan"],
  location: ["project_property", "area_price"],
  payment: ["finance_loan", "project_property"],
  trust: ["project_property"],
  ready_property: ["project_property", "area_price"],
  other: ["project_property"],
};

export const FACT_CATEGORIES = [
  { code: "daily_market", label: "Daily Market Brief" },
  { code: "finance_loan", label: "Finance / Loan" },
  { code: "area_price", label: "Area Price Trend" },
  { code: "regulatory", label: "Government / Regulatory" },
  { code: "project_property", label: "Project / Property Fact" },
] as const;
export type FactCategory = (typeof FACT_CATEGORIES)[number]["code"];
export const FACT_CATEGORY_CODES = FACT_CATEGORIES.map((c) => c.code) as [FactCategory, ...FactCategory[]];

export const KNOWLEDGE_STATUSES = ["draft", "verified", "published", "expired"] as const;
export type KnowledgeStatus = (typeof KNOWLEDGE_STATUSES)[number];

export type MarketFact = {
  id: string;
  category: string;
  geography: string | null;
  metric: string;
  value: string;
  unit: string | null;
  source_name: string;
  source_url: string | null;
  effective_date: string;
  status: string;
  verified_by: string | null;
  review_date: string | null;
  expiry_date: string | null;
  version: number;
  notes: string | null;
};

/** Allowed status transitions for facts and pitch templates. */
const TRANSITIONS: Record<KnowledgeStatus, KnowledgeStatus[]> = {
  draft: ["verified", "expired"],
  verified: ["published", "draft", "expired"],
  published: ["expired", "draft"],
  expired: ["draft"],
};
export function canTransition(from: string, to: string) {
  return (TRANSITIONS[from as KnowledgeStatus] ?? []).includes(to as KnowledgeStatus);
}

/** Dhaka calendar date (YYYY-MM-DD) for an instant. */
export function dhakaDate(now: Date | number = Date.now()) {
  return new Date(new Date(now).getTime() + 6 * 3600_000).toISOString().slice(0, 10);
}

export type FactEligibility = "authoritative" | "expired" | "unverified" | "review_due";

/** Only published, non-expired facts are authoritative for customer-facing pitches. */
export function factEligibility(fact: Pick<MarketFact, "status" | "expiry_date" | "review_date">, now: Date | number = Date.now()): FactEligibility {
  const today = dhakaDate(now);
  if (fact.status === "expired" || (fact.expiry_date && fact.expiry_date < today)) return "expired";
  if (fact.status !== "published") return "unverified";
  if (fact.review_date && fact.review_date < today) return "review_due";
  return "authoritative";
}
export const isAuthoritative = (f: Pick<MarketFact, "status" | "expiry_date" | "review_date">, now?: Date | number) => {
  const e = factEligibility(f, now);
  return e === "authoritative" || e === "review_due";
};

/**
 * Grounding contract: the AI reply may only cite provided fact ids and may only
 * contain numbers that appear in those facts or the lead context. Anything else
 * is rejected and the caller falls back to the approved template.
 */
export function validateGrounding(
  reply: { text: string; fact_ids: string[] },
  allowedFacts: Array<Pick<MarketFact, "id" | "value" | "metric" | "unit">>,
  contextText: string,
): { ok: true } | { ok: false; reason: string } {
  const allowed = new Set(allowedFacts.map((f) => f.id));
  for (const id of reply.fact_ids) if (!allowed.has(id)) return { ok: false, reason: `unknown fact id ${id}` };
  const cited = allowedFacts.filter((f) => reply.fact_ids.includes(f.id));
  const pool = [contextText, ...cited.map((f) => `${f.metric} ${f.value} ${f.unit ?? ""}`)].join(" ");
  const poolNums = new Set((toAscii(pool).match(/\d+(?:[.,]\d+)?/g) ?? []).map(normNum));
  for (const n of toAscii(reply.text).match(/\d+(?:[.,]\d+)?/g) ?? []) {
    if (!poolNums.has(normNum(n))) return { ok: false, reason: `ungrounded number ${n}` };
  }
  if (!reply.text.trim()) return { ok: false, reason: "empty reply" };
  return { ok: true };
}
const BN = "০১২৩৪৫৬৭৮৯";
function toAscii(s: string) {
  return s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
}
const normNum = (n: string) => n.replace(/,/g, "").replace(/\.0+$/, "");

export const PITCH_ACTIONS = ["viewed", "copied", "edited", "whatsapp_opened", "saved"] as const;
export type PitchAction = (typeof PITCH_ACTIONS)[number];
export const PITCH_ACTION_LABEL: Record<PitchAction, string> = {
  viewed: "Viewed",
  copied: "Copied",
  edited: "Edited",
  whatsapp_opened: "WhatsApp opened / message prepared",
  saved: "Saved to lead history",
};

/**
 * WhatsApp classification: opening wa.me never proves delivery. Without a real
 * provider callback the action is always "whatsapp_opened".
 */
export function classifyWhatsApp(providerStatus?: "sent" | "delivered" | "read" | null): { action: PitchAction; delivered: boolean; label: string } {
  if (providerStatus) return { action: "whatsapp_opened", delivered: providerStatus !== "sent", label: `Provider confirmed: ${providerStatus}` };
  return { action: "whatsapp_opened", delivered: false, label: PITCH_ACTION_LABEL.whatsapp_opened };
}

/** wa.me link for a Bangladesh number; null when the number cannot be dialled. */
export function whatsappUrl(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  let intl: string | null = null;
  if (/^8801[3-9]\d{8}$/.test(digits)) intl = digits;
  else if (/^01[3-9]\d{8}$/.test(digits)) intl = `88${digits}`;
  else if (/^1[3-9]\d{8}$/.test(digits)) intl = `880${digits}`;
  if (!intl) return null;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

/** Deterministic idempotency key: the same client action id always maps to one row. */
export function pitchCorrelationKey(agentId: string, leadId: string, action: string, clientActionId: string) {
  return `pitch:${agentId}:${leadId}:${action}:${clientActionId}`;
}

// ---------- Deterministic attribution ----------
export type AttrPitch = { id: string; lead_id: string; agent_id: string; created_at: string; objection_code: string; template_id: string | null; project: string | null };
export type AttrOutcome = { id: string; lead_id: string; at: string; kind: "follow_up" | "call" | "site_visit" | "booking" };
export type Attribution = { pitchId: string; kind: AttrOutcome["kind"]; outcomeId: string; at: string };

/**
 * Links each pitch to the FIRST later outcome of each kind on the same lead
 * inside the window. Association only — never causation. Same input → same output.
 */
export function attributeOutcomes(pitches: AttrPitch[], outcomes: AttrOutcome[], windowDays = 14): Attribution[] {
  const win = Math.max(1, Math.min(90, windowDays)) * 86400_000;
  const byLead = new Map<string, AttrOutcome[]>();
  for (const o of [...outcomes].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id))) {
    const list = byLead.get(o.lead_id) ?? [];
    list.push(o);
    byLead.set(o.lead_id, list);
  }
  const out: Attribution[] = [];
  for (const p of [...pitches].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id))) {
    const t0 = Date.parse(p.created_at);
    const seen = new Set<string>();
    for (const o of byLead.get(p.lead_id) ?? []) {
      const t = Date.parse(o.at);
      if (t <= t0 || t > t0 + win || seen.has(o.kind)) continue;
      seen.add(o.kind);
      out.push({ pitchId: p.id, kind: o.kind, outcomeId: o.id, at: o.at });
    }
  }
  return out;
}

export function summarizeEffectiveness(pitches: AttrPitch[], attributions: Attribution[]) {
  const count = (k: AttrOutcome["kind"]) => new Set(attributions.filter((a) => a.kind === k).map((a) => a.pitchId)).size;
  const tally = (key: (p: AttrPitch) => string | null) => {
    const m = new Map<string, number>();
    for (const p of pitches) {
      const k = key(p) ?? "—";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k, n]) => ({ key: k, count: n }));
  };
  return {
    total: pitches.length,
    toFollowUp: count("follow_up"),
    toCall: count("call"),
    toSiteVisit: count("site_visit"),
    toBooking: count("booking"),
    byObjection: tally((p) => p.objection_code),
    byTemplate: tally((p) => p.template_id),
    byAgent: tally((p) => p.agent_id),
    byProject: tally((p) => p.project),
  };
}

/** CSV with header block (filters, generated time, scope, version). Missing fields stay blank. */
export function pitchHistoryCsv(
  meta: { filters: Record<string, unknown>; scope: string; generatedAt: Date; total: number },
  rows: Array<{ id: string; created_at: string; lead_id: string; lead_name: string | null; agent: string | null; objection_code: string; template_id: string | null; action: string; project: string | null; final_text: string | null; generated_text: string | null; fact_ids: string[] }>,
) {
  const esc = (v: unknown) => {
    const raw = v == null ? "" : String(v);
    // Neutralise spreadsheet formulas (=, +, -, @, tab, CR) planted in free text.
    const s = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const dh = (iso: string) => new Date(Date.parse(iso) + 6 * 3600_000).toISOString().replace("T", " ").slice(0, 16);
  const filters = Object.entries(meta.filters).filter(([, v]) => v != null && v !== "").map(([k, v]) => `${k}=${v}`).join("; ") || "none";
  const lines = [
    ["WINSTONE PULSE — Pitch History", SI_DOC_VERSION],
    ["Generated (Asia/Dhaka)", dh(meta.generatedAt.toISOString())],
    ["Data scope", meta.scope],
    ["Filters", filters],
    ["Total rows", meta.total],
    [],
    ["pitch_event_id", "created_at_utc", "created_at_dhaka", "lead_id", "lead", "agent", "objection", "template_id", "action", "project", "text", "fact_ids"],
    ...rows.map((r) => [r.id, r.created_at, dh(r.created_at), r.lead_id, r.lead_name, r.agent, objectionLabel(r.objection_code), r.template_id, PITCH_ACTION_LABEL[r.action as PitchAction] ?? r.action, r.project, r.final_text ?? r.generated_text, r.fact_ids.join(" ")]),
  ];
  return lines.map((l) => l.map(esc).join(",")).join("\n");
}

/** Neutral fallback wording when no approved template exists — contains no facts or numbers. */
export function fallbackPitch(objection: ObjectionCode, customerName: string | null) {
  const who = customerName ? `${customerName}, ` : "";
  return `${who}আপনার "${OBJECTIONS.find((o) => o.code === objection)?.bn}" বিষয়টি আমরা বুঝতে পারছি। আপনার প্রয়োজন অনুযায়ী যাচাই করা তথ্য দিয়ে বিস্তারিত জানাতে চাই — কখন কথা বলা সুবিধাজনক হবে?`;
}
