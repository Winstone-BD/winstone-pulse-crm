// Server-only: builds the daily one-row-per-lead report and mirrors it into
// one company Google Spreadsheet (one tab per Dhaka date, rewritten on sync).
// Every attempt (manual button or cron) records a sheet_sync_events row so the
// IT Console shows failures and the last success.
import type { SheetRow } from "@/lib/pipeline-intel";
import { recordSheetSyncEvent } from "@/lib/sheet-metrics.server";

const GW = "https://connector-gateway.lovable.dev/google_sheets/v4";
const CONFIG_ID = "daily_sheet_google";

export async function buildDailySheet(date: string): Promise<SheetRow[]> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const start = new Date(`${date}T00:00:00+06:00`).toISOString();
  const end = new Date(Date.parse(start) + 86_400_000).toISOString();
  const [calls, visits, books] = await Promise.all([
    db.from("call_reports").select("lead_id, submitted_at").eq("status", "submitted").gte("submitted_at", start).lt("submitted_at", end).limit(5000),
    db.from("site_visits").select("lead_id, status, visit_at").gte("visit_at", start).lt("visit_at", end).limit(5000),
    db.from("bookings").select("lead_id, approval_status, booked_at").gte("booked_at", start).lt("booked_at", end).limit(5000),
  ]);
  for (const r of [calls, visits, books]) if (r.error) throw new Error(r.error.message);
  const agg = new Map<string, { visits: number; done: number; bookings: number; pay: string[]; last: string | null }>();
  const get = (id: string) => agg.get(id) ?? (agg.set(id, { visits: 0, done: 0, bookings: 0, pay: [], last: null }), agg.get(id)!);
  const touch = (e: { last: string | null }, t: string | null) => { if (t && (!e.last || t > e.last)) e.last = t; };
  for (const r of calls.data ?? []) if (r.lead_id) touch(get(r.lead_id), r.submitted_at);
  for (const r of visits.data ?? []) { const e = get(r.lead_id); e.visits++; if (r.status === "completed") e.done++; touch(e, r.visit_at); }
  for (const r of books.data ?? []) { const e = get(r.lead_id); e.bookings++; e.pay.push(r.approval_status === "approved" ? "HQ approved" : `awaiting HQ (${r.approval_status})`); touch(e, r.booked_at); }
  const ids = [...agg.keys()].slice(0, 1000);
  const leads = ids.length ? (await db.from("leads").select("id, name, phone_number, status, assigned_to, pipeline_stage").in("id", ids)).data ?? [] : [];
  const owners = [...new Set(leads.map((l) => l.assigned_to).filter(Boolean))] as string[];
  const pn = new Map(((owners.length ? (await db.from("profiles").select("id, name").in("id", owners)).data : []) ?? []).map((p) => [p.id, p.name as string]));
  const fmt = (t: string | null) => (t ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka", hour: "2-digit", minute: "2-digit" }).format(new Date(t)) : null);
  return leads.map((l) => {
    const e = agg.get(l.id)!;
    return { leadId: l.id, lead: l.name, phone: l.phone_number, agent: l.assigned_to ? pn.get(l.assigned_to) ?? null : null, status: String(l.status), stage: String(l.pipeline_stage), visits: e.visits, visitsCompleted: e.done, bookings: e.bookings, paymentStatus: e.pay.join("; ") || "—", lastActivity: fmt(e.last) };
  }).sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? ""));
}

async function gw(path: string, init: RequestInit = {}) {
  const lk = process.env["LOVABLE_API_KEY"];
  const sk = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lk || !sk) throw new Error("Google Sheets is not connected");
  const res = await fetch(`${GW}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": sk, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.text();
    console.error(`Google Sheets request failed [${res.status}]: ${body}`);
    throw new Error(`Google Sheets request failed [${res.status}]: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function spreadsheetId(): Promise<string> {
  const { supabaseAdmin: db } = await import("@/integrations/supabase/client.server");
  const { data } = await db.from("app_config").select("data").eq("id", CONFIG_ID).maybeSingle();
  const saved = (data?.data as { spreadsheetId?: string } | null)?.spreadsheetId;
  if (saved) return saved;
  const created = await gw("/spreadsheets", { method: "POST", body: JSON.stringify({ properties: { title: "WINSTONE PULSE — Daily Lead Report" } }) });
  const id = created.spreadsheetId as string;
  const { error } = await db.from("app_config").upsert({ id: CONFIG_ID, data: { spreadsheetId: id }, updated_at: new Date().toISOString() } as never);
  if (error) throw new Error(error.message);
  return id;
}

export async function syncDailySheet(date: string) {
  const startedAt = Date.now();
  try {
    const rows = await buildDailySheet(date);
    const id = await spreadsheetId();
    const meta = await gw(`/spreadsheets/${id}?fields=sheets.properties.title`);
    const titles: string[] = (meta.sheets ?? []).map((s: { properties: { title: string } }) => s.properties.title);
    if (!titles.includes(date)) {
      await gw(`/spreadsheets/${id}:batchUpdate`, { method: "POST", body: JSON.stringify({ requests: [{ addSheet: { properties: { title: date } } }] }) });
    }
    // Pull HQ edits first so the rewrite never loses them; they become proposals
    // that HQ confirms in the CRM. HQ note/payment cells and HQ-added rows are kept.
    let pending = 0;
    const hq = new Map<string, [string, string]>();
    const extraRows: string[][] = [];
    if (titles.includes(date)) {
      const cur = await gw(`/spreadsheets/${id}/values/'${date}'!A:N`);
      const vals = (cur.values ?? []) as string[][];
      const { parseSheetEdits, recordProposals } = await import("@/lib/sheet-pull.server");
      pending = await recordProposals(date, parseSheetEdits(vals));
      for (const r of vals.slice(1)) {
        const lid = String(r[13] ?? "").trim();
        if (lid) hq.set(lid, [String(r[11] ?? ""), String(r[12] ?? "")]);
        else if (String(r[0] ?? "").trim()) extraRows.push(r.map(String));
      }
    }
    await gw(`/spreadsheets/${id}/values/'${date}'!A:N:clear`, { method: "POST", body: "{}" });
    const values = [
      ["Lead", "Phone", "Agent", "Status", "Stage", "Visits", "Visits completed", "Bookings", "Payment status", "Last activity (Dhaka)", "Synced at", "HQ note", "HQ payment (USD)", "Lead ID"],
      ...rows.map((r) => [r.lead, r.phone, r.agent ?? "", r.status, r.stage, r.visits, r.visitsCompleted, r.bookings, r.paymentStatus, r.lastActivity ?? "", "", ...(hq.get(r.leadId) ?? ["", ""]), r.leadId]),
      ...extraRows,
    ];
    (values[0] as unknown[])[10] = `Synced ${new Date().toISOString()}`;
    // RAW: values are stored as text, never evaluated as formulas.
    await gw(`/spreadsheets/${id}/values/'${date}'!A1?valueInputOption=RAW`, { method: "PUT", body: JSON.stringify({ values }) });
    await recordSheetSyncEvent({ surface: "daily_sheet", operation: "sync", outcome: "success", durationMs: Date.now() - startedAt });
    return { rows: rows.length, pending, url: `https://docs.google.com/spreadsheets/d/${id}/edit` };
  } catch (e) {
    await recordSheetSyncEvent({
      surface: "daily_sheet",
      operation: "sync",
      outcome: "failure",
      durationMs: Date.now() - startedAt,
      errorText: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
