import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Integration readiness: presence flags only (never values) plus a
 * non-destructive credential check for gateway connectors. HQ/IT only.
 */
type Item = {
  id: string;
  label: string;
  purpose: string;
  keys: string[];
  optional?: boolean;
  gateway?: { connector: string; key: string };
};
type Group = { id: string; label: string; items: Item[] };

const GROUPS: Group[] = [
  { id: "core", label: "Core platform", items: [
    { id: "backend", label: "Database & sign-in", purpose: "Staff accounts, leads and all CRM records", keys: ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] },
    { id: "ai", label: "Winstone AI", purpose: "Copilot, buyer-check, summaries and drafts", keys: ["LOVABLE_API_KEY"] },
    { id: "session", label: "Admin sessions & PINs", purpose: "HQ / IT / LeadHub PIN sign-in", keys: ["ADMIN_TOKEN_SECRET", "ADMIN_PIN", "IT_CONSOLE_PIN", "LEADHUB_PIN"] },
  ]},
  { id: "google", label: "Google Workspace", items: [
    { id: "sheets", label: "Google Sheets", purpose: "Daily report sync at 6:30 PM Dhaka", keys: ["GOOGLE_SHEETS_API_KEY"], gateway: { connector: "google_sheets", key: "GOOGLE_SHEETS_API_KEY" } },
    { id: "drive", label: "Google Drive", purpose: "Call recordings inbox and backups", keys: ["GOOGLE_DRIVE_API_KEY"], gateway: { connector: "google_drive", key: "GOOGLE_DRIVE_API_KEY" } },
    { id: "docs", label: "Google Docs", purpose: "Recording transcripts as documents", keys: ["GOOGLE_DOCS_API_KEY"], optional: true, gateway: { connector: "google_docs", key: "GOOGLE_DOCS_API_KEY" } },
    { id: "calendar", label: "Google Calendar", purpose: "Optional calendar mirroring", keys: ["GOOGLE_CALENDAR_API_KEY"], optional: true, gateway: { connector: "google_calendar", key: "GOOGLE_CALENDAR_API_KEY" } },
  ]},
  { id: "comms", label: "Messages & notifications", items: [
    { id: "push", label: "Android & web push", purpose: "Visit and follow-up reminders on phones", keys: ["FIREBASE_MESSAGING_API_KEY"], gateway: { connector: "firebase_messaging", key: "FIREBASE_MESSAGING_API_KEY" } },
    { id: "email", label: "Email (Hostinger)", purpose: "Bill notices and unlock links", keys: ["NOTIFY_EMAIL_API_KEY", "SERVICE_BILL_APPROVER_EMAIL"] },
    { id: "email-events", label: "Email delivery events", purpose: "Bounce / delivery reports", keys: ["HOSTINGER_EMAIL_WEBHOOK_SECRET"], optional: true },
    { id: "whatsapp", label: "WhatsApp Business", purpose: "Optional business inbox", keys: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_APP_SECRET"], optional: true },
  ]},
  { id: "bridge", label: "Winstone OS & automation", items: [
    { id: "os", label: "Winstone OS bridge", purpose: "Signed booking and visit events", keys: ["CRM_BRIDGE_SECRET", "OS_BOOKING_ENDPOINT"] },
    { id: "cron", label: "Scheduled jobs", purpose: "Sheet sync, reminders, shift summaries", keys: ["SHIFT_CRON_SECRET", "LOVABLE_CRON_SECRET"] },
    { id: "ingest", label: "Android app sync", purpose: "Calls and recordings from agent phones", keys: ["INGEST_SECRET"] },
  ]},
  { id: "speech", label: "Speech & extras", items: [
    { id: "stt", label: "Bangla speech-to-text", purpose: "Call transcripts (Sarvam)", keys: ["SARVAM_API_KEY"], optional: true },
    { id: "github", label: "GitHub issues", purpose: "Runtime error tickets", keys: ["GITHUB_API_KEY"], optional: true, gateway: { connector: "github", key: "GITHUB_API_KEY" } },
  ]},
];

const Token = z.string().max(4096).nullable().optional();

async function authority(token: string | null | undefined) {
  const { resolveCaller } = await import("@/lib/access.server");
  const c = await resolveCaller(token ?? null);
  if (c.scope !== "authority") throw new Error("Only HQ / IT admins can view integration readiness");
}

export const getIntegrationReadiness = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token }).parse(i))
  .handler(async ({ data }) => {
    await authority(data.adminToken);
    const has = (k: string) => Boolean(process.env[k]);
    return GROUPS.map((g) => ({
      id: g.id,
      label: g.label,
      items: g.items.map((it) => {
        const keys = it.keys.map((k) => ({ name: k, saved: has(k) }));
        const savedCount = keys.filter((k) => k.saved).length;
        const status = savedCount === keys.length ? "ready" : savedCount === 0 ? (it.optional ? "not_used" : "missing") : "partial";
        if (it.id === "os") {
          const ep = process.env["OS_BOOKING_ENDPOINT"] ?? "";
          if (ep && !ep.startsWith("https://")) return { ...pub(it), keys, status: "partial" as const, note: "Endpoint is not https" };
        }
        return { ...pub(it), keys, status, note: null as string | null };
      }),
    }));
  });

function pub(it: Item) {
  return { id: it.id, label: it.label, purpose: it.purpose, optional: !!it.optional, verifiable: !!it.gateway || it.id === "ai" };
}

export const verifyIntegration = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ adminToken: Token, id: z.string().max(40) }).parse(i))
  .handler(async ({ data }) => {
    await authority(data.adminToken);
    const item = GROUPS.flatMap((g) => g.items).find((i) => i.id === data.id);
    if (!item) return { outcome: "failed" as const, detail: "Unknown integration" };
    const lk = process.env["LOVABLE_API_KEY"];
    if (!lk) return { outcome: "failed" as const, detail: "AI / connection key not saved" };
    try {
      if (item.id === "ai") {
        const r = await fetch("https://ai.gateway.lovable.dev/v1/models", { headers: { Authorization: `Bearer ${lk}` } });
        return r.ok ? { outcome: "verified" as const, detail: "Winstone AI reachable" } : { outcome: "failed" as const, detail: `AI service answered ${r.status}` };
      }
      if (!item.gateway) return { outcome: "skipped" as const, detail: "Only presence can be checked for this one" };
      const ck = process.env[item.gateway.key];
      if (!ck) return { outcome: "failed" as const, detail: "Connection not linked yet" };
      const r = await fetch("https://connector-gateway.lovable.dev/api/v1/verify_credentials", {
        method: "POST",
        headers: { Authorization: `Bearer ${lk}`, "X-Connection-Api-Key": ck },
      });
      if (!r.ok) return { outcome: "failed" as const, detail: `Check answered ${r.status}` };
      const j = (await r.json().catch(() => ({}))) as { outcome?: string };
      const o = j.outcome === "verified" || j.outcome === "skipped" ? j.outcome : "failed";
      return { outcome: o as "verified" | "skipped" | "failed", detail: o === "verified" ? "Credentials accepted" : o === "skipped" ? "Provider has no test call" : "Credentials rejected — reconnect needed" };
    } catch {
      return { outcome: "failed" as const, detail: "Could not reach the check service" };
    }
  });
