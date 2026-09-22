import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** IT Console: per-app-version data coverage + hand the data back again. */
const HealthInput = z.object({
  adminToken: z.string().nullable().optional(),
  windowDays: z.number().int().min(1).max(365).default(90),
});

export const versionDataCoverage = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => HealthInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller, requireDispatch } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireDispatch(caller);
    const { readVersionCoverage } = await import("@/lib/version-ledger.server");
    return readVersionCoverage(data.windowDays);
  });

const ReplayInput = z.object({
  adminToken: z.string().nullable().optional(),
  versionCode: z.number().int().nullable().optional(),
  agentId: z.string().uuid().nullable().optional(),
});

export const replayVersionDataFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ReplayInput.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller, requireDispatch } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireDispatch(caller);
    const { replayVersionData } = await import("@/lib/version-ledger.server");
    const { logAudit } = await import("@/lib/audit.server");
    const count = await replayVersionData({
      versionCode: data.versionCode ?? null,
      agentId: data.agentId ?? null,
    });
    await logAudit({
      action: "version_data_replay",
      entityType: "version_data_ledger",
      metadata: { versionCode: data.versionCode ?? null, agentId: data.agentId ?? null, count },
    }).catch(() => undefined);
    return { count };
  });
