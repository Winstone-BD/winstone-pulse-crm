import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAuthoritative } from "@/lib/sales-intel-rules";

export type ChartSpec = {
  kind: "bar" | "line" | "none";
  title: string;
  xKey: string;
  series: { key: string; label: string }[];
  data: Record<string, string | number>[];
};

export type HqAnswer = {
  answer: string;
  sufficient: boolean;
  missing: string | null;
  sources: string[];
  chart: ChartSpec;
};

const MODEL = "google/gemini-3.5-flash";
const CONNECTED = 10;
const NO_CHART: ChartSpec = { kind: "none", title: "", xKey: "", series: [], data: [] };

/** Reads every row (1,000 per page) — never a truncated latest-N sample. */
async function pageAll<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) throw new Error("ডেটা পড়া যায়নি");
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

let cache: { at: number; facts: Awaited<ReturnType<typeof loadFacts>> } | null = null;

/** Approved CRM data + verified, unexpired market facts only. Cached 60s. */
export async function buildFloorFacts() {
  if (cache && Date.now() - cache.at < 60_000) return cache.facts;
  const facts = await loadFacts();
  cache = { at: Date.now(), facts };
  return facts;
}

async function loadFacts() {
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const db = supabaseAdmin;
  const [profiles, leads, calls, reports, followUps, marketRows] = await Promise.all([
    db.from("profiles").select("id, name, role, approval_status").then((r) => r.data ?? []),
    pageAll((a, b) => db.from("leads").select("id, assigned_to, status, source, created_at").order("id").range(a, b)),
    pageAll((a, b) => db.from("call_recordings").select("agent_id, duration_seconds, created_at").gte("created_at", since).order("id").range(a, b)),
    pageAll((a, b) => db.from("call_reports").select("agent_id, category, customer_response, next_action, created_at").eq("status", "submitted").gte("created_at", since).order("id").range(a, b)),
    pageAll((a, b) => db.from("follow_up_events").select("agent_id, status, scheduled_at, completed_at").order("id").range(a, b)),
    db.from("market_facts").select("category, geography, metric, value, unit, source_name, effective_date, status, expiry_date, review_date").then((r) => r.data ?? []),
  ]);

  const nowIso = new Date().toISOString();
  const agents = profiles.filter((p) => p.approval_status !== "rejected" && p.role === "agent");
  const site = (r: { customer_response: string | null; next_action: string | null }) => r.customer_response === "site_visit" || r.next_action === "site_visit";

  const perAgent = agents.map((a) => {
    const c = calls.filter((x) => x.agent_id === a.id);
    const r = reports.filter((x) => x.agent_id === a.id);
    return {
      agent: a.name,
      assigned_leads: leads.filter((l) => l.assigned_to === a.id).length,
      calls_30d: c.length,
      connected_30d: c.filter((x) => (x.duration_seconds ?? 0) >= CONNECTED).length,
      reports_30d: r.length,
      interested_30d: r.filter((x) => x.category === "interested" || x.category === "hot_lead").length,
      site_visits_30d: r.filter(site).length,
      bookings_30d: r.filter((x) => x.category === "closed_converted").length,
      overdue_followups: followUps.filter((f) => f.agent_id === a.id && !f.completed_at && f.status !== "cancelled" && f.scheduled_at < nowIso).length,
    };
  });

  const bySource = new Map<string, number>();
  for (const l of leads) bySource.set(l.source ?? "unknown", (bySource.get(l.source ?? "unknown") ?? 0) + 1);

  const byDay = new Map<string, { day: string; calls: number; connected: number }>();
  for (const c of calls) {
    const day = (c.created_at ?? "").slice(0, 10);
    const row = byDay.get(day) ?? { day, calls: 0, connected: 0 };
    row.calls += 1;
    if ((c.duration_seconds ?? 0) >= CONNECTED) row.connected += 1;
    byDay.set(day, row);
  }

  const market = marketRows
    .filter((f) => isAuthoritative(f as Parameters<typeof isAuthoritative>[0]))
    .map((f) => ({ category: f.category, area: f.geography, metric: f.metric, value: f.value, unit: f.unit, source: f.source_name, effective: f.effective_date }));

  return {
    window: "call/report figures cover the last 30 days; lead totals are all-time",
    totals: {
      leads: leads.length,
      unassigned_leads: leads.filter((l) => !l.assigned_to).length,
      closed_leads: leads.filter((l) => l.status === "closed").length,
      calls_30d: calls.length,
      submitted_reports_30d: reports.length,
      site_visits_30d: reports.filter(site).length,
      bookings_30d: reports.filter((x) => x.category === "closed_converted").length,
    },
    not_recorded: ["deal value / revenue", "customer budget", "site-visit completion status", "teams"],
    per_agent: perAgent,
    lead_sources: [...bySource].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count).slice(0, 15),
    per_day: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
    verified_market_facts: market,
    market_fact_note: market.length ? "only verified, current facts are listed" : "no verified market facts exist yet",
  };
}

const SYSTEM = `You are the Executive HQ sales analyst for Winstone, a Bangladesh real-estate tele-sales CRM.
You receive the approved CRM data and verified market facts as JSON. Rules:
- Use ONLY numbers and facts present in that JSON. Never estimate, extrapolate or use outside knowledge.
- If the JSON cannot answer the question (or only partly), set "sufficient": false and state in "missing" exactly which data is absent. Items in "not_recorded" are never available.
- Never claim causality between actions and outcomes.
- Answer in Bengali, 2-5 short sentences. Never use BDT or ৳ amounts unless they appear in a verified market fact.
Reply with strict JSON only:
{"answer": "string", "sufficient": true|false, "missing": "string or null",
 "sources": ["which JSON sections you used, e.g. per_agent, verified_market_facts"],
 "chart": {"kind": "bar"|"line"|"none", "title": "string", "xKey": "string",
           "series": [{"key": "string", "label": "string"}],
           "data": [{"<xKey>": "label", "<series key>": number}]}}
Use chart kind "none" when insufficient or a chart would not help. Max 20 rows.`;

export async function askFloorQuestion(question: string): Promise<HqAnswer> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI সেট করা নেই");
  const facts = await buildFloorFacts();

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `DATA:\n${JSON.stringify(facts)}\n\nQUESTION: ${question}` },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (response.status === 429) throw new Error("AI এখন ব্যস্ত — একটু পরে আবার চেষ্টা করুন");
  if (response.status === 402) throw new Error("AI ক্রেডিট শেষ — Settings → Plans & credits থেকে যোগ করুন");
  if (response.status === 403) throw new Error("এই ওয়ার্কস্পেসে AI বন্ধ বা সীমা পূর্ণ");
  if (!response.ok) throw new Error(`AI উত্তর দিতে পারেনি (${response.status})`);

  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const raw = (payload.choices?.[0]?.message?.content ?? "").replace(/^```(json)?|```$/g, "").trim();
  if (!raw) return { answer: "AI কোনো উত্তর দেয়নি।", sufficient: false, missing: null, sources: [], chart: NO_CHART };
  try {
    const p = JSON.parse(raw) as Partial<HqAnswer>;
    const sufficient = p.sufficient !== false;
    return {
      answer: p.answer ?? "উত্তর পাওয়া যায়নি।",
      sufficient,
      missing: p.missing ?? null,
      sources: Array.isArray(p.sources) ? p.sources.slice(0, 6) : [],
      chart: sufficient && p.chart && p.chart.kind !== "none" && Array.isArray(p.chart.data) ? p.chart : NO_CHART,
    };
  } catch {
    return { answer: raw, sufficient: false, missing: "উত্তরটি যাচাইযোগ্য আকারে আসেনি", sources: [], chart: NO_CHART };
  }
}
