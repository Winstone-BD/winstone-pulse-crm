import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  OBJECTIONS,
  attributeOutcomes,
  canTransition,
  classifyWhatsApp,
  factEligibility,
  fallbackPitch,
  isAuthoritative,
  pitchCorrelationKey,
  pitchHistoryCsv,
  summarizeEffectiveness,
  validateGrounding,
  whatsappUrl,
} from "@/lib/sales-intel-rules";
import { applyPitchFilters, recordPitchEvent, type SiCaller } from "@/lib/sales-intel.server";

const read = (p: string) => readFileSync(p, "utf8");
const migration = read("drizzle/migrations/0066_sales_intelligence.sql");

/* Fixture-only in-memory database — [TEST] rows, never the live backend. */
type Row = Record<string, any>;
function fakeDb(seed: Record<string, Row[]>) {
  const tables = seed;
  const from = (t: string) => {
    const rows = () => (tables[t] ??= []);
    const filters: ((r: Row) => boolean)[] = [];
    let inserted: Row | null = null;
    let err: { code: string; message: string } | null = null;
    const b: any = {
      select: () => b,
      eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), b),
      in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), b),
      insert: (row: Row) => {
        if (t === "pitch_events" && rows().some((r) => r["correlation_key"] === row["correlation_key"])) err = { code: "23505", message: "dup" };
        else { inserted = { id: `pe-${rows().length + 1}`, created_at: new Date().toISOString(), ...row }; rows().push(inserted); }
        return b;
      },
      update: () => { err = { code: "P0001", message: "Lead history is append-only; add a correcting event instead" }; return b; },
      delete: () => { err = { code: "P0001", message: "Lead history is append-only; add a correcting event instead" }; return b; },
      maybeSingle: async () => (err ? { data: null, error: err } : { data: inserted ?? rows().find((r) => filters.every((f) => f(r))) ?? null, error: null }),
      then: (res: (v: unknown) => void) => res(err ? { data: null, error: err } : { data: rows().filter((r) => filters.every((f) => f(r))), error: null }),
    };
    return b;
  };
  return { from, tables } as any;
}

const A: SiCaller = { scope: "agent", agentId: "agent-a", readOnly: false, actor: "[TEST] Agent A" };
const B: SiCaller = { scope: "agent", agentId: "agent-b", readOnly: false, actor: "[TEST] Agent B" };
const LEAD = "11111111-1111-4111-8111-111111111111";
const seed = () => ({
  leads: [{ id: LEAD, name: "[TEST] Lead", phone_number: "01711000000", assigned_to: "agent-a", assigned_agent_id: "agent-a" }],
  market_facts: [{ id: "f1" }],
  pitch_events: [] as Row[],
});
const input = (over: Partial<Parameters<typeof recordPitchEvent>[1]> = {}) => ({
  leadId: LEAD, objection: "price_high" as const, action: "saved" as const, clientActionId: "client-action-1",
  templateId: null, generatedText: "text", finalText: null, project: null, factIds: ["f1", "ghost"], grounded: false, callId: null, followUpId: null, ...over,
});
const okBriefing = async () => {};

describe("canonical lead integration", () => {
  it("creates no second lead/customer table and links pitch events to canonical leads", () => {
    expect(migration).not.toMatch(/CREATE TABLE public\.(leads|customers|crm_leads|si_leads)/i);
    expect(migration).toMatch(/lead_id uuid NOT NULL REFERENCES public\.leads\(id\)/);
    expect(migration).toMatch(/agent_id uuid NOT NULL REFERENCES public\.profiles\(id\)/);
  });
  it("pitch events appear in the same Lead 360 timeline", () => {
    expect(read("src/lib/lead360.functions.ts")).toMatch(/from\("pitch_events"\)/);
    expect(read("src/lib/lead360.ts")).toMatch(/"pitch_used"/);
  });
});

describe("append-only history + idempotency", () => {
  it("database blocks update/delete and enforces a unique correlation key", () => {
    expect(migration).toMatch(/pitch_events_immutable BEFORE UPDATE OR DELETE ON public\.pitch_events/);
    expect(migration).toMatch(/knowledge_versions_immutable BEFORE UPDATE OR DELETE/);
    expect(migration).toMatch(/correlation_key text NOT NULL UNIQUE/);
  });
  it("same client action twice → one row, second reported as duplicate", async () => {
    const db = fakeDb(seed());
    const r1 = await recordPitchEvent(A, input(), { db, assertBriefing: okBriefing });
    const r2 = await recordPitchEvent(A, input(), { db, assertBriefing: okBriefing });
    expect(r1.duplicate).toBe(false);
    expect(r2.duplicate).toBe(true);
    expect(r2.id).toBe(r1.id);
    expect(db.tables.pitch_events).toHaveLength(1);
  });
  it("actor comes from the session and unknown fact ids are dropped", async () => {
    const db = fakeDb(seed());
    await recordPitchEvent(A, input(), { db, assertBriefing: okBriefing });
    expect(db.tables.pitch_events[0].agent_id).toBe("agent-a");
    expect(db.tables.pitch_events[0].fact_ids).toEqual(["f1"]);
  });
  it("a different action is a new event, never an overwrite", async () => {
    const db = fakeDb(seed());
    await recordPitchEvent(A, input({ action: "copied" }), { db, assertBriefing: okBriefing });
    await recordPitchEvent(A, input({ action: "saved" }), { db, assertBriefing: okBriefing });
    expect(db.tables.pitch_events.map((r: Row) => r.action)).toEqual(["copied", "saved"]);
  });
  it("correlation key is deterministic", () => {
    expect(pitchCorrelationKey("a", "l", "saved", "x")).toBe(pitchCorrelationKey("a", "l", "saved", "x"));
    expect(pitchCorrelationKey("a", "l", "saved", "x")).not.toBe(pitchCorrelationKey("b", "l", "saved", "x"));
  });
});

describe("scope + permission", () => {
  it("wrong agent is denied writing to another agent's lead", async () => {
    const db = fakeDb(seed());
    await expect(recordPitchEvent(B, input(), { db, assertBriefing: okBriefing })).rejects.toThrow(/আপনার তালিকায় নেই/);
    expect(db.tables.pitch_events).toHaveLength(0);
  });
  it("HQ/IT cannot write pitch events on behalf of agents", async () => {
    const db = fakeDb(seed());
    await expect(recordPitchEvent({ scope: "authority", agentId: null, readOnly: false, actor: "IT" }, input(), { db, assertBriefing: okBriefing })).rejects.toThrow();
  });
  it("9:05 briefing gate blocks the write", async () => {
    const db = fakeDb(seed());
    await expect(recordPitchEvent(A, input(), { db, assertBriefing: async () => { throw new Error("briefing required"); } })).rejects.toThrow(/briefing/);
    expect(db.tables.pitch_events).toHaveLength(0);
  });
  it("agent history/export queries are always pinned to the caller's own agent_id", () => {
    const calls: Array<[string, unknown]> = [];
    const q: any = { eq: (c: string, v: unknown) => (calls.push([c, v]), q), gte: () => q, lt: () => q, in: () => q };
    applyPitchFilters(q, A, { agentId: "agent-b" }, null);
    expect(calls).toContainEqual(["agent_id", "agent-a"]);
    expect(calls).not.toContainEqual(["agent_id", "agent-b"]);
    const calls2: Array<[string, unknown]> = [];
    const q2: any = { eq: (c: string, v: unknown) => (calls2.push([c, v]), q2), gte: () => q2, lt: () => q2, in: () => q2 };
    applyPitchFilters(q2, { scope: "authority", agentId: null, readOnly: true, actor: "HQ" }, { agentId: "agent-b", objection: "price_high", action: "saved" }, null);
    expect(calls2).toEqual([["agent_id", "agent-b"], ["objection_code", "price_high"], ["action", "saved"]]);
  });
  it("new tables are server-only (RLS on, no client policies/grants)", () => {
    expect(migration).not.toMatch(/CREATE POLICY/);
    expect(migration).not.toMatch(/TO (anon|authenticated)/);
    expect((migration.match(/ENABLE ROW LEVEL SECURITY/g) ?? []).length).toBe(4);
  });
  it("knowledge writes require HQ/IT writer; HQ view session is read-only", () => {
    const src = read("src/lib/sales-intel.server.ts");
    for (const fn of ["saveFact", "setFactStatus", "saveTemplate", "setTemplateStatus"]) {
      const body = src.slice(src.indexOf(`export async function ${fn}`), src.indexOf(`export async function ${fn}`) + 400);
      expect(body).toMatch(/requireAdminWriter\(c\)/);
      expect(body).toMatch(/c\.readOnly/);
    }
  });
});

describe("market facts verification / expiry", () => {
  const now = Date.parse("2026-10-05T06:00:00Z");
  it("only published, unexpired facts are authoritative", () => {
    expect(factEligibility({ status: "published", expiry_date: null, review_date: null }, now)).toBe("authoritative");
    expect(factEligibility({ status: "verified", expiry_date: null, review_date: null }, now)).toBe("unverified");
    expect(factEligibility({ status: "draft", expiry_date: null, review_date: null }, now)).toBe("unverified");
    expect(factEligibility({ status: "published", expiry_date: "2026-10-04", review_date: null }, now)).toBe("expired");
    expect(factEligibility({ status: "expired", expiry_date: null, review_date: null }, now)).toBe("expired");
    expect(factEligibility({ status: "published", expiry_date: null, review_date: "2026-10-01" }, now)).toBe("review_due");
    expect(isAuthoritative({ status: "published", expiry_date: "2026-10-05", review_date: null }, now)).toBe(true);
  });
  it("status workflow: draft → verified → published → expired; no skipping verification", () => {
    expect(canTransition("draft", "published")).toBe(false);
    expect(canTransition("draft", "verified")).toBe(true);
    expect(canTransition("verified", "published")).toBe(true);
    expect(canTransition("published", "expired")).toBe(true);
    expect(canTransition("expired", "published")).toBe(false);
  });
  it("no hardcoded market numbers in the module code", () => {
    const rules = read("src/lib/sales-intel-rules.ts");
    expect(rules).not.toMatch(/৳|BDT|Tk\s?\d|per sq|\d+(\.\d+)?\s?%/i);
    for (const o of OBJECTIONS) expect(fallbackPitch(o.code, "[TEST]")).not.toMatch(/\d/);
  });
});

describe("AI grounding contract", () => {
  const facts = [{ id: "f1", metric: "Home loan rate", value: "9.5", unit: "%" }];
  it("accepts numbers that come from cited facts or context", () => {
    expect(validateGrounding({ text: "বর্তমান হার 9.5%", fact_ids: ["f1"] }, facts, "Prior calls: 2").ok).toBe(true);
    expect(validateGrounding({ text: "আপনি ২ বার কথা বলেছেন", fact_ids: [] }, facts, "Prior calls: 2").ok).toBe(true);
  });
  it("rejects invented numbers, uncited facts and unknown fact ids", () => {
    expect(validateGrounding({ text: "হার মাত্র 7%", fact_ids: ["f1"] }, facts, "").ok).toBe(false);
    expect(validateGrounding({ text: "হার 9.5%", fact_ids: [] }, facts, "").ok).toBe(false);
    expect(validateGrounding({ text: "ok", fact_ids: ["made-up"] }, facts, "").ok).toBe(false);
    expect(validateGrounding({ text: " ", fact_ids: [] }, facts, "").ok).toBe(false);
  });
  it("the server only passes authoritative facts to the AI", () => {
    expect(read("src/lib/sales-intel.server.ts")).toMatch(/listFacts\(db, \{ onlyAuthoritative: true/);
  });
});

describe("WhatsApp classification", () => {
  it("opening wa.me is never counted as sent or delivered", () => {
    const r = classifyWhatsApp();
    expect(r.action).toBe("whatsapp_opened");
    expect(r.delivered).toBe(false);
    expect(r.label).toMatch(/opened \/ message prepared/);
  });
  it("builds a prefilled link for BD numbers only", () => {
    expect(whatsappUrl("01711-000000", "হ্যালো")).toBe(`https://wa.me/8801711000000?text=${encodeURIComponent("হ্যালো")}`);
    expect(whatsappUrl("+8801911000000", "x")).toMatch(/^https:\/\/wa\.me\/8801911000000/);
    expect(whatsappUrl("12345", "x")).toBeNull();
  });
});

describe("deterministic attribution", () => {
  const pitches = [
    { id: "p1", lead_id: "L1", agent_id: "a", created_at: "2026-10-01T04:00:00Z", objection_code: "price_high", template_id: "t1", project: "X" },
    { id: "p2", lead_id: "L2", agent_id: "b", created_at: "2026-10-01T04:00:00Z", objection_code: "payment", template_id: null, project: null },
  ];
  const outcomes = [
    { id: "o0", lead_id: "L1", at: "2026-09-30T04:00:00Z", kind: "call" as const },
    { id: "o1", lead_id: "L1", at: "2026-10-02T04:00:00Z", kind: "follow_up" as const },
    { id: "o2", lead_id: "L1", at: "2026-10-03T04:00:00Z", kind: "follow_up" as const },
    { id: "o3", lead_id: "L1", at: "2026-10-20T04:00:00Z", kind: "booking" as const },
    { id: "o4", lead_id: "L2", at: "2026-10-05T04:00:00Z", kind: "site_visit" as const },
  ];
  it("links only later outcomes inside the window, first of each kind, same lead", () => {
    const a = attributeOutcomes(pitches, outcomes, 14);
    expect(a).toEqual([
      { pitchId: "p1", kind: "follow_up", outcomeId: "o1", at: "2026-10-02T04:00:00Z" },
      { pitchId: "p2", kind: "site_visit", outcomeId: "o4", at: "2026-10-05T04:00:00Z" },
    ]);
    expect(attributeOutcomes([...pitches].reverse(), [...outcomes].reverse(), 14)).toEqual(a);
    expect(attributeOutcomes(pitches, outcomes, 30).some((x) => x.outcomeId === "o3")).toBe(true);
  });
  it("summary counts are exact event tallies", () => {
    const s = summarizeEffectiveness(pitches, attributeOutcomes(pitches, outcomes, 14));
    expect(s).toMatchObject({ total: 2, toFollowUp: 1, toSiteVisit: 1, toBooking: 0, toCall: 0 });
    expect(s.byObjection).toEqual([{ key: "payment", count: 1 }, { key: "price_high", count: 1 }]);
  });
});

describe("filters, pagination and export", () => {
  it("history uses keyset cursor pagination and export reads every page", () => {
    const src = read("src/lib/sales-intel.server.ts");
    expect(src).toMatch(/created_at\.lt\.\$\{cursor\.at\},and\(created_at\.eq\.\$\{cursor\.at\},id\.lt\.\$\{cursor\.id\}\)/);
    expect(src.slice(src.indexOf("export async function exportPitchEvents"))).toMatch(/await all<PitchRow>/);
  });
  it("CSV carries filters, time, scope, version and leaves missing fields blank", () => {
    const csv = pitchHistoryCsv(
      { filters: { objection: "price_high", agentId: null }, scope: "Own assigned leads only", generatedAt: new Date("2026-10-01T00:00:00Z"), total: 1 },
      [{ id: "p1", created_at: "2026-10-01T00:00:00Z", lead_id: "L1", lead_name: null, agent: "[TEST] A", objection_code: "price_high", template_id: null, action: "whatsapp_opened", project: null, final_text: null, generated_text: "hi", fact_ids: [] }],
    );
    expect(csv).toMatch(/SI-1\.0\.0/);
    expect(csv).toMatch(/Generated \(Asia\/Dhaka\),2026-10-01 06:00/);
    expect(csv).toMatch(/Data scope,Own assigned leads only/);
    expect(csv).toMatch(/Filters,objection=price_high/);
    expect(csv).toMatch(/p1,2026-10-01T00:00:00Z,2026-10-01 06:00,L1,,\[TEST\] A,Price is high,,WhatsApp opened \/ message prepared,,hi,/);
  });
});

describe("existing call/follow-up regression", () => {
  it("call report + follow-up history paths are unchanged by this module", () => {
    expect(migration).not.toMatch(/call_reports|follow_up_events|lead_events/);
    expect(read("src/lib/sales-intel.server.ts")).not.toMatch(/from\("(call_reports|follow_up_events|leads)"\)\.(insert|update|delete|upsert)/);
  });
});
