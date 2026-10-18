import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AgentActivityRow = {
  profileId: string;
  name: string;
  employeeId: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  isActive: boolean;
  approved: boolean;
  hasAccount: boolean;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  linkIssuedAt: string | null;
  pendingReports: number;
  overdueFollowUps: number;
  androidSignedIn: boolean;
  androidLastSeenAt: string | null;
  androidVersion: string | null;
};

const DONE = new Set(["done", "completed", "cancelled", "canceled", "rescheduled"]);

/**
 * Staff-only (authority) roster for onboarding + activity: last web login,
 * whether a reset is pending, pending backlog and Android sign-in. Read-only.
 */
export const listAgentActivity = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<{ rows: AgentActivityRow[]; generatedAt: string }> => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const nowIso = new Date().toISOString();

    const [profiles, users, reports, follows, devices, links] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, user_id, name, email, phone, employee_id, role, is_active, approval_status")
        .order("employee_id", { ascending: true }),
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000 }),
      supabaseAdmin.from("call_reports").select("agent_id").eq("status", "pending"),
      supabaseAdmin.from("active_follow_up_events").select("agent_id, status").lt("scheduled_at", nowIso),
      supabaseAdmin
        .from("agent_devices")
        .select("profile_id, last_seen_at, app_version, revoked_at")
        .is("revoked_at", null),
      supabaseAdmin
        .from("audit_logs")
        .select("entity_id, created_at")
        .eq("action", "agent_password_reset_link_issued")
        .order("created_at", { ascending: false })
        .limit(500),
    ]);
    if (profiles.error) throw new Error(profiles.error.message);

    const userById = new Map((users.data?.users ?? []).map((u) => [u.id, u]));
    const count = (rows: { agent_id: string | null }[] | null) => {
      const m = new Map<string, number>();
      for (const r of rows ?? []) if (r.agent_id) m.set(r.agent_id, (m.get(r.agent_id) ?? 0) + 1);
      return m;
    };
    const pending = count(reports.data);
    const overdue = count((follows.data ?? []).filter((f) => !DONE.has(String(f.status ?? ""))));
    const device = new Map<string, { last_seen_at: string | null; app_version: string | null }>();
    for (const d of devices.data ?? []) {
      const prev = device.get(d.profile_id);
      if (!prev || (d.last_seen_at ?? "") > (prev.last_seen_at ?? "")) device.set(d.profile_id, d);
    }
    const link = new Map<string, string>();
    for (const l of links.data ?? []) if (l.entity_id && !link.has(l.entity_id)) link.set(l.entity_id, l.created_at);

    const rows = (profiles.data ?? []).map((p): AgentActivityRow => {
      const u = p.user_id ? userById.get(p.user_id) : undefined;
      const d = device.get(p.id);
      return {
        profileId: p.id,
        name: p.name,
        employeeId: p.employee_id,
        email: u?.email ?? p.email,
        phone: p.phone,
        role: p.role,
        isActive: Boolean(p.is_active),
        approved: p.approval_status === "approved",
        hasAccount: Boolean(u),
        lastLoginAt: u?.last_sign_in_at ?? null,
        mustChangePassword: (u?.app_metadata as Record<string, unknown> | undefined)?.["must_change_password"] === true,
        linkIssuedAt: link.get(p.id) ?? null,
        pendingReports: pending.get(p.id) ?? 0,
        overdueFollowUps: overdue.get(p.id) ?? 0,
        androidSignedIn: Boolean(d),
        androidLastSeenAt: d?.last_seen_at ?? null,
        androidVersion: d?.app_version ?? null,
      };
    });
    return { rows, generatedAt: nowIso };
  });
