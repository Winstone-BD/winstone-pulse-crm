import { createFileRoute } from "@tanstack/react-router";

/**
 * The Android app's reminder feed: unfinished reports and due follow-ups for
 * the signed-in device's agent. The app turns each row into a local
 * notification, so reminders work even when push is not configured.
 */
export const Route = createFileRoute("/api/public/agent/reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { resolveApiCaller, json, unauthorized } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return unauthorized();

        const { remindersFor } = await import("@/lib/reminders.server");
        return json({ reminders: await remindersFor(caller.profile.id) });
      },
    },
  },
});
