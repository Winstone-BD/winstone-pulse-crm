// Offline-only: reads source files and pure rules. Never queries the live DB.
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { decide, billingStates } from "@/lib/maintenance-rules";

const read = (p: string) => readFileSync(p, "utf8");

/** Tables with RLS on and intentionally no policies: reached only via server-only admin code. */
const SERVER_ONLY_TABLES = [
  "agent_accountability_reviews", "agent_briefing_acknowledgements", "agent_contribution_reviews", "agent_daily_contributions",
  "ai_summary_cache", "architect_auth_attempts", "audit_findings", "audit_remediation_events", "bookings", "bulk_extra_batches", "crm_backup_runs",
  "crm_backup_secret", "drive_documents", "drive_recording_imports", "email_event_receipts", "follow_up_changes",
  "inventory_requirements", "it_notice_recipients", "it_notice_replies", "it_notices", "knowledge_versions",
  "lead_neglect_notices", "lead_neglect_recalls", "lead_personal_notes", "lead_phone_keys", "lead_state_changes",
  "maintenance_audit", "maintenance_unlock_requests", "market_facts", "market_news", "market_news_audit", "market_news_runs",
  "objection_answers", "os_event_receipts", "payment_vouchers", "pin_rotations", "pin_vault", "pitch_events", "pitch_templates",
  "privileged_account_allowlist", "project_catalog", "project_discussion_notes", "project_sales_updates", "record_audit_log",
  "runtime_error_issues", "runtime_error_occurrences", "sales_drafts", "security_findings", "security_scan_reports",
  "service_bill_review_attempts", "sheet_change_proposals", "site_visits", "support_canned_replies", "support_csat",
  "support_customers", "support_notes", "support_settings", "support_ticket_events", "system_maintenance",
  "website_enquiries", "website_pages", "website_visit_requests",
];

const migrations = ["supabase/migrations", "drizzle/migrations"]
  .flatMap((d) => { try { return readdirSync(d).filter((f) => f.endsWith(".sql")).map((f) => read(`${d}/${f}`)); } catch { return []; } })
  .join("\n");

describe("policy-less RLS inventory (offline)", () => {
  it("allowlist has no duplicates and is sorted", () => {
    expect(new Set(SERVER_ONLY_TABLES).size).toBe(SERVER_ONLY_TABLES.length);
    expect([...SERVER_ONLY_TABLES].sort()).toEqual(SERVER_ONLY_TABLES);
  });
  it("no allowlisted table is ever granted a policy in migrations", () => {
    const withPolicy = SERVER_ONLY_TABLES.filter((t) =>
      new RegExp(`create\\s+policy[\\s\\S]{0,300}?\\bon\\s+(public\\.)?"?${t}"?\\b`, "i").test(migrations));
    // Policies created and later dropped by a recorded migration.
    const droppedLater = ["lead_phone_keys"];
    for (const t of droppedLater) expect(migrations).toMatch(new RegExp(`drop\\s+policy[^;]*on\\s+public\\.${t}`, "i"));
    expect(withPolicy.filter((t) => !droppedLater.includes(t))).toEqual([]);
  });
  it("browser code never queries an allowlisted table directly", () => {
    const files = ["src/components", "src/routes", "src/hooks"].flatMap(function walk(d: string): string[] {
      try {
        return readdirSync(d, { withFileTypes: true }).flatMap((e) =>
          e.isDirectory() ? walk(`${d}/${e.name}`) : /\.tsx?$/.test(e.name) && !d.includes("routes/api") ? [`${d}/${e.name}`] : []);
      } catch { return []; }
    });
    const hits: string[] = [];
    for (const f of files) {
      const s = read(f);
      if (!s.includes("@/integrations/supabase/client\"")) continue;
      for (const t of SERVER_ONLY_TABLES) if (s.includes(`.from("${t}")`)) hits.push(`${f}:${t}`);
    }
    expect(hits).toEqual([]);
  });
});

describe("maintenance access ignores stale lock_status", () => {
  const base = { lockAt: "2026-10-14T18:00:00Z", dueAt: "2026-10-13T18:00:00Z", unlockStatus: "none" as const, unlockExpiresAt: null };
  it("verified payment stays ACTIVE after the lock time, whatever lock_status says", () => {
    const now = new Date("2026-10-20T00:00:00Z");
    // A stale raw row (lock_status='active' or 'locked') is not an input to the rule at all.
    const row = { ...base, paymentStatus: "verified" as const, lock_status: "active" };
    expect(decide({ now, ...row }).locked).toBe(false);
    expect(billingStates({ now, ...row })).toMatchObject({ access: "ACTIVE", payment: "VERIFIED", invoice: "PAID" });
  });
  it("unpaid past lock is LOCKED even if lock_status is stale 'active'", () => {
    const now = new Date("2026-10-20T00:00:00Z");
    expect(billingStates({ now, ...base, paymentStatus: "unpaid" as never, lock_status: "active" } as never).access).toBe("LOCKED");
  });
  it("server readers never select lock_status to decide access", () => {
    const src = read("src/lib/maintenance.server.ts");
    for (const m of src.matchAll(/\.select\(\s*"([^"]+)"/g)) expect(m[1]).not.toMatch(/\block_status\b/);
    const ui = ["src/components", "src/routes"].flatMap(function walk(d: string): string[] {
      return readdirSync(d, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]);
    }).filter((f) => /\.tsx?$/.test(f) && read(f).includes("lock_status"));
    expect(ui).toEqual([]);
  });
});

describe("buyer-extract / buyer-facts / sales-drafts auth (source)", () => {
  const be = read("src/lib/buyer-extract.functions.ts");
  const bes = read("src/lib/buyer-extract.server.ts");
  const bf = read("src/lib/buyer-facts.functions.ts");
  const sd = read("src/lib/sales-drafts.functions.ts");
  const sds = read("src/lib/sales-drafts.server.ts");
  it("every handler resolves the caller server-side", () => {
    for (const s of [be, bf]) expect(s.match(/\.handler\(/g)!.length).toBe(s.match(/resolveCaller\(/g)!.length);
    const handlers = sd.split(".handler(").slice(1);
    for (const h of handlers) expect(h.slice(0, 200)).toMatch(/await scope\(data\.token\)/);
  });
  it("agents are limited to their assigned leads", () => {
    expect(bes).toMatch(/!authority && lead\.assigned_to !== agentId/);
    expect(be).toMatch(/lead\.assigned_to !== c\.profile\?\.id/);
    expect(bf).toMatch(/lead\.assigned_to !== c\.profile!\.id/);
    expect(sds.match(/!authority && lead\.assigned_to !== agentId/g)!.length).toBeGreaterThanOrEqual(3);
  });
  it("saving the buyer check refuses read-only callers", () => {
    expect(be).toMatch(/if \(c\.readOnly\) throw new Error\("Read-only access"\)/);
  });
  it("draft-writing handlers refuse read-only callers", () => {
    for (const name of ["draftFollowupPair", "saveSalesDraftEdit", "getNegotiationAdvice", "getCallCoach", "draftMarketingPost", "saveMarketingPost", "approveObjection"]) {
      const body = sd.split(`export const ${name} `)[1].split("export const ")[0];
      expect(body, name).toMatch(/readOnly/);
    }
  });
});
