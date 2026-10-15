/**
 * Google Sheets sync health telemetry. Every gateway call from the lead-sheet,
 * shift-summary and report-sheet paths records one row per attempt, so the IT
 * Console can show quota (429) hits, retry counts and the last successful sync
 * without digging through server logs.
 */

export type SheetSurface = "lead_import" | "shift_summary" | "report_sheet" | "daily_sheet";
export type SheetOutcome = "success" | "retry" | "failure";

type EventInput = {
  surface: SheetSurface;
  outcome: SheetOutcome;
  operation?: string;
  httpStatus?: number | null;
  attempt?: number;
  retryWaitMs?: number | null;
  durationMs?: number | null;
  errorText?: string | null;
};

/**
 * Fire-and-forget: telemetry must never break a sync. Failures are logged and
 * swallowed.
 */
export async function recordSheetSyncEvent(event: EventInput): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("sheet_sync_events").insert({
      surface: event.surface,
      operation: event.operation ?? "read",
      outcome: event.outcome,
      http_status: event.httpStatus ?? null,
      attempt: event.attempt ?? 0,
      retry_wait_ms: event.retryWaitMs ?? null,
      duration_ms: event.durationMs ?? null,
      error_text: event.errorText ? event.errorText.slice(0, 500) : null,
    });
    if (error) console.error(`sheet sync telemetry failed: ${error.message}`);
  } catch (cause) {
    console.error("sheet sync telemetry failed", cause);
  }
}

export type SheetSurfaceHealth = {
  surface: SheetSurface;
  calls: number;
  successes: number;
  retries: number;
  failures: number;
  quotaHits: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  lastError: string | null;
};

export type SheetSyncHealth = {
  windowHours: number;
  totals: {
    calls: number;
    successes: number;
    retries: number;
    failures: number;
    quotaHits: number;
  };
  surfaces: SheetSurfaceHealth[];
  recent: {
    at: string;
    surface: string;
    outcome: string;
    httpStatus: number | null;
    attempt: number;
    operation: string;
    error: string | null;
  }[];
};

const SURFACES: SheetSurface[] = ["lead_import", "shift_summary", "report_sheet", "daily_sheet"];

/** Aggregated sync health over the last `windowHours` (default 24). */
export async function readSheetSyncHealth(windowHours = 24): Promise<SheetSyncHealth> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - windowHours * 3600_000).toISOString();

  const { data, error } = await supabaseAdmin
    .from("sheet_sync_events")
    .select("surface, operation, outcome, http_status, attempt, error_text, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  const rows = data ?? [];

  const surfaces: SheetSurfaceHealth[] = SURFACES.map((surface) => {
    const own = rows.filter((r) => r.surface === surface);
    const success = own.filter((r) => r.outcome === "success");
    const failure = own.filter((r) => r.outcome === "failure");
    return {
      surface,
      calls: own.length,
      successes: success.length,
      retries: own.filter((r) => r.outcome === "retry").length,
      failures: failure.length,
      quotaHits: own.filter((r) => r.http_status === 429).length,
      lastSuccessAt: success[0]?.created_at ?? null,
      lastFailureAt: failure[0]?.created_at ?? null,
      lastError: failure[0]?.error_text ?? null,
    };
  });

  return {
    windowHours,
    totals: {
      calls: rows.length,
      successes: rows.filter((r) => r.outcome === "success").length,
      retries: rows.filter((r) => r.outcome === "retry").length,
      failures: rows.filter((r) => r.outcome === "failure").length,
      quotaHits: rows.filter((r) => r.http_status === 429).length,
    },
    surfaces,
    recent: rows.slice(0, 25).map((r) => ({
      at: r.created_at,
      surface: r.surface,
      outcome: r.outcome,
      httpStatus: r.http_status ?? null,
      attempt: r.attempt ?? 0,
      operation: r.operation,
      error: r.error_text ?? null,
    })),
  };
}
