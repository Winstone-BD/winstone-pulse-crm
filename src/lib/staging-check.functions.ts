import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { checkStagingUrl, isolationFromMetadata, type IsolationVerdict } from "@/lib/staging-check";

/**
 * Read-only: fetches the staging app's public sign-in metadata and reports
 * whether it signs in against a backend other than the live CRM's. Writes nothing.
 */
export const checkStagingIsolation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ url: z.string().max(300) }).parse(input))
  .handler(async ({ data }): Promise<{ verdict: IsolationVerdict | "invalid"; detail: string }> => {
    const target = checkStagingUrl(data.url);
    if (!target.ok) return { verdict: "invalid", detail: target.reason };
    try {
      const res = await fetch(`${target.origin}/.well-known/oauth-protected-resource`, {
        redirect: "error",
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { verdict: "unknown", detail: `The staging app didn't publish connector sign-in details (HTTP ${res.status}). Publish it with the connector enabled.` };
      const verdict = isolationFromMetadata(await res.json());
      const detail =
        verdict === "separate"
          ? "The staging app signs in against a different database from the live CRM."
          : verdict === "live"
            ? "The staging app uses the LIVE CRM database. Do not run tests — enable a new backend in the copy."
            : "Couldn't identify the staging app's database.";
      return { verdict, detail };
    } catch (e) {
      return { verdict: "unknown", detail: `Couldn't reach the staging app: ${(e as Error).name === "TimeoutError" ? "timed out" : "request failed"}.` };
    }
  });
