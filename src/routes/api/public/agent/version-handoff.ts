import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

/**
 * Version data hand-back for the Android app.
 *
 * GET  ?version_code=NN -> every lead and post-call report this agent's earlier
 *                          app versions synced that the running version has not
 *                          been handed yet (with the live CRM row).
 * POST { version_code, ledger_ids } -> the new version confirms it holds them.
 *
 * This is what makes an app upgrade, a reinstall or a dropped version safe:
 * offline work recorded by the old build is replayed into the new one.
 */
const AckBody = z.object({
  version_code: z.number().int().nullable().optional(),
  ledger_ids: z.array(z.string().uuid()).max(500).default([]),
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const Route = createFileRoute("/api/public/agent/version-handoff")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);

        const url = new URL(request.url);
        const raw = url.searchParams.get("version_code");
        const versionCode = raw && Number.isFinite(Number(raw)) ? Number(raw) : null;

        const { readVersionHandoff } = await import("@/lib/version-ledger.server");
        try {
          const { items, fromVersions } = await readVersionHandoff({
            agentId: caller.profile.id,
            versionCode,
          });
          return json({
            version_code: versionCode,
            from_versions: fromVersions,
            count: items.length,
            items,
          });
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "হ্যান্ডঅফ পড়া যায়নি" }, 500);
        }
      },

      POST: async ({ request }) => {
        const { resolveApiCaller } = await import("@/lib/device-auth.server");
        const caller = await resolveApiCaller(request);
        if (caller.kind !== "device") return json({ error: "Unauthorized" }, 401);

        const parsed = AckBody.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json({ error: "Invalid payload" }, 400);

        const { markVersionHandoffRestored } = await import("@/lib/version-ledger.server");
        try {
          const restored = await markVersionHandoffRestored({
            agentId: caller.profile.id,
            ledgerIds: parsed.data.ledger_ids,
            versionCode: parsed.data.version_code ?? null,
          });
          return json({ ok: true, restored });
        } catch (error) {
          return json({ error: error instanceof Error ? error.message : "নিশ্চিত করা যায়নি" }, 500);
        }
      },
    },
  },
});
