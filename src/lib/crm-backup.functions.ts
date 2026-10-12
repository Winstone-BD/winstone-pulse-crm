import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Token = z.object({ adminToken: z.string().nullable().optional() });
const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const Table = z.enum(["leads", "call_reports"]);

async function authority(adminToken?: string | null) {
  const { resolveCaller } = await import("@/lib/access.server");
  const c = await resolveCaller(adminToken ?? null);
  if (c.scope !== "authority") throw new Error("HQ / IT master PIN required");
  return c;
}
async function logAccess(action: string, detail: Record<string, unknown>) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("record_audit_log").insert({ table_name: "crm_backups", record_id: String(detail['date'] ?? "-"), action, changes: detail as never });
}

export const listCrmBackups = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Token.parse(i))
  .handler(async ({ data }) => {
    await authority(data.adminToken);
    const m = await import("@/lib/crm-backup.server");
    return { backups: await m.listBackups() };
  });

export const runCrmBackupNow = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Token.parse(i))
  .handler(async ({ data }) => {
    await authority(data.adminToken);
    const m = await import("@/lib/crm-backup.server");
    const r = await m.runBackup();
    await logAccess("backup_created", { date: r.date, manual: true });
    return r;
  });

export const downloadCrmBackup = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Token.extend({ date: DateStr }).parse(i))
  .handler(async ({ data }) => {
    await authority(data.adminToken);
    const m = await import("@/lib/crm-backup.server");
    const url = await m.signedDownload(data.date);
    await logAccess("backup_downloaded", { date: data.date });
    return { url };
  });

export const diffCrmRecord = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Token.extend({ date: DateStr, table: Table, id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await authority(data.adminToken);
    const m = await import("@/lib/crm-backup.server");
    return m.diffRecord(data.date, data.table, data.id);
  });

export const restoreCrmRecord = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    Token.extend({ date: DateStr, table: Table, id: z.string().uuid(), fields: z.array(z.string().max(64)).min(1).max(40) }).parse(i))
  .handler(async ({ data }) => {
    const c = await authority(data.adminToken);
    const m = await import("@/lib/crm-backup.server");
    return m.restoreFields(data.date, data.table, data.id, data.fields, c.label ?? c.profile?.name ?? "HQ");
  });

const AuditQuery = Token.extend({
  from: DateStr, to: DateStr,
  table: z.string().max(40).nullable().optional(),
  action: z.enum(["created", "edited", "archived", "restored"]).nullable().optional(),
  actorId: z.string().uuid().nullable().optional(),
  recordId: z.string().max(80).nullable().optional(),
  page: z.number().int().min(0).max(500).default(0),
});

/** Authority sees everything; a signed-in staff member sees only changes they made. */
export const listRecordAudit = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => AuditQuery.parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.adminToken ?? null);
    if (c.scope === "none") throw new Error("Sign in required");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("record_audit_log").select("id,at,actor_id,table_name,record_id,action,changes")
      .gte("at", `${data.from}T00:00:00+06:00`).lte("at", `${data.to}T23:59:59.999+06:00`)
      .order("at", { ascending: false }).range(data.page * 100, data.page * 100 + 99);
    if (c.scope !== "authority") q = q.eq("actor_id", c.userId ?? "00000000-0000-0000-0000-000000000000");
    else if (data.actorId) q = q.eq("actor_id", data.actorId);
    if (data.table) q = q.eq("table_name", data.table);
    if (data.action) q = q.eq("action", data.action);
    if (data.recordId) q = q.eq("record_id", data.recordId);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const { data: people } = await supabaseAdmin.from("profiles").select("user_id,name");
    const names: Record<string, string> = {};
    for (const p of people ?? []) if (p.user_id) names[p.user_id] = p.name ?? "";
    return { rows: rows ?? [], names, full: c.scope === "authority" };
  });
