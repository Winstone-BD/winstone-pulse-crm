// Central runtime-error store. Server-only tables; written with the admin client
// after input is sanitised. Repeats of one problem collapse into one issue by
// fingerprint; a resolved issue that happens again is reopened (regression).

export type ReportInput = {
  source: "browser" | "health-check";
  kind: string;
  message: string;
  route: string;
  browser?: string | null;
};

const clip = (v: string, n: number) => v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, n);

/** Drops query strings / hashes so tokens or phone numbers in URLs are never stored. */
export function cleanRoute(route: string): string {
  const path = clip(route || "/", 300).split(/[?#]/)[0] || "/";
  return path.startsWith("/") ? path : "/";
}

/** Same error on different builds/ids → same group. */
export function normaliseMessage(message: string): string {
  return clip(message, 500)
    .replace(/https?:\/\/[^\s)"']+/g, "<url>")
    .replace(/\b[0-9a-f]{8,}\b/gi, "<id>")
    .replace(/\d+/g, "<n>");
}

async function sha(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 40);
}

export async function recordRuntimeError(input: ReportInput) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const kind = clip(input.kind, 60) || "error";
  const message = clip(input.message, 1000) || "Unknown error";
  const route = cleanRoute(input.route);
  const fingerprint = await sha(`${input.source}|${kind}|${normaliseMessage(message)}`);
  const now = new Date().toISOString();

  const { data: existing } = await supabaseAdmin
    .from("runtime_error_issues")
    .select("id, routes, occurrences, status, reopened_count, last_seen")
    .eq("fingerprint", fingerprint)
    .maybeSingle();

  let issueId: string;
  let isNew = false;
  if (!existing) {
    const { data, error } = await supabaseAdmin
      .from("runtime_error_issues")
      .insert({ fingerprint, source: input.source, kind, message, routes: [route] })
      .select("id")
      .single();
    if (error || !data) {
      // Lost a race with a concurrent insert — retry as an update.
      if (error?.code === "23505") return recordRuntimeError(input);
      throw new Error(error?.message ?? "insert failed");
    }
    issueId = data.id;
    isNew = true;
  } else {
    issueId = existing.id;
    const routes = existing.routes.includes(route) ? existing.routes : [...existing.routes, route].slice(-25);
    const reopen = existing.status === "resolved";
    await supabaseAdmin
      .from("runtime_error_issues")
      .update({
        routes,
        occurrences: existing.occurrences + 1,
        last_seen: now,
        ...(reopen
          ? { status: "open", resolved_at: null, resolved_by: null, reopened_count: existing.reopened_count + 1 }
          : {}),
      })
      .eq("id", issueId);
    isNew = reopen;
  }

  // Bound the timeline: at most one occurrence row per issue per 10 seconds.
  const { data: recent } = await supabaseAdmin
    .from("runtime_error_occurrences")
    .select("id")
    .eq("issue_id", issueId)
    .gte("occurred_at", new Date(Date.now() - 10_000).toISOString())
    .limit(1);
  if (!recent?.length) {
    await supabaseAdmin.from("runtime_error_occurrences").insert({
      issue_id: issueId,
      route,
      detail: message.slice(0, 1000),
      browser: input.browser ? clip(input.browser, 200) : null,
    });
  }
  return { issueId, isNew };
}

/** Health check found the app fine again → close its own open health issues. */
export async function resolveHealthIssues(note: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("runtime_error_issues")
    .update({ status: "resolved", resolved_at: new Date().toISOString(), resolved_by: "auto-health-check", resolution_note: note })
    .eq("source", "health-check")
    .eq("status", "open");
}

/** Loads the live home page and its startup scripts the way a browser would. */
export async function runDeploymentHealthCheck(baseUrl: string) {
  const problems: { kind: string; message: string; route: string }[] = [];
  const started = Date.now();
  let html = "";
  try {
    const res = await fetch(baseUrl + "/", { headers: { "user-agent": "WinstoneHealthCheck/1.0" }, redirect: "follow" });
    html = await res.text();
    if (!res.ok) problems.push({ kind: "page-down", message: `Home page returned HTTP ${res.status}`, route: "/" });
  } catch (e) {
    problems.push({ kind: "page-down", message: `Home page unreachable: ${e instanceof Error ? e.message : "network error"}`, route: "/" });
  }

  if (html) {
    const scripts = Array.from(html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g)).map((m) => m[1]!).slice(0, 5);
    if (!scripts.length && !problems.length) {
      problems.push({ kind: "no-startup-script", message: "Home page has no startup script", route: "/" });
    }
    for (const src of scripts) {
      const url = new URL(src, baseUrl).toString();
      try {
        const r = await fetch(url, { headers: { "user-agent": "WinstoneHealthCheck/1.0" } });
        const type = r.headers.get("content-type") ?? "";
        if (!r.ok || !/javascript/.test(type)) {
          problems.push({ kind: "script-unavailable", message: `Startup script failed (HTTP ${r.status}, ${type || "no type"}): ${new URL(url).pathname}`, route: "/" });
        }
      } catch (e) {
        problems.push({ kind: "script-unavailable", message: `Startup script unreachable: ${new URL(url).pathname}`, route: "/" });
      }
    }
  }

  for (const p of problems) await recordRuntimeError({ source: "health-check", ...p });
  if (!problems.length) await resolveHealthIssues("Health check passed: page and startup scripts load");
  return { healthy: problems.length === 0, problems, ms: Date.now() - started };
}
