import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Token = z.object({ adminToken: z.string().nullable().optional() });

async function authority(token: string | null | undefined) {
  const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
  const caller = await resolveCaller(token ?? null);
  requireAuthority(caller);
  return caller;
}

/** HQ/IT: recent issues, newest first. */
export const listRuntimeIssues = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Token.extend({ days: z.number().int().min(1).max(90).default(14) }).parse(i))
  .handler(async ({ data }) => {
    await authority(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    const { data: rows, error } = await supabaseAdmin
      .from("runtime_error_issues")
      .select("id, source, kind, message, routes, occurrences, first_seen, last_seen, status, resolved_at, resolved_by, resolution_note, reopened_count")
      .gte("last_seen", since)
      .order("last_seen", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/** Lightweight poll for the alert watcher. */
export const runtimeAlertSummary = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Token.parse(i))
  .handler(async ({ data }) => {
    await authority(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("runtime_error_issues")
      .select("id, kind, message, source, last_seen, occurrences")
      .eq("status", "open")
      .order("last_seen", { ascending: false })
      .limit(20);
    return rows ?? [];
  });

export const listRuntimeOccurrences = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Token.extend({ issueId: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    await authority(data.adminToken);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("runtime_error_occurrences")
      .select("id, route, detail, browser, occurred_at")
      .eq("issue_id", data.issueId)
      .order("occurred_at", { ascending: false })
      .limit(50);
    return rows ?? [];
  });

export const setRuntimeIssueStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    Token.extend({
      issueId: z.string().uuid(),
      status: z.enum(["open", "resolved"]),
      note: z.string().max(500).optional(),
    }).parse(i),
  )
  .handler(async ({ data }) => {
    const caller = await authority(data.adminToken);
    const { requireWrite } = await import("@/lib/access.server");
    requireWrite(caller);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const who = caller.label ?? (caller.userId ? `user:${caller.userId}` : "HQ/IT");
    const patch =
      data.status === "resolved"
        ? { status: "resolved", resolved_at: new Date().toISOString(), resolved_by: who, resolution_note: data.note ?? null }
        : { status: "open", resolved_at: null, resolved_by: null, resolution_note: null };
    const { error } = await supabaseAdmin.from("runtime_error_issues").update(patch).eq("id", data.issueId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Manual "check now" for the deployment health of the live site. */
export const runHealthCheckNow = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Token.parse(i))
  .handler(async ({ data }) => {
    const caller = await authority(data.adminToken);
    const { requireWrite } = await import("@/lib/access.server");
    requireWrite(caller);
    const { runDeploymentHealthCheck } = await import("@/lib/runtime-errors.server");
    return runDeploymentHealthCheck("https://crm.winstonebd.com");
  });
