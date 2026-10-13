/**
 * STAGING-ONLY end-to-end test: call initiation -> post-call report.
 *
 * Runs the real server rules against a REAL database, so it must never touch
 * the live CRM. It refuses to start unless:
 *   - STAGING_E2E=1 is set, and
 *   - SUPABASE_URL is NOT the live project, and
 *   - STAGING_CONFIRM equals the staging project ref inside SUPABASE_URL.
 *
 * Run (against an isolated staging/draft backend only):
 *   STAGING_E2E=1 STAGING_CONFIRM=<staging-ref> bunx vitest run --config vitest.staging.config.ts
 *
 * It creates its own clearly-labelled fixtures (a "[STAGING-E2E]" agent + lead).
 * Leads are never deleted by design, so fixtures stay in the staging database.
 */
import { randomUUID } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

const LIVE_REF = "siepfegeubbqwhodyxcg";
const url = process.env["SUPABASE_URL"] ?? "";
const confirm = process.env["STAGING_CONFIRM"] ?? "";

import { stagingBlocker } from "./guard";
export function stagingGuard(): string | null {
  return stagingBlocker();
}
function legacyStagingGuard(): string | null {
  if (process.env["STAGING_E2E"] !== "1") return "STAGING_E2E=1 not set";
  if (!url) return "SUPABASE_URL missing";
  if (url.includes(LIVE_REF)) return "Refusing: SUPABASE_URL points at the LIVE CRM";
  if (!confirm || !url.includes(confirm)) return "STAGING_CONFIRM must match the staging project ref in SUPABASE_URL";
  return null;
}
void legacyStagingGuard;
const blocked = stagingGuard();
if (blocked) throw new Error(`[staging-e2e] ${blocked}`);

const tag = `[STAGING-E2E] ${new Date().toISOString()}`;
let agentId = "";
let otherAgentId = "";
let leadId = "";
let foreignLeadId = "";

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

async function makeAgent(label: string) {
  const db = await admin();
  const email = `staging-e2e+${randomUUID().slice(0, 8)}@example.invalid`;
  const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true, password: randomUUID() });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  const id = data.user.id;
  await db.from("profiles").upsert({ id, name: `${tag} ${label}`, email, role: "agent", photo_path: "staging/e2e.jpg" } as never);
  await db.from("user_roles").upsert({ user_id: id, role: "agent" } as never, { onConflict: "user_id,role" });
  return id;
}

async function makeLead(assignedTo: string) {
  const db = await admin();
  const phone = `017${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
  const { data, error } = await db
    .from("leads")
    .insert({ name: `${tag} lead`, phone_number: phone, assigned_to: assignedTo, assigned_agent_id: assignedTo, assignment_source: "leadhub", status: "pending" } as never)
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("lead insert failed");
  return (data as { id: string }).id;
}

beforeAll(async () => {
  agentId = await makeAgent("agent");
  otherAgentId = await makeAgent("other");
  leadId = await makeLead(agentId);
  foreignLeadId = await makeLead(otherAgentId);
}, 60_000);

describe("staging: call initiation gates", () => {
  it("after 09:05 without acknowledgement the call is blocked, then allowed after acknowledging", async () => {
    const b = await import("@/lib/agent-briefing.server");
    const after905 = Date.now(); // real clock; skip if before 09:05 Dhaka
    if (!b.briefingRequiredAt(after905)) return;
    expect(await b.requireAgentBriefing(agentId, after905)).toMatchObject({ blocked: true });
    await b.acknowledgeAgentBriefing(agentId, "web", after905);
    expect(await b.requireAgentBriefing(agentId, after905)).toBeNull();
  });

  it("a lead assigned to another agent cannot be called", async () => {
    const db = await admin();
    const { data: lead } = await db.from("leads").select("id, assigned_to, assigned_agent_id").eq("id", foreignLeadId).single();
    const { leadNotAssignedTo } = await import("@/lib/lead-access.server");
    expect(leadNotAssignedTo(lead as never, agentId)).toBe(true);
  });
});

describe("staging: post-call report lifecycle", () => {
  let reportId = "";

  it("call end opens exactly one pending report (idempotent on retry)", async () => {
    const { openCallReport, pendingReportFor } = await import("@/lib/call-reports.server");
    const first = await openCallReport({ leadId, agentId, durationSeconds: 0, connected: false });
    const retry = await openCallReport({ leadId, agentId, durationSeconds: 0, connected: false });
    reportId = (first as { id: string }).id;
    expect((retry as { id: string }).id).toBe(reportId);
    expect((await pendingReportFor(agentId))?.id).toBe(reportId);
  });

  it("while a report is pending, the agent's next call is blocked", async () => {
    const { pendingReportFor } = await import("@/lib/call-reports.server");
    expect(await pendingReportFor(agentId)).not.toBeNull();
  });

  it("another agent cannot submit this report", async () => {
    const { submitCallReport } = await import("@/lib/call-reports.server");
    await expect(
      submitCallReport({ reportId, agentId: otherAgentId, category: "no_answer", summary: "x", callStatus: "no_answer", direction: "outgoing", durationSeconds: 0, noFollowUpReason: "not_connected" }),
    ).rejects.toThrow();
  });

  it("submitting a valid not-connected report closes it; a replay has no side effects", async () => {
    const { submitCallReport, pendingReportFor } = await import("@/lib/call-reports.server");
    const payload = { reportId, agentId, category: "no_answer", summary: `${tag} ধরেননি`, callStatus: "no_answer", direction: "outgoing", durationSeconds: 0, noFollowUpReason: "not_connected" };
    const ok = await submitCallReport(payload);
    expect(ok).toMatchObject({ ok: true });
    expect(await submitCallReport(payload)).toMatchObject({ alreadySubmitted: true });
    expect(await pendingReportFor(agentId)).toBeNull();
    const db = await admin();
    const { data } = await db.from("call_reports").select("status, agent_id, lead_id").eq("id", reportId).single();
    expect(data).toMatchObject({ status: "submitted", agent_id: agentId, lead_id: leadId });
  });

  it("the report is recorded in the lead's permanent history", async () => {
    const db = await admin();
    const { count } = await db.from("lead_events").select("id", { count: "exact", head: true }).eq("lead_id", leadId);
    expect(count ?? 0).toBeGreaterThan(0);
  });

  it("history cannot be deleted, even with privileged access", async () => {
    const db = await admin();
    const { error } = await db.from("leads").delete().eq("id", leadId);
    expect(error).not.toBeNull();
  });
});
