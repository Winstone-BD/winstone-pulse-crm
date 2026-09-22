import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** IT Console: Google Sheets sync health (quota hits, retries, last success). */
const Input = z.object({
  adminToken: z.string().nullable().optional(),
  windowHours: z.number().int().min(1).max(168).default(24),
});

export const sheetSyncHealth = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Input.parse(input))
  .handler(async ({ data }) => {
    const { resolveCaller, requireDispatch } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    requireDispatch(caller);
    const { readSheetSyncHealth } = await import("@/lib/sheet-metrics.server");
    return readSheetSyncHealth(data.windowHours);
  });
