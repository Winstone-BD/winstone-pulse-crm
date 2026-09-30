import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type HealthCheck = {
  key: "database" | "auth" | "storage";
  ok: boolean;
  detail: string;
  latencyMs: number;
};

export type BackendHealth = {
  checkedAt: string;
  checks: HealthCheck[];
} | null;

async function timed(
  key: HealthCheck["key"],
  run: () => Promise<string>,
): Promise<HealthCheck> {
  const started = Date.now();
  try {
    const detail = await run();
    return { key, ok: true, detail, latencyMs: Date.now() - started };
  } catch (error) {
    return {
      key,
      ok: false,
      detail: error instanceof Error ? error.message : "অজানা ত্রুটি",
      latencyMs: Date.now() - started,
    };
  }
}

/**
 * Read-only backend health probe for the IT console. Verifies database,
 * authentication and storage connectivity without touching any setting or row.
 */
export const backendHealth = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ adminToken: z.string().nullable().optional() }).parse(input),
  )
  .handler(async ({ data }): Promise<BackendHealth> => {
    const { resolveCaller, requireAuthority } = await import("@/lib/access.server");
    const caller = await resolveCaller(data.adminToken ?? null);
    // Locked or non-authority session: show the locked state, never crash the page.
    try {
      requireAuthority(caller);
    } catch {
      return null;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const url = process.env["SUPABASE_URL"] ?? "";

    const checks: HealthCheck[] = [];

    checks.push(
      await timed("database", async () => {
        const { count, error } = await supabaseAdmin
          .from("profiles")
          .select("id", { count: "exact", head: true });
        if (error) throw new Error(error.message);
        return `সংযোগ ঠিক আছে — ${count ?? 0} টি স্টাফ রেকর্ড পড়া গেছে`;
      }),
    );

    checks.push(
      await timed("auth", async () => {
        if (!url) throw new Error("ব্যাকএন্ড ঠিকানা পাওয়া যায়নি");
        const response = await fetch(`${url}/auth/v1/health`, {
          headers: { apikey: process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "" },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return "সাইন-ইন সেবা সাড়া দিচ্ছে";
      }),
    );

    checks.push(
      await timed("storage", async () => {
        const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
        if (error) throw new Error(error.message);
        return `${buckets?.length ?? 0} টি ফাইল স্টোর পড়া গেছে`;
      }),
    );

    return { checkedAt: new Date().toISOString(), checks };
  });
