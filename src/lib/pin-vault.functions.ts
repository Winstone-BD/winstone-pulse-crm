import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Surface = z.enum(["master", "it_console", "leadhub"]);

/** Vault status + rotation history. Full IT Console session required. */
export const getPinVault = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ adminToken: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { adminTokenScope } = await import("@/lib/admin-gate.server");
    // HQ/LeadHub/expired tokens: no vault, and no page crash.
    if (adminTokenScope(data.adminToken) !== "full") return null;
    const { vaultOverview } = await import("@/lib/pin-vault.server");
    return vaultOverview();
  });

/** Reveals one stored PIN. Logged every time, so reveals stay accountable. */
export const revealPinValue = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().min(1), surface: Surface }).parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdminToken } = await import("@/lib/admin-gate.server");
    requireAdminToken(data.adminToken);
    const { revealVault } = await import("@/lib/pin-vault.server");
    const pin = await revealVault(data.surface);
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "pin_revealed",
      entityType: "pin_vault",
      entityId: data.surface,
      actorLabel: "IT Console",
      metadata: { surface: data.surface, found: Boolean(pin) },
    });
    return { pin };
  });

/** Stores or rotates a PIN. The new value takes effect for unlocks immediately. */
export const rotatePinValue = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        adminToken: z.string().min(1),
        surface: Surface,
        pin: z.string().min(4).max(32),
        reason: z.string().max(300).optional().nullable(),
        note: z.string().max(300).optional().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdminToken } = await import("@/lib/admin-gate.server");
    requireAdminToken(data.adminToken);
    const { rotateVault } = await import("@/lib/pin-vault.server");
    const entry = await rotateVault({
      surface: data.surface,
      pin: data.pin,
      reason: data.reason ?? null,
      note: data.note ?? null,
      actorLabel: "IT Console",
    });
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "pin_rotated",
      entityType: "pin_vault",
      entityId: data.surface,
      actorLabel: "IT Console",
      metadata: { surface: data.surface, hint: entry.hint, reason: data.reason ?? null },
    });
    return { ok: true as const, entry };
  });
