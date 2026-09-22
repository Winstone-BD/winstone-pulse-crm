import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Floor lock for the performance review notice.
 *
 * Everyone signed in sees a blocking review board until `openAt`. After that
 * the floor opens for everyone except the employee IDs listed in `restricted`,
 * who stay locked out until HQ approves them one by one.
 */

const SETTINGS_KEY = "performance_review_lock";

const StateSchema = z.object({
  enabled: z.boolean().default(true),
  /** Dhaka 9:30 AM, 23 September 2026 = 03:30 UTC. */
  openAt: z.string().default("2026-09-23T03:30:00.000Z"),
  restricted: z.array(z.string()).default(["WIN2606"]),
  approved: z.array(z.string()).default([]),
});

export type FloorLockState = z.infer<typeof StateSchema>;

async function readState(): Promise<FloorLockState> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("system_settings")
    .select("value")
    .eq("key", SETTINGS_KEY)
    .maybeSingle();
  const parsed = StateSchema.safeParse(data?.value ?? {});
  return parsed.success ? parsed.data : StateSchema.parse({});
}

async function writeState(next: FloorLockState) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("system_settings")
    .upsert({ key: SETTINGS_KEY, value: next, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

/** What this device must show: the blocking board, the red HQ notice, or nothing. */
export const getFloorLock = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    const state = await readState();

    const beforeOpen = state.enabled && Date.now() < new Date(state.openAt).getTime();
    const employeeId = caller.profile?.employee_id ?? null;
    const isRestricted =
      state.enabled &&
      employeeId !== null &&
      state.restricted.includes(employeeId) &&
      !state.approved.includes(employeeId);

    return {
      scope: caller.scope,
      openAt: state.openAt,
      /** True until the floor opens — the notice covers the whole screen. */
      reviewOpen: beforeOpen && caller.scope !== "none",
      /** True when this account still needs HQ approval to use the CRM. */
      hqApprovalRequired: !beforeOpen && isRestricted,
      /** HQ can dismiss the board; agents and coordinators cannot. */
      canDismiss: caller.scope === "authority",
      me: caller.profile ? { name: caller.profile.name, employeeId } : null,
    };
  });

/** HQ board: who is locked out and who has been cleared. */
export const floorLockAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    requireAuthority(await resolveCaller(data.adminToken ?? null));
    return readState();
  });

/** HQ approval / revoke for a restricted employee, plus the master switch. */
export const setFloorLock = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        adminToken: z.string().nullable().optional(),
        action: z.enum(["approve", "revoke", "restrict", "unrestrict", "disable", "enable"]),
        employeeId: z.string().trim().max(32).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { resolveCaller, requireAuthority, requireWrite } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireAuthority(caller);
    requireWrite(caller);

    const state = await readState();
    const id = data.employeeId ?? "";
    const next: FloorLockState = { ...state };

    if (data.action === "approve" && id) {
      next.approved = [...new Set([...state.approved, id])];
    } else if (data.action === "revoke" && id) {
      next.approved = state.approved.filter((x) => x !== id);
    } else if (data.action === "restrict" && id) {
      next.restricted = [...new Set([...state.restricted, id])];
      next.approved = state.approved.filter((x) => x !== id);
    } else if (data.action === "unrestrict" && id) {
      next.restricted = state.restricted.filter((x) => x !== id);
    } else if (data.action === "disable") {
      next.enabled = false;
    } else if (data.action === "enable") {
      next.enabled = true;
    }

    await writeState(next);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "floor_lock_changed",
      entityType: "system_settings",
      metadata: { change: data.action, employeeId: id || null },

    });

    return next;
  });
