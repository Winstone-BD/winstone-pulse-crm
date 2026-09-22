/**
 * Google Sheet -> CRM lead intake (Phase 1). Reads a workspace Google Sheet
 * through the Lovable connector gateway (server-only credentials) and turns the
 * values grid into the same lead rows the CSV import uses.
 */

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

/** Accepts a full Google Sheets URL or a bare spreadsheet ID. */
export function parseSheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  const id = match?.[1] ?? trimmed;
  if (!/^[a-zA-Z0-9-_]{20,}$/.test(id)) {
    throw new Error("Google Sheet লিংকটি ঠিক নেই — শিটের পূর্ণ লিংক দিন");
  }
  return id;
}

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
async function gatewayFetch(path: string, attempt = 0): Promise<unknown> {
  const response = await fetch(`${GATEWAY}${path}`, { headers: gatewayHeaders() });
  const body = await response.text();
  if (!response.ok) {
    const retryable = response.status === 429 || response.status >= 500;
    if (retryable && attempt < 3) {
      const retryAfter = Number(response.headers.get("retry-after"));
      const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : 1500 * 2 ** attempt + Math.floor(Math.random() * 400);
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      return gatewayFetch(path, attempt + 1);
    }
    console.error(`Sheets gateway failed [${response.status}]: ${body}`);
    if (response.status === 403 || response.status === 404) {
      throw new Error("শিটটি পড়া যায়নি — সংযুক্ত Google অ্যাকাউন্টকে এই শিটের অ্যাক্সেস দিন");
    }
    throw new Error(`Google Sheets ত্রুটি [${response.status}]: ${body.slice(0, 300)}`);
  }
  return body ? (JSON.parse(body) as unknown) : null;
}

/** Tab lists rarely change; remember them briefly to cut metadata reads. */
const tabCache = new Map<string, { tabs: string[]; at: number }>();
const TAB_CACHE_MS = 5 * 60 * 1000;

/** Tab names in the spreadsheet, in sheet order. */
export async function listSheetTabs(sheetId: string): Promise<string[]> {
  const cached = tabCache.get(sheetId);
  if (cached && Date.now() - cached.at < TAB_CACHE_MS) return cached.tabs;
  const meta = (await gatewayFetch(`/spreadsheets/${sheetId}?fields=sheets.properties.title`)) as {
    sheets?: { properties?: { title?: string } }[];
  } | null;
  const tabs = (meta?.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
  tabCache.set(sheetId, { tabs, at: Date.now() });
  return tabs;
}

/** Raw values grid of one tab (first 2000 rows, columns A-H). */
export async function readSheetGrid(sheetId: string, tab: string): Promise<string[][]> {
  const range = `${tab.includes("'") ? tab : `'${tab}'`}!A1:H2000`;
  const payload = (await gatewayFetch(
    `/spreadsheets/${sheetId}/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
  )) as { values?: unknown[][] } | null;
  return (payload?.values ?? []).map((row) => row.map((cell) => String(cell ?? "")));
}

/** Sheet -> reviewable lead rows, using the shared CSV column mapping. */
export async function readSheetLeads(sheetUrl: string, tab?: string | null) {
  const sheetId = parseSheetId(sheetUrl);
  const tabs = await listSheetTabs(sheetId);
  if (tabs.length === 0) throw new Error("এই শিটে কোনো ট্যাব পাওয়া যায়নি");
  const chosen = tab && tabs.includes(tab) ? tab : tabs[0]!;
  const grid = await readSheetGrid(sheetId, chosen);
  const { toLeadRows } = await import("@/lib/csv-leads");
  return { sheetId, tabs, tab: chosen, rows: toLeadRows(grid) };
}
