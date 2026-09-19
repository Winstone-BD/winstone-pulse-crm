import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** Reminder feed for the web CRM bell, plus browser push registration. */

const Base = z.object({ adminToken: z.string().nullable().optional() });

async function agentOf(adminToken: string | null) {
  const { resolveCaller } = await import("@/lib/access.server");
  const caller = await resolveCaller(adminToken);
  if (caller.scope === "none" || !caller.profile) {
    throw new Error("অনুমোদিত অ্যাকাউন্ট দিয়ে সাইন ইন করুন");
  }
  return caller.profile;
}

export const myReminders = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Base.parse(input))
  .handler(async ({ data }) => {
    // A signed-out or pending visitor simply has no reminders; the bell stays quiet.
    const { resolveCaller } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    if (caller.scope === "none" || !caller.profile) return { reminders: [] };
    const { remindersFor } = await import("@/lib/reminders.server");
    return { reminders: await remindersFor(caller.profile.id) };
  });

/** Stores this browser's Firebase token so reminders arrive with the tab closed. */
export const registerReminderDevice = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    Base.extend({ token: z.string().min(20).max(500), label: z.string().max(80).nullable().optional() }).parse(input),
  )
  .handler(async ({ data }) => {
    const me = await agentOf(data.adminToken ?? null);
    const { savePushToken } = await import("@/lib/push.server");
    await savePushToken({
      profileId: me.id,
      token: data.token,
      platform: "web",
      label: data.label ?? "Web CRM",
    });
    return { ok: true };
  });
