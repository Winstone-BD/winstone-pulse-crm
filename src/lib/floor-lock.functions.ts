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

/**
 * A batch of leads held back for a locked desk. Nothing moves while the account
 * waits for HQ; the clock only starts when HQ unlocks it, and the leads land
 * `delayMinutes` later. Until then they stay in the head database.
 */
const PendingGrantSchema = z.object({
  employeeId: z.string(),
  quantity: z.number().int().min(1).max(500),
  delayMinutes: z.number().int().min(1).max(1440).default(10),
  /** Set when HQ approves — the moment the leads become due. */
  releaseAt: z.string().nullable().default(null),
  deliveredAt: z.string().nullable().default(null),
  delivered: z.number().int().default(0),
});

const StateSchema = z.object({
  enabled: z.boolean().default(true),
  /** Dhaka 9:45 AM, 23 September 2026 = 03:45 UTC. */
  openAt: z.string().default("2026-09-23T03:45:00.000Z"),
  restricted: z.array(z.string()).default(["WIN2606"]),
  approved: z.array(z.string()).default([]),
  /** Elias's held batch: 40 leads, released 10 minutes after HQ approval. */
  pendingGrants: z
    .array(PendingGrantSchema)
    .default([
      { employeeId: "WIN2606", quantity: 40, delayMinutes: 10, releaseAt: null, deliveredAt: null, delivered: 0 },
    ]),
});

export type FloorLockState = z.infer<typeof StateSchema>;
export type PendingGrant = z.infer<typeof PendingGrantSchema>;

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

/**
 * Hands over any batch whose delay has run out. Called on every floor-lock read,
 * so the leads arrive on their own once the ten minutes pass — nobody has to
 * press anything. Safe to call repeatedly: a delivered batch is never redone.
 */
async function releaseDueGrants(state: FloorLockState): Promise<FloorLockState> {
  const due = state.pendingGrants.filter(
    (grant) => !grant.deliveredAt && grant.releaseAt && Date.now() >= new Date(grant.releaseAt).getTime(),
  );
  if (due.length === 0) return state;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { grantExtraLeads } = await import("@/lib/lead-pool.server");
  const next: FloorLockState = { ...state, pendingGrants: [...state.pendingGrants] };

  for (const grant of due) {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, name")
      .eq("employee_id", grant.employeeId)
      .maybeSingle();
    if (!profile) continue;
    try {
      const result = await grantExtraLeads({
        agentProfileId: profile.id,
        quantity: grant.quantity,
        reason: `হেড কোয়ার্টার অনুমোদনের ${grant.delayMinutes} মিনিট পর স্বয়ংক্রিয় লিড`,
        actorLabel: "Executive HQ (auto)",
      });
      const index = next.pendingGrants.findIndex((row) => row.employeeId === grant.employeeId);
      if (index >= 0) {
        next.pendingGrants[index] = {
          ...grant,
          deliveredAt: new Date().toISOString(),
          delivered: result.moved,
        };
      }
    } catch {
      // Empty database or a transient failure: leave it due and retry next poll.
    }
  }

  if (next.pendingGrants.some((grant, i) => grant !== state.pendingGrants[i])) await writeState(next);
  return next;
}

/** What this device must show: the blocking board, the red HQ notice, or nothing. */
export const getFloorLock = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    const state = await releaseDueGrants(await readState());

    const beforeOpen = state.enabled && Date.now() < new Date(state.openAt).getTime();
    const employeeId = caller.profile?.employee_id ?? null;
    const isRestricted =
      state.enabled &&
      employeeId !== null &&
      state.restricted.includes(employeeId) &&
      !state.approved.includes(employeeId);
    const myGrant = employeeId
      ? (state.pendingGrants.find((grant) => grant.employeeId === employeeId) ?? null)
      : null;

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
      /** This desk's held-back lead batch, if any. */
      myGrant: myGrant
        ? {
            quantity: myGrant.quantity,
            delayMinutes: myGrant.delayMinutes,
            releaseAt: myGrant.releaseAt,
            deliveredAt: myGrant.deliveredAt,
            delivered: myGrant.delivered,
          }
        : null,
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
      // Unlocking starts the clock on this desk's held-back leads.
      next.pendingGrants = state.pendingGrants.map((grant) =>
        grant.employeeId === id && !grant.releaseAt && !grant.deliveredAt
          ? { ...grant, releaseAt: new Date(Date.now() + grant.delayMinutes * 60_000).toISOString() }
          : grant,
      );
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
