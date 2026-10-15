import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ adminToken: z.string().nullable().optional() });

async function itCaller(token: string | null | undefined, write: boolean) {
  const { resolveCaller, requireAuthority, requireWrite } = await import("@/lib/access.server");
  const caller = await resolveCaller(token ?? null, { skipMaintenance: true });
  requireAuthority(caller);
  if (write) requireWrite(caller);
  return caller;
}

/** Last 7 days of failed Android sign-ins and lockouts (never passwords). */
export const getLoginFailures = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => tokenSchema.parse(i ?? {}))
  .handler(async ({ data }) => {
    await itCaller(data.adminToken, false);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: rows } = await supabaseAdmin
      .from("audit_logs")
      .select("id, action, metadata, created_at")
      .in("action", ["agent_login_failed", "agent_login_locked"])
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(300);
    const list = (rows ?? []).map((r) => {
      const m = (r.metadata ?? {}) as Record<string, string | null>;
      return {
        id: r.id,
        at: r.created_at,
        locked: r.action === "agent_login_locked",
        reason: m["reason"] ?? null,
        identifier: m["identifier"] ?? null,
        source: m["source"] ?? null,
        device: m["device"] ?? null,
      };
    });
    const bySource: Record<string, { failed: number; locked: number; last: string }> = {};
    for (const r of list) {
      const k = r.source ?? "unknown";
      const s = (bySource[k] ??= { failed: 0, locked: 0, last: r.at });
      if (r.locked) s.locked += 1;
      else s.failed += 1;
    }
    return { rows: list, sources: Object.entries(bySource).map(([source, s]) => ({ source, ...s })) };
  });

export const saveMonthlySummary = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    tokenSchema.extend({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).optional() }).parse(i ?? {}),
  )
  .handler(async ({ data }) => {
    const caller = await itCaller(data.adminToken, true);
    const { saveMonthlySummaryToDrive, previousDhakaMonth } = await import("@/lib/monthly-summary.server");
    return saveMonthlySummaryToDrive(data.month ?? previousDhakaMonth(), caller.label ?? caller.profile?.name ?? "IT Console");
  });

/** Live check: project photos must never be downloadable without the CRM (public bucket or storage rule). */
export const getProjectPhotoExposure = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => tokenSchema.parse(i ?? {}))
  .handler(async ({ data }) => {
    await itCaller(data.adminToken, false);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("project_photos_exposure");
    if (error) throw new Error("Could not check project photo access");
    const r = rows?.[0];
    const bucketPublic = Boolean(r?.bucket_public);
    const policies = r?.policy_names ?? [];
    return { exposed: bucketPublic || policies.length > 0, bucketPublic, policies, checkedAt: new Date().toISOString() };
  });
