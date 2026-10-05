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

export const getOsSyncStatus = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => tokenSchema.parse(i ?? {}))
  .handler(async ({ data }) => {
    await itCaller(data.adminToken, false);
    const { osSyncStatus } = await import("@/lib/os-outbound.server");
    return osSyncStatus();
  });

export const runOsDispatch = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => tokenSchema.parse(i ?? {}))
  .handler(async ({ data }) => {
    await itCaller(data.adminToken, true);
    const { dispatchOsQueue } = await import("@/lib/os-outbound.server");
    return dispatchOsQueue();
  });

export const retryOsSyncEvent = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => tokenSchema.extend({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const caller = await itCaller(data.adminToken, true);
    const { requeueOsEvent } = await import("@/lib/os-outbound.server");
    await requeueOsEvent(data.id, caller.label ?? caller.profile?.name ?? "IT Console");
    return { ok: true as const };
  });
