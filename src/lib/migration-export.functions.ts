import { createServerFn } from "@tanstack/react-start";

/**
 * READ-ONLY Migration Export Center (CRM1 → CRM2). Every handler here only
 * SELECTs. Restricted to IT Console / admin (authority scope, not the
 * read-only Executive HQ session). Credential-like columns are stripped.
 */

export const SOURCE_PROJECT_ID = "990267f3-4198-4d83-ae21-7d9c802617f4";
export const TARGET_PROJECT_ID = "6adbf9ce-bed0-4875-bf01-7b2bad505eb4";

export const EXPORT_TABLES = [
  "profiles",
  "user_roles",
  "leads",
  "lead_assignments",
  "lead_events",
  "lead_classifications",
  "lead_extra_grants",
  "lead_distribution_runs",
  "lead_year_archives",
  "call_reports",
  "call_recordings",
  "follow_up_events",
  "whatsapp_interactions",
  "audit_logs",
  "consent_records",
  "do_not_contact",
  "agent_devices",
  "call_processing_jobs",
  "ai_voice_sessions",
  "ai_voice_turns",
  "shift_summaries",
  "sync_events",
  "webhook_deliveries",
  "system_alerts",
  "custom_reports",
  "agent_accountability_reviews",
  "inventory_requirements",
  "team_support_tickets",
  "team_support_replies",
  "support_tickets",
  "support_ticket_events",
  "doc_pages",
] as const;
export type ExportTable = (typeof EXPORT_TABLES)[number];

const SECRET_COLUMN = /(pin_hash|token|secret|cipher|password|api_key|private_key)/i;
const PROFILE_IDENTITY =
  "id,user_id,name,phone,email,employee_id,role,requested_role,approval_status,is_active,status,sim_number,sim_bound_at,created_at";
export const CHUNK_SIZE = 1000;

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_COLUMN.test(k) ? "[redacted]" : scrub(v);
    }
    return out;
  }
  return value;
}

async function gate(adminToken: string | null | undefined) {
  const { resolveCaller, requireAuthority, requireWrite } = await import("./access.server");
  const caller = await resolveCaller(adminToken ?? null);
  requireAuthority(caller);
  requireWrite(caller); // excludes the read-only Executive HQ session: IT/admin only
  return caller;
}

export const getExportCounts = createServerFn({ method: "POST" })
  .inputValidator((input: { adminToken?: string | null }) => input)
  .handler(async ({ data }) => {
    const caller = await gate(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const counts: Record<string, number | null> = {};
    await Promise.all(
      EXPORT_TABLES.map(async (t) => {
        const { count, error } = await supabaseAdmin
          .from(t as never)
          .select("*", { count: "exact", head: true });
        counts[t] = error ? null : (count ?? 0);
      }),
    );
    const { logAudit } = await import("./audit.server");
    await logAudit({
      action: "migration_export",
      entityType: "migration",
      actorProfileId: caller.profile?.id ?? null,
      actorLabel: caller.label ?? "IT Console",
      metadata: { target: TARGET_PROJECT_ID, step: "counts" },
    });
    return { counts, exportedAt: new Date().toISOString() };
  });

export const exportTableChunk = createServerFn({ method: "POST" })
  .inputValidator(
    (input: { adminToken?: string | null; table: string; afterId?: string | null }) => {
      if (!(EXPORT_TABLES as readonly string[]).includes(input.table)) throw new Error("Unknown table");
      return input as { adminToken?: string | null; table: ExportTable; afterId?: string | null };
    },
  )
  .handler(async ({ data }) => {
    await gate(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from(data.table as never)
      .select(data.table === "profiles" ? PROFILE_IDENTITY : "*")
      .order("id", { ascending: true })
      .limit(CHUNK_SIZE);
    if (data.afterId) q = q.gt("id", data.afterId);
    const { data: rows, error } = await q;
    if (error) throw new Error(`${data.table}: ${error.message}`);
    const list = (rows ?? []) as unknown as Array<Record<string, unknown>>;
    const clean = list.map((r) => scrub(r) as Record<string, unknown>);
    const last = list.length ? String(list[list.length - 1]!.id) : null;
    return { rows: clean, nextAfterId: list.length === CHUNK_SIZE ? last : null };
  });
