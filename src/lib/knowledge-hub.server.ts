/**
 * Winstone Knowledge Hub (winstonebd.com) → CRM, server only.
 *  - official news: public RSS feed copied verbatim (no AI rewrite)
 *  - project facts: stored public /projects/* pages matched to a lead's own text
 *  - website visit requests: signed bridge event; a request never becomes a
 *    site visit until the agent/HQ confirms it.
 */
import { visitRequestVisible, fetchHubText, HUB_NEWS_FEED, parseHubFeed } from "@/lib/knowledge-hub-rules";
import type { SiCaller } from "@/lib/sales-intel.server";

const HUB = "https://winstonebd.com";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/* ---------------- Official news ---------------- */

export async function importOfficialNews(actor: string) {
  const db = await admin();
  const res = await fetchHubText(HUB_NEWS_FEED);
  if (!res) return { fetched: 0, added: 0 };
  const items = parseHubFeed(res.text).slice(0, 30);
  let added = 0;
  for (const it of items) {
    const summary = (it.description || it.title).slice(0, 1200);
    const pub = it.publishedAt;
    const { error } = await db.from("market_news").insert({
      origin: "official", source: "winstone_official", status: "published", headline: it.title.slice(0, 200), summary, key_points: [],
      category: "announcement", tags: ["winstone", "winstone_official"], source_name: "Winstone Properties (অফিসিয়াল)",
      source_url: it.link, source_title: it.title, retrieved_excerpt: `${it.title} ${it.description}`.slice(0, 2000),
      source_published_at: pub, dedupe_key: `official:${it.link}`.slice(0, 500), created_by: actor,
    });
    if (!error) added++;
  }
  return { fetched: items.length, added };
}

export async function latestOfficialNews() {
  const db = await admin();
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await db
    .from("market_news")
    .select("id, headline, source_url, source_published_at, created_at")
    .eq("origin", "official").eq("status", "published").gte("created_at", since)
    .order("created_at", { ascending: false }).limit(3);
  return data ?? [];
}

/* ---------------- Project facts for a lead ---------------- */

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export async function projectFactsForLead(c: SiCaller, leadId: string) {
  const db = await admin();
  const { leadForCaller } = await import("@/lib/sales-intel.server");
  const lead = await leadForCaller(db, c, leadId);
  const [{ data: reports }, { data: reqs }, { data: pages }] = await Promise.all([
    db.from("call_reports").select("requirement, summary").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(10),
    db.from("website_visit_requests").select("project").eq("lead_id", leadId).limit(5),
    db.from("website_pages").select("url, title, content, fetched_at").like("url", `${HUB}/projects/%`).limit(60),
  ]);
  const leadText = norm([lead.notes, lead.area, ...(reports ?? []).flatMap((r) => [r.requirement, r.summary]), ...(reqs ?? []).map((r) => r.project)].filter(Boolean).join(" "));
  const matches = (pages ?? [])
    .map((p) => {
      const slug = p.url.slice(`${HUB}/projects/`.length).split(/[/?#]/)[0] ?? "";
      const words = slug.split("-").filter((w) => w.length > 2 && w !== "winstone");
      const hit = words.length > 0 && words.every((w) => leadText.includes(w));
      return hit ? { url: p.url, title: (p.title ?? "").split("|")[0]!.split("—")[0]!.trim() || slug, excerpt: p.content.slice(0, 900), fetchedAt: p.fetched_at } : null;
    })
    .filter(Boolean)
    .slice(0, 3) as { url: string; title: string; excerpt: string; fetchedAt: string }[];
  return { matches, projectPages: (pages ?? []).length };
}

/* ---------------- Website visit requests ---------------- */

export type VisitRequestPayload = import("@/lib/os-bridge").VisitRequested;

export async function applyVisitRequested(key: string, p: VisitRequestPayload, phone: string) {
  const db = await admin();
  const { data: status } = await db.rpc("lead_phone_status", { _raw: phone });
  let leadId = (status as { existing_lead_id: string | null }[] | null)?.[0]?.existing_lead_id ?? null;
  let outcome = "request_on_existing_lead";
  if (!leadId) {
    const { intakeLead } = await import("@/lib/lead-intake.server");
    const r = await intakeLead({
      name: p.name, phoneNumber: phone, ownerId: null, source: "web_site_visit", actorLabel: "Winstone Website",
      notes: ["Website site-visit request", p.project ? `Project: ${p.project}` : null].filter(Boolean).join("\n"),
    });
    leadId = r.leadId;
    outcome = r.duplicate ? "request_on_existing_lead" : "request_new_lead";
  }
  const { error } = await db.from("website_visit_requests").insert({
    hub_request_id: p.request_id, lead_id: leadId, phone, customer_name: p.name, project: p.project ?? null,
    preferred_date: p.preferred_date ?? null, preferred_time: p.preferred_time ?? null, visitors: p.visitors ?? null, notes: p.notes ?? null,
  });
  if (error && error.code !== "23505") throw error;
  await db.from("os_event_receipts" as never)
    .update({ status: "processed", outcome, lead_id: leadId, processed_at: new Date().toISOString() } as never)
    .eq("idempotency_key", key);
  const { logAudit } = await import("@/lib/audit.server");
  await logAudit({ action: "os_event_received", entityType: "lead", entityId: leadId, actorLabel: "Winstone Website", metadata: { event_type: "site_visit.requested", request_id: p.request_id, outcome } });
  return { outcome, leadId };
}

/* ---------------- Buyer-portal enquiries ---------------- */

const fmtBdt = (n: number | null | undefined) => (n == null ? null : `৳${n.toLocaleString("en-IN")}`);

export async function applyEnquirySubmitted(key: string, p: import("@/lib/os-bridge").EnquirySubmitted, phone: string) {
  const db = await admin();
  const { data: status } = await db.rpc("lead_phone_status", { _raw: phone });
  let leadId = (status as { existing_lead_id: string | null }[] | null)?.[0]?.existing_lead_id ?? null;
  let outcome = "enquiry_on_existing_lead";
  if (!leadId) {
    const budget = [fmtBdt(p.budget_min_bdt), fmtBdt(p.budget_max_bdt)].filter(Boolean).join(" – ");
    const { intakeLead } = await import("@/lib/lead-intake.server");
    const r = await intakeLead({
      name: p.name, phoneNumber: phone, ownerId: null, source: "web_enquiry", actorLabel: "Winstone Website",
      notes: [
        "Website enquiry",
        p.project ? `Project: ${p.project}` : null,
        p.property_type ? `Type: ${p.property_type}` : null,
        budget ? `Budget: ${budget}` : null,
        p.facing ? `Facing: ${p.facing.replace("_", "-")}` : null,
        p.amenities?.length ? `Amenities: ${p.amenities.join(", ")}` : null,
        p.message ? `Message: ${p.message}` : null,
      ].filter(Boolean).join("\n"),
    });
    leadId = r.leadId;
    outcome = r.duplicate ? "enquiry_on_existing_lead" : "enquiry_new_lead";
  }
  const { error } = await db.from("website_enquiries").insert({
    hub_request_id: p.request_id, lead_id: leadId, outcome, customer_name: p.name, phone, project: p.project ?? null,
    property_type: p.property_type ?? null, budget_min_bdt: p.budget_min_bdt ?? null, budget_max_bdt: p.budget_max_bdt ?? null,
    facing: p.facing ?? null, amenities: p.amenities ?? [], message: p.message ?? null, page_url: p.page_url ?? null,
    utm_source: p.utm_source ?? null, utm_medium: p.utm_medium ?? null, utm_campaign: p.utm_campaign ?? null,
  });
  if (error && error.code !== "23505") throw error;
  await db.from("os_event_receipts" as never)
    .update({ status: "processed", outcome, lead_id: leadId, processed_at: new Date().toISOString() } as never)
    .eq("idempotency_key", key);
  const { logAudit } = await import("@/lib/audit.server");
  await logAudit({ action: "os_event_received", entityType: "lead", entityId: leadId, actorLabel: "Winstone Website", metadata: { event_type: "enquiry.submitted", request_id: p.request_id, outcome } });
  return { outcome, leadId };
}

/** HQ/IT dashboard rows: enquiry + the lead's live status/stage/owner. Phone masked. */
export async function listEnquiries(days: number) {
  const db = await admin();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const { data, error } = await db.from("website_enquiries")
    .select("id, created_at, customer_name, phone, project, property_type, budget_min_bdt, budget_max_bdt, facing, amenities, utm_source, utm_campaign, outcome, leads(status, pipeline_stage, assigned_to)")
    .gte("created_at", since).order("created_at", { ascending: false }).limit(1000);
  if (error) throw new Error("Enquiries could not be loaded");
  type Row = NonNullable<typeof data>[number] & { leads: { status: string | null; pipeline_stage: string | null; assigned_to: string | null } | null };
  return ((data ?? []) as Row[]).map(({ leads, phone, ...r }) => ({
    ...r, phone: `…${phone.slice(-4)}`,
    lead_status: leads?.status ?? null, stage: leads?.pipeline_stage ?? null, assigned: Boolean(leads?.assigned_to),
  }));
}

export async function listVisitRequests(c: SiCaller, opts: { leadId?: string | null; openOnly?: boolean }) {
  const db = await admin();
  let q = db.from("website_visit_requests")
    .select("id, lead_id, customer_name, project, preferred_date, preferred_time, visitors, notes, status, created_at, leads(name, assigned_to)")
    .order("created_at", { ascending: false }).limit(100);
  if (opts.leadId) q = q.eq("lead_id", opts.leadId);
  if (opts.openOnly) q = q.eq("status", "requested");
  const { data, error } = await q;
  if (error) throw new Error("ভিজিট অনুরোধ পড়া যায়নি");
  type Row = NonNullable<typeof data>[number] & { leads: { name: string | null; assigned_to: string | null } | null };
  const rows = (data ?? []) as Row[];
  return rows
    .filter((r) => visitRequestVisible(c, r.leads?.assigned_to))
    .map(({ leads, ...r }) => ({ ...r, lead_name: leads?.name ?? null }));
}

export async function decideVisitRequest(c: SiCaller, input: { id: string; action: "confirm" | "dismiss"; visitAt?: string | null }) {
  if (c.readOnly) throw new Error("শুধু-দেখার অ্যাক্সেসে বদলানো যায় না");
  if (c.scope === "agent" && c.agentId) {
    const { assertAgentBriefing } = await import("@/lib/agent-briefing.server");
    await assertAgentBriefing(c.agentId);
  }
  const db = await admin();
  const { data: req } = await db.from("website_visit_requests").select("id, lead_id, project, notes, status").eq("id", input.id).maybeSingle();
  if (!req || !req.lead_id) throw new Error("অনুরোধ পাওয়া যায়নি");
  if (req.status !== "requested") throw new Error("এই অনুরোধের সিদ্ধান্ত আগেই হয়েছে");
  const { leadForCaller } = await import("@/lib/sales-intel.server");
  const lead = await leadForCaller(db, c, req.lead_id); // agents: only their own leads
  let siteVisitId: string | null = null;
  if (input.action === "confirm") {
    if (!input.visitAt) throw new Error("ভিজিটের তারিখ ও সময় দিন");
    const agentId = c.scope === "agent" ? c.agentId : ((lead as { assigned_agent_id?: string | null }).assigned_agent_id ?? null);
    const { data: v, error } = await db.from("site_visits").insert({
      lead_id: req.lead_id, agent_id: agentId, visit_at: input.visitAt, project: req.project?.slice(0, 120) ?? null,
      notes: `ওয়েবসাইট অনুরোধ থেকে নিশ্চিত${req.notes ? ` — ${req.notes}` : ""}`.slice(0, 500), created_by: c.actor,
    }).select("id").single();
    if (error) throw new Error("সাইট ভিজিট সংরক্ষণ হয়নি");
    siteVisitId = v.id;
  }
  const { error } = await db.from("website_visit_requests").update({
    status: input.action === "confirm" ? "confirmed" : "dismissed", site_visit_id: siteVisitId, decided_by: c.actor, decided_at: new Date().toISOString(),
  }).eq("id", req.id).eq("status", "requested");
  if (error) throw new Error("অনুরোধ আপডেট হয়নি");
  return { ok: true };
}

/** Tells the lead's assigned agent a website visit request arrived (push; in-app bell polls separately). */
export async function notifyVisitRequestAgent(leadId: string | null, requestId: string) {
  if (!leadId) return;
  const db = await admin();
  const { data: lead } = await db.from("leads").select("assigned_to").eq("id", leadId).maybeSingle();
  const agent = (lead as { assigned_to: string | null } | null)?.assigned_to;
  if (!agent) return;
  const { sendPush } = await import("@/lib/push.server");
  await sendPush({
    eventKey: `site_visit_request:${requestId}`, kind: "site_visit_request", entityId: leadId, profileIds: [agent],
    payload: { title: "নতুন সাইট ভিজিট অনুরোধ", body: "ওয়েবসাইট থেকে আপনার লিডে ভিজিট অনুরোধ এসেছে — নিশ্চিত বা বাতিল করুন", path: "/site-visits" },
  }).catch(() => undefined);
}

/** HQ/IT sync health: timestamps and counts only — no secrets, no customer details. */
export async function hubSyncStatus() {
  const db = await admin();
  const stuckBefore = new Date(Date.now() - 15 * 60_000).toISOString();
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const base = () => db.from("os_event_receipts" as never).select("id", { count: "exact", head: true }).eq("event_type" as never, "site_visit.requested" as never).gte("created_at" as never, since as never);
  const [page, pages, news, failed, stuck, processed] = await Promise.all([
    db.from("website_pages").select("fetched_at").order("fetched_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("website_pages").select("id", { count: "exact", head: true }),
    db.from("market_news").select("created_at").eq("origin", "official").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    base().eq("status" as never, "failed" as never),
    base().eq("status" as never, "received" as never).lt("created_at" as never, stuckBefore as never),
    base().eq("status" as never, "processed" as never),
  ]);
  return {
    lastPageSyncAt: (page.data as { fetched_at: string } | null)?.fetched_at ?? null,
    pageCount: pages.count ?? 0,
    lastNewsSyncAt: (news.data as { created_at: string } | null)?.created_at ?? null,
    visitEvents30d: { processed: processed.count ?? 0, failed: failed.count ?? 0, stuck: stuck.count ?? 0 },
  };
}
