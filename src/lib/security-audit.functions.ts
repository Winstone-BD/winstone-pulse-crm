import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Security-sensitive actions already written to the append-only audit_logs table. */
export const SECURITY_ACTIONS = {
  access: ["it_account_signed_in", "coordinator_pin_unlocked", "coordinator_pin_failed", "agent_login_failed", "agent_login_locked"],
  accounts: ["account_approved", "account_rejected", "role_changed", "agent_account_created", "agent_account_updated", "agent_password_reset_link_issued"],
  devices: ["device_registered", "device_revoked", "agent_sim_bound", "agent_sim_verified", "push_token_registered"],
  pins: ["pin_rotated", "pin_revealed", "floor_lock_changed"],
  billing: ["service_payment_verified", "unlock_approved", "unlock_denied", "system_locked", "system_relocked"],
  data: ["migration_export", "drive_settings_updated", "support_settings_updated", "daily_quota_changed", "extra_leads_granted"],
} as const;
export type SecurityGroup = keyof typeof SECURITY_ACTIONS;
const ALL = Object.values(SECURITY_ACTIONS).flat() as string[];

const Query = z.object({
  adminToken: z.string().max(4096).nullable().optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  group: z.enum(["access", "accounts", "devices", "pins", "billing", "data"]).nullable().optional(),
  page: z.number().int().min(0).max(1000).default(0),
});

/** HQ/IT (authority scope) only — everyone else is refused server-side. */
export const listSecurityAudit = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Query.parse(i))
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const c = await resolveCaller(data.adminToken ?? null);
    if (c.scope !== "authority") throw new Error("Only HQ / IT admins can view the security log");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const actions = data.group ? [...SECURITY_ACTIONS[data.group]] : ALL;
    const { data: rows, error } = await supabaseAdmin
      .from("audit_logs")
      .select("id,created_at,actor_label,action,entity_type,entity_id,metadata")
      .in("action", actions)
      .gte("created_at", `${data.from}T00:00:00+06:00`)
      .lte("created_at", `${data.to}T23:59:59.999+06:00`)
      .order("created_at", { ascending: false })
      .range(data.page * 100, data.page * 100 + 99);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });
