// Server-only: reads HQ edits from the Daily report Google Sheet and turns them
// into proposals that HQ confirms in the CRM. Nothing is written to a lead,
// booking or payment until an HQ/IT user approves the proposal.
// Accepted sheet edits: Stage (E), HQ note (L), HQ payment USD (M), and new
// rows with Lead + Phone but no Lead ID (new leads land unassigned).
const STAGES = ["enquiry", "proposal", "offer", "booking", "close"] as const;
type Stage = (typeof STAGES)[number];

export type SheetEdit =
  | { kind: "stage"; leadId: string; value: Stage }
  | { kind: "note"; leadId: string; value: string }
  | { kind: "payment"; leadId: string; value: number }
  | { kind: "new_lead"; name: string; phone: string };

/** Pure: parse sheet rows (header first) into HQ edits. */
export function parseSheetEdits(values: string[][]): SheetEdit[] {
  const out: SheetEdit[] = [];
  for (const r of values.slice(1)) {
    const cell = (i: number) => String(r[i] ?? "").trim();
    const leadId = cell(13);
    if (/^[0-9a-f-]{36}$/i.test(leadId)) {
      const st = cell(4).toLowerCase();
      if ((STAGES as readonly string[]).includes(st)) out.push({ kind: "stage", leadId, value: st as Stage });
      const note = cell(11).slice(0, 500);
      if (note) out.push({ kind: "note", leadId, value: note });
      const pay = cell(12).replace(/[$,\s]/g, "");
      if (pay && /^\d+(\.\d{1,2})?$/.test(pay) && Number(pay) > 0) out.push({ kind: "payment", leadId, value: Number(pay) });
    } else if (!leadId && cell(0) && /\d{10,}/.test(cell(1).replace(/\D/g, ""))) {
      out.push({ kind: "new_lead", name: cell(0).slice(0, 120), phone: cell(1).slice(0, 30) });
    }
  }
  return out;
}

async function db() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** Store new proposals (deduped). Stage edits equal to the CRM value are ignored. */
export async function recordProposals(date: string, edits: SheetEdit[]) {
  const d = await db();
  const ids = [...new Set(edits.flatMap((e) => ("leadId" in e ? [e.leadId] : [])))];
  const stages = new Map(((ids.length ? (await d.from("leads").select("id, pipeline_stage").in("id", ids)).data : []) ?? []).map((l) => [l.id, String(l.pipeline_stage)]));
  let created = 0;
  for (const e of edits) {
    if ("leadId" in e && !stages.has(e.leadId)) continue;
    if (e.kind === "stage" && stages.get(e.leadId) === e.value) continue;
    const key = e.kind === "new_lead" ? `${e.phone.replace(/\D/g, "")}` : `${e.leadId}|${e.value}`;
    const { error } = await d.from("sheet_change_proposals").insert({
      sheet_date: date, kind: e.kind, lead_id: "leadId" in e ? e.leadId : null,
      proposed: e as never, current_value: e.kind === "stage" ? stages.get(e.leadId) ?? null : null,
      fingerprint: `${date}|${e.kind}|${key}`,
    });
    if (!error) created++;
    else if (error.code !== "23505") throw new Error(error.message);
  }
  return created;
}

export async function listProposals(status: "pending" | "all" = "pending") {
  const d = await db();
  let q = d.from("sheet_change_proposals").select("id, sheet_date, kind, lead_id, proposed, current_value, status, decided_at, result_note, created_at").order("created_at", { ascending: false }).limit(200);
  if (status === "pending") q = q.eq("status", "pending");
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const ids = [...new Set((data ?? []).map((r) => r.lead_id).filter(Boolean))] as string[];
  const names = new Map(((ids.length ? (await d.from("leads").select("id, name").in("id", ids)).data : []) ?? []).map((l) => [l.id, l.name]));
  return (data ?? []).map((r) => ({ ...r, lead_name: r.lead_id ? names.get(r.lead_id) ?? null : null }));
}

export async function decideProposal(id: string, approve: boolean, by: string) {
  const d = await db();
  const { data: p, error } = await d.from("sheet_change_proposals").select("*").eq("id", id).eq("status", "pending").maybeSingle();
  if (error) throw new Error(error.message);
  if (!p) throw new Error("This change was already handled");
  const finish = async (status: "applied" | "rejected", note: string | null) => {
    const { data: done, error: fe } = await d.from("sheet_change_proposals").update({ status, decided_by: by, decided_at: new Date().toISOString(), result_note: note })
      .eq("id", id).eq("status", "pending").select("id").maybeSingle();
    if (fe) throw new Error(fe.message);
    if (!done) throw new Error("This change was already handled");
    return { status, note };
  };
  if (!approve) return finish("rejected", null);
  const e = p.proposed as unknown as SheetEdit;
  if (e.kind === "stage") {
    const { error: u } = await d.from("leads").update({ pipeline_stage: e.value }).eq("id", e.leadId);
    if (u) throw new Error(u.message);
    await d.from("lead_events").insert({ lead_id: e.leadId, kind: "pipeline_stage_changed", detail: `HQ sheet: ${p.current_value ?? "?"} → ${e.value}` });
  } else if (e.kind === "note") {
    const { data: l } = await d.from("leads").select("notes").eq("id", e.leadId).maybeSingle();
    const line = `[HQ ${p.sheet_date}] ${e.value}`;
    const { error: u } = await d.from("leads").update({ notes: l?.notes ? `${l.notes}\n${line}` : line }).eq("id", e.leadId);
    if (u) throw new Error(u.message);
    await d.from("lead_events").insert({ lead_id: e.leadId, kind: "hq_note_added", detail: line.slice(0, 300) });
  } else if (e.kind === "payment") {
    const { data: l } = await d.from("leads").select("assigned_to, area").eq("id", e.leadId).maybeSingle();
    const { error: b } = await d.from("bookings").insert({
      lead_id: e.leadId, agent_id: l?.assigned_to ?? null, area: l?.area ?? null, amount_usd: e.value,
      approval_status: "pending", created_by: `daily_sheet:${by}`, notes: `From Daily report sheet ${p.sheet_date}`,
    } as never);
    if (b) throw new Error(b.message);
    await d.from("lead_events").insert({ lead_id: e.leadId, kind: "sheet_payment_pending", detail: `USD ${e.value} awaiting HQ approval` });
  } else {
    const { data: st } = await d.rpc("lead_phone_status", { _raw: e.phone });
    const row = Array.isArray(st) ? st[0] : null;
    if (!row?.canonical_phones?.length) return finish("rejected", "Phone number is not a valid Bangladesh number");
    if (row.existing_lead_id) return finish("rejected", "A lead with this phone already exists");
    const { error: i } = await d.from("leads").insert({ name: e.name, phone_number: row.canonical_phones[0], source: "daily_sheet" } as never);
    if (i) throw new Error(i.message);
  }
  return finish("applied", null);
}
