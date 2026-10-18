/**
 * Shift summaries → Google Sheets. Every generated shift summary is written to
 * a dedicated tab in the workspace spreadsheet, so HQ can read the summary
 * straight from Google Sheets without opening the CRM. The tab holds one block
 * per shift, newest first; reruns for the same shift replace its old block, so
 * repeats stay idempotent.
 */
import type { ShiftAgentLine, ShiftSummaryRow } from "@/lib/shift-summary.server";

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const SHEET_ID = "1cS2BH_T9USf7lbVfKMWGi18EV53y1jDGqENzkNTiG7s";
const TAB = "শিফট সামারি";

const HEADER = [
  "শিফট",
  "সময়কাল",
  "তৈরির সময়",
  "এজেন্ট",
  "বরাদ্দ লিড",
  "কল",
  "সংযুক্ত",
  "রিপোর্ট",
  "বাকি",
  "ফলো-আপ",
  "ক্যাটাগরি",
] as const;

function gatewayHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["GOOGLE_SHEETS_API_KEY"];
  if (!lovableKey || !connectionKey) {
    throw new Error("Google Sheets সংযোগ কনফিগার করা নেই");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": connectionKey,
    "Content-Type": "application/json",
  };
}

/** Google's per-minute quota is shared, so a 429/5xx waits and tries again. */
async function gatewayFetch(path: string, init?: RequestInit, attempt = 0): Promise<unknown> {
  const { recordSheetSyncEvent } = await import("@/lib/sheet-metrics.server");
  const operation = init?.method ? init.method.toLowerCase() : "read";
  const startedAt = Date.now();
  const response = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...gatewayHeaders(), ...(init?.headers ?? {}) },
  });
  const body = await response.text();
  const durationMs = Date.now() - startedAt;
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 1500 * 2 ** attempt + Math.floor(Math.random() * 400);
      await recordSheetSyncEvent({
        surface: "shift_summary",
        operation,
        outcome: "retry",
        httpStatus: response.status,
        attempt,
        retryWaitMs: waitMs,
        durationMs,
        errorText: body,
      });
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return gatewayFetch(path, init, attempt + 1);
    }
    console.error(`Sheets gateway failed [${response.status}]: ${body}`);
    await recordSheetSyncEvent({
      surface: "shift_summary",
      operation,
      outcome: "failure",
      httpStatus: response.status,
      attempt,
      durationMs,
      errorText: body,
    });
    throw new Error(`Google Sheets ত্রুটি [${response.status}]: ${body.slice(0, 300)}`);
  }
  await recordSheetSyncEvent({
    surface: "shift_summary",
    operation,
    outcome: "success",
    httpStatus: response.status,
    attempt,
    durationMs,
  });
  return body ? (JSON.parse(body) as unknown) : null;
}

function formatDhaka(iso: string) {
  return new Date(iso).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" });
}

function categoryText(categories: Record<string, number>) {
  return Object.entries(categories)
    .map(([label, count]) => `${label}: ${count}`)
    .join(", ");
}

/** The tab is created once; remembering it avoids a metadata read per write. */
let tabReady = false;
let tabSheetIdCache: number | null = null;

async function ensureTab() {
  if (tabReady) return;
  const meta = (await gatewayFetch(`/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`)) as {
    sheets?: { properties?: { title?: string } }[];
  } | null;
  const exists = (meta?.sheets ?? []).some((s) => s.properties?.title === TAB);
  if (!exists) {
    await gatewayFetch(`/spreadsheets/${SHEET_ID}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests: [{ addSheet: { properties: { title: TAB } } }] }),
    });
    await gatewayFetch(
      `/spreadsheets/${SHEET_ID}/values/${TAB}!A1:K1?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values: [[...HEADER]] }) },
    );
  }
  tabReady = true;
}

/** One summary → one block of rows (a totals row, then one row per agent). */
function summaryRows(summary: ShiftSummaryRow): string[][] {
  const window = `${formatDhaka(summary.window_start)} — ${formatDhaka(summary.window_end)}`;
  const rows: string[][] = [
    [
      summary.shift_label,
      window,
      formatDhaka(summary.generated_at),
      "মোট",
      "",
      String(summary.totals.called),
      String(summary.totals.connected),
      String(summary.totals.reports),
      String(summary.totals.pending),
      String(summary.totals.followUps),
      "",
    ],
  ];
  for (const agent of summary.agents) {
    rows.push([
      summary.shift_label,
      window,
      formatDhaka(summary.generated_at),
      agent.name + (agent.employeeId ? ` (${agent.employeeId})` : ""),
      String(agent.assigned),
      String(agent.called),
      String(agent.connected),
      String(agent.reports),
      String(agent.pending),
      String(agent.followUps),
      categoryText(agent.categories),
    ]);
  }
  return rows;
}

/**
 * Appends a finished shift's summary block at the top of the tab (right under
 * the header) using Sheets' insertDimension + values update. Fails quietly by
 * returning null when the Sheets connection is missing — the database summary
 * and Drive file must never be blocked by a Sheets problem.
 */
export async function appendShiftSummaryToSheetQuietly(
  shiftKey: string,
): Promise<{ sheetUrl: string; rowsWritten: number } | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("shift_summaries")
      .select("*")
      .eq("shift_key", shiftKey)
      .maybeSingle();
    if (error || !data) return null;
    const summary = data as unknown as ShiftSummaryRow;

    await ensureTab();
    const block = summaryRows(summary);
    // Insert fresh rows under the header, then write the block there.
    await gatewayFetch(`/spreadsheets/${SHEET_ID}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            insertDimension: {
              range: {
                sheetId: await tabSheetId(),
                dimension: "ROWS",
                startIndex: 1,
                endIndex: 1 + block.length,
              },
              inheritFromBefore: false,
            },
          },
        ],
      }),
    });
    await gatewayFetch(
      `/spreadsheets/${SHEET_ID}/values/${TAB}!A2:K${1 + block.length}?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values: block }) },
    );

    await logShiftSheetSync(shiftKey, block.length);
    return { sheetUrl: shiftSheetUrl(), rowsWritten: block.length };
  } catch (err) {
    console.error(`Shift summary → Sheets failed for ${shiftKey}:`, err);
    return null;
  }
}

async function tabSheetId(): Promise<number> {
  if (tabSheetIdCache !== null) return tabSheetIdCache;
  const meta = (await gatewayFetch(
    `/spreadsheets/${SHEET_ID}?fields=sheets.properties`,
  )) as { sheets?: { properties?: { title?: string; sheetId?: number } }[] } | null;
  const found = (meta?.sheets ?? []).find((s) => s.properties?.title === TAB);
  if (!found?.properties?.sheetId) throw new Error("শিফট সামারি ট্যাব খুঁজে পাওয়া যায়নি");
  tabSheetIdCache = found.properties.sheetId;
  return tabSheetIdCache;
}

async function logShiftSheetSync(shiftKey: string, rowsWritten: number) {
  try {
    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({
      action: "shift_summary_generated",
      entityType: "shift_summary",
      entityId: shiftKey,
      actorLabel: "নির্ধারিত সময়সূচি",
      metadata: { sheets_sync: true, rowsWritten },
    });
  } catch {
    // audit best-effort
  }
}

export function shiftSheetUrl() {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/edit#gid=0`;
}
