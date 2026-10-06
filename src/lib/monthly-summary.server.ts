/**
 * Monthly call + follow-up summary → PDF → Google Drive "Daily Call Exports".
 *
 * Reads only saved records (submitted call reports, follow-up events). Months
 * are Dhaka calendar months. Re-running a month replaces that month's file
 * (old copy moved to Drive trash), so there is always one PDF per month.
 */
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

import { driveFetch, getOrCreateDriveFolder, uploadToDrive } from "./gdrive.server";

export const MONTHLY_FOLDER_NAME = "Daily Call Exports";
const DHAKA_MS = 6 * 60 * 60 * 1000;

/** "YYYY-MM" → UTC window of that Dhaka month. */
export function dhakaMonthWindow(month: string) {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const start = new Date(Date.UTC(y, m - 1, 1) - DHAKA_MS);
  const end = new Date(Date.UTC(y, m, 1) - DHAKA_MS);
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Previous Dhaka month as "YYYY-MM". */
export function previousDhakaMonth(now = Date.now()) {
  const d = new Date(now + DHAKA_MS);
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  return prev.toISOString().slice(0, 7);
}

type AgentRow = {
  name: string;
  reports: number;
  connected: number;
  notInterested: number;
  followUpsSet: number;
  followUpsDone: number;
  followUpsOpen: number;
  overdue: number;
};

/** Standard PDF fonts are Latin-only; keep ASCII so nothing renders as boxes. */
function latin(text: string) {
  const clean = text.replace(/[^\x20-\x7E]/g, "").trim();
  return clean || "(Bangla name)";
}

async function collect(month: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { start, end } = dhakaMonthWindow(month);
  const [{ data: reports }, { data: followUps }, { data: profiles }] = await Promise.all([
    supabaseAdmin
      .from("call_reports")
      .select("agent_id, category, connected")
      .eq("status", "submitted")
      .gte("submitted_at", start)
      .lt("submitted_at", end)
      .limit(50_000),
    supabaseAdmin
      .from("follow_up_events")
      .select("agent_id, status, scheduled_at, created_at, completed_at")
      .gte("created_at", start)
      .lt("created_at", end)
      .limit(50_000),
    supabaseAdmin.from("profiles").select("id, name, employee_id").limit(2_000),
  ]);
  const names = new Map((profiles ?? []).map((p) => [p.id, `${p.name ?? ""} ${p.employee_id ? `(${p.employee_id})` : ""}`]));
  const byAgent = new Map<string, AgentRow>();
  const row = (id: string | null) => {
    const key = id ?? "unknown";
    let r = byAgent.get(key);
    if (!r) {
      r = { name: latin(names.get(key) ?? "Unassigned"), reports: 0, connected: 0, notInterested: 0, followUpsSet: 0, followUpsDone: 0, followUpsOpen: 0, overdue: 0 };
      byAgent.set(key, r);
    }
    return r;
  };
  for (const r of reports ?? []) {
    const a = row(r.agent_id);
    a.reports += 1;
    if (r.connected) a.connected += 1;
    if (r.category === "not_interested") a.notInterested += 1;
  }
  const nowIso = new Date().toISOString();
  for (const f of followUps ?? []) {
    const a = row(f.agent_id);
    a.followUpsSet += 1;
    if (f.status === "done") a.followUpsDone += 1;
    else {
      a.followUpsOpen += 1;
      if (f.scheduled_at < nowIso) a.overdue += 1;
    }
  }
  const agents = [...byAgent.values()].sort((x, y) => y.reports - x.reports);
  const totals = agents.reduce(
    (t, a) => ({
      reports: t.reports + a.reports,
      connected: t.connected + a.connected,
      notInterested: t.notInterested + a.notInterested,
      followUpsSet: t.followUpsSet + a.followUpsSet,
      followUpsDone: t.followUpsDone + a.followUpsDone,
      followUpsOpen: t.followUpsOpen + a.followUpsOpen,
      overdue: t.overdue + a.overdue,
    }),
    { reports: 0, connected: 0, notInterested: 0, followUpsSet: 0, followUpsDone: 0, followUpsOpen: 0, overdue: 0 },
  );
  return { agents, totals };
}

export async function buildMonthlySummaryPdf(month: string) {
  const { agents, totals } = await collect(month);
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const W = 842, H = 595; // A4 landscape
  const cols = [
    { h: "Agent", w: 210 }, { h: "Reports", w: 70 }, { h: "Connected", w: 75 },
    { h: "Not interested", w: 90 }, { h: "Follow-ups set", w: 95 }, { h: "Done", w: 60 },
    { h: "Open", w: 60 }, { h: "Overdue", w: 70 },
  ];
  let page = doc.addPage([W, H]);
  let y = H - 50;
  const header = () => {
    page.drawText(`Winstone CRM - Monthly call & follow-up summary - ${month}`, { x: 40, y, size: 15, font: bold });
    y -= 18;
    page.drawText(`Dhaka month. Generated ${new Date(Date.now() + DHAKA_MS).toISOString().slice(0, 16).replace("T", " ")} (Dhaka). Source: submitted call reports and follow-up records.`, { x: 40, y, size: 8.5, font, color: rgb(0.35, 0.35, 0.35) });
    y -= 26;
    let x = 40;
    for (const c of cols) { page.drawText(c.h, { x, y, size: 9.5, font: bold }); x += c.w; }
    y -= 6;
    page.drawLine({ start: { x: 40, y }, end: { x: W - 40, y }, thickness: 0.8 });
    y -= 14;
  };
  header();
  const drawRow = (vals: (string | number)[], f = font) => {
    if (y < 50) { page = doc.addPage([W, H]); y = H - 50; header(); }
    let x = 40;
    vals.forEach((v, i) => {
      const t = String(v);
      page.drawText(i === 0 && t.length > 38 ? `${t.slice(0, 36)}..` : t, { x, y, size: 9, font: f });
      x += cols[i]!.w;
    });
    y -= 15;
  };
  if (agents.length === 0) drawRow(["No saved calls or follow-ups this month", "", "", "", "", "", "", ""]);
  for (const a of agents) drawRow([a.name, a.reports, a.connected, a.notInterested, a.followUpsSet, a.followUpsDone, a.followUpsOpen, a.overdue]);
  y -= 2;
  page.drawLine({ start: { x: 40, y: y + 10 }, end: { x: W - 40, y: y + 10 }, thickness: 0.5 });
  drawRow(["Total", totals.reports, totals.connected, totals.notInterested, totals.followUpsSet, totals.followUpsDone, totals.followUpsOpen, totals.overdue], bold);
  return { bytes: await doc.save(), totals, agentCount: agents.length };
}

/** Builds the month's PDF and saves it into "Daily Call Exports". */
export async function saveMonthlySummaryToDrive(month: string, actorLabel: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Month must be YYYY-MM");
  const { bytes, totals, agentCount } = await buildMonthlySummaryPdf(month);
  const folderId = await getOrCreateDriveFolder(MONTHLY_FOLDER_NAME);
  const name = `Winstone_CRM_Monthly_Summary_${month}.pdf`;
  const existing = await driveFetch<{ files?: { id: string }[] }>(
    `/files?q=${encodeURIComponent(`name='${name}' and '${folderId}' in parents and trashed=false`)}&fields=files(id)`,
  );
  for (const f of existing?.files ?? []) {
    await driveFetch(`/files/${f.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ trashed: true }),
    });
  }
  const file = await uploadToDrive({ name, mimeType: "application/pdf", bytes, folderId });
  const { logAudit } = await import("@/lib/audit.server");
  await logAudit({
    action: "monthly_summary_saved",
    entityType: "monthly_summary",
    entityId: month,
    actorLabel,
    metadata: { file_id: file.id, link: file.webViewLink ?? null, agents: agentCount, ...totals },
  });
  return { month, fileId: file.id, link: file.webViewLink ?? null, totals };
}
