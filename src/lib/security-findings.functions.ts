import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Token = z.string().max(4096).nullable().optional();

async function authority(token: string | null | undefined, write = false) {
  const { resolveCaller } = await import("@/lib/access.server");
  const c = await resolveCaller(token ?? null);
  if (c.scope !== "authority") throw new Error("Only HQ / IT admins can manage security findings");
  if (write && c.readOnly) throw new Error("This HQ viewing session is read-only; sign in through the IT Console to record findings");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const label = c.profile?.name || c.profile?.email || c.label || "HQ / IT admin (PIN session)";
  return { db: supabaseAdmin, label };
}

export const listSecurityFindings = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i))
  .handler(async ({ data }) => {
    const { db } = await authority(data.adminToken);
    const [r, f] = await Promise.all([
      db.from("security_scan_reports").select("*").order("scanned_at", { ascending: false }).limit(100),
      db.from("security_findings").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    if (r.error) throw new Error(r.error.message);
    if (f.error) throw new Error(f.error.message);
    return { reports: r.data ?? [], findings: f.data ?? [] };
  });

const Finding = z.object({
  finding_key: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(300),
  level: z.enum(["error", "warn", "info"]),
});

export const addScanReport = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({
      adminToken: Token,
      scanner: z.string().trim().min(1).max(80),
      scanned_at: z.string().datetime({ offset: true }),
      status: z.enum(["complete", "incomplete", "failed"]),
      notes: z.string().max(2000).optional(),
      findings: z.array(Finding).max(200),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const { db, label } = await authority(data.adminToken, true);
    const { data: rep, error } = await db.from("security_scan_reports")
      .insert({ scanner: data.scanner, scanned_at: data.scanned_at, status: data.status, notes: data.notes || null, entered_by: label })
      .select("id").single();
    if (error) throw new Error(error.message);
    let newCount = 0;
    if (data.findings.length) {
      const keys = data.findings.map((f) => f.finding_key);
      const { data: seen } = await db.from("security_findings").select("finding_key").in("finding_key", keys);
      const known = new Set((seen ?? []).map((s) => s.finding_key));
      const rows = data.findings.map((f) => {
        const is_new = !known.has(f.finding_key);
        known.add(f.finding_key); // a repeat inside the same report is not new either
        return { ...f, report_id: rep.id, entered_by: label, is_new };
      });
      newCount = rows.filter((r) => r.is_new).length;
      const ins = await db.from("security_findings").insert(rows);
      if (ins.error) throw new Error(ins.error.message);
    }
    return { id: rep.id, newCount };
  });

export const updateFinding = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ adminToken: Token, id: z.string().uuid(), status: z.enum(["open", "fixed", "ignored"]).optional(), acknowledge: z.boolean().optional() }).parse(i),
  )
  .handler(async ({ data }) => {
    const { db } = await authority(data.adminToken, true);
    const patch: { status?: string; is_new?: boolean } = {};
    if (data.status) patch.status = data.status;
    if (data.acknowledge) patch.is_new = false;
    const { error } = await db.from("security_findings").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
