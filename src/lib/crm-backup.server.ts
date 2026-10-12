import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const BACKUP_TABLES = ["leads", "call_reports", "follow_up_events", "bookings", "site_visits", "profiles"] as const;
export type BackupTable = (typeof BACKUP_TABLES)[number];
export const RESTORABLE = ["leads", "call_reports"] as const;
/** Never restored: identity, ownership/assignment (LeadHub only), provenance. */
export const RESTORE_EXCLUDED = new Set([
  "id", "created_at", "updated_at", "assigned_to", "assigned_agent_id", "assignment_source",
  "phone_number", "agent_id", "lead_id", "recording_id", "status", "submitted_at",
]);
const BUCKET = "crm-backups";
const KEEP_DAYS = 30;

export const dhakaDate = (d = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(d);

async function readAll(table: BackupTable) {
  const rows: Record<string, unknown>[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabaseAdmin.from(table).select("*").order("id").range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as Record<string, unknown>[]));
    if (!data || data.length < 1000) break;
  }
  if (table === "profiles") for (const r of rows) delete r['legal_name'];
  return rows;
}

async function gzip(text: string) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function gunzip(bytes: ArrayBuffer) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
  return new Response(stream).text();
}
const path = (date: string) => `${date}/crm-backup.json.gz`;

/** Idempotent per Dhaka date: an existing completed backup is kept. */
export async function runBackup(date = dhakaDate()) {
  const { data: existing } = await supabaseAdmin.from("crm_backup_runs").select("status").eq("backup_date", date).maybeSingle();
  if (existing?.status === "done") return { date, skipped: true };
  await supabaseAdmin.from("crm_backup_runs").upsert({ backup_date: date, status: "running", error: null }, { onConflict: "backup_date" });
  try {
    const payload: Record<string, unknown[]> = {};
    const counts: Record<string, number> = {};
    for (const t of BACKUP_TABLES) {
      payload[t] = await readAll(t);
      counts[t] = payload[t].length;
    }
    const bytes = await gzip(JSON.stringify({ date, created_at: new Date().toISOString(), tables: payload }));
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)))
      .map((b) => b.toString(16).padStart(2, "0")).join("");
    const up = await supabaseAdmin.storage.from(BUCKET).upload(path(date), bytes, { contentType: "application/gzip", upsert: true });
    if (up.error) throw new Error(up.error.message);
    await supabaseAdmin.from("crm_backup_runs").update({ status: "done", counts, size_bytes: bytes.byteLength, checksum: hash }).eq("backup_date", date);
    await prune();
    return { date, skipped: false, counts };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin.from("crm_backup_runs").update({ status: "failed", error: msg.slice(0, 500) }).eq("backup_date", date);
    throw e;
  }
}

async function prune() {
  const cutoff = dhakaDate(new Date(Date.now() - KEEP_DAYS * 86_400_000));
  const { data } = await supabaseAdmin.from("crm_backup_runs").select("backup_date").lt("backup_date", cutoff);
  const old = (data ?? []).map((r) => r.backup_date);
  if (!old.length) return;
  await supabaseAdmin.storage.from(BUCKET).remove(old.map(path));
  await supabaseAdmin.from("crm_backup_runs").update({ status: "expired" }).in("backup_date", old);
}

export async function listBackups() {
  const { data, error } = await supabaseAdmin.from("crm_backup_runs")
    .select("backup_date,created_at,status,counts,size_bytes,checksum,error")
    .neq("status", "expired").order("backup_date", { ascending: false }).limit(40);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function signedDownload(date: string) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path(date), 300, { download: true });
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

async function loadBackup(date: string) {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(path(date));
  if (error) throw new Error(error.message);
  return JSON.parse(await gunzip(await data.arrayBuffer())) as { tables: Record<string, Record<string, unknown>[]> };
}

export async function diffRecord(date: string, table: (typeof RESTORABLE)[number], id: string) {
  const backup = await loadBackup(date);
  const old = backup.tables[table]?.find((r) => String(r['id']) === id) ?? null;
  const { data: current } = await supabaseAdmin.from(table).select("*").eq("id", id).maybeSingle();
  const fields: { field: string; backup: string; current: string; restorable: boolean }[] = [];
  if (old && current) {
    for (const k of Object.keys(old)) {
      const cur = (current as Record<string, unknown>)[k];
      if (JSON.stringify(old[k]) !== JSON.stringify(cur)) fields.push({ field: k, backup: JSON.stringify(old[k] ?? null), current: JSON.stringify(cur ?? null), restorable: !RESTORE_EXCLUDED.has(k) });
    }
  }
  return { found: !!old, exists: !!current, fields };
}

export async function restoreFields(date: string, table: (typeof RESTORABLE)[number], id: string, fields: string[], actor: string) {
  const backup = await loadBackup(date);
  const old = backup.tables[table]?.find((r) => String(r['id']) === id);
  if (!old) throw new Error("Record not found in that backup");
  const patch: Record<string, unknown> = {};
  for (const f of fields) {
    if (RESTORE_EXCLUDED.has(f) || !(f in old)) throw new Error(`Field cannot be restored: ${f}`);
    patch[f] = old[f];
  }
  if (!Object.keys(patch).length) throw new Error("Choose at least one field");
  // Normal update: every existing validation trigger still applies.
  const { error } = await supabaseAdmin.from(table).update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);
  await supabaseAdmin.from("record_audit_log").insert({
    table_name: table, record_id: id, action: "restored",
    changes: { backup_date: date, fields, by: actor } as never,
  });
  return { restored: Object.keys(patch) };
}
