import { createFileRoute } from "@tanstack/react-router";

/** Temporary one-off bulk import for the 27 Sep 2026 head-office lead file. Removed after use. */
export const Route = createFileRoute("/api/public/tmp-bulk-import")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get("x-import-secret") ?? "";
        const expected = process.env["TMP_BULK_IMPORT_SECRET"];
        if (!expected || secret.length !== expected.length || secret !== expected) {
          return Response.json({ error: "unauthorized" }, { status: 401 });
        }
        const body = (await request.json()) as {
          rows: { name: string; phone_number: string; company?: string | null; notes?: string | null }[];
        };
        const { intakeLead } = await import("@/lib/lead-intake.server");
        let imported = 0;
        let duplicates = 0;
        let failed = 0;
        for (const row of body.rows ?? []) {
          try {
            const result = await intakeLead({
              name: row.name,
              phoneNumber: row.phone_number,
              company: row.company ?? null,
              notes: row.notes ?? null,
              ownerId: null,
              source: "head_database",
            });
            if (result.duplicate) duplicates += 1;
            else imported += 1;
          } catch {
            failed += 1;
          }
        }
        return Response.json({ imported, duplicates, failed, total: body.rows?.length ?? 0 });
      },
    },
  },
});
