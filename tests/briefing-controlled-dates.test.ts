import { beforeEach, describe, expect, it, vi } from "vitest";

/* Test fixture store for briefing acknowledgements — never the live database. */
const acks = vi.hoisted(() => ({ rows: [] as Record<string, string>[] }));
vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => {
      const f: Record<string, string> = {};
      const b: any = {
        select: () => b,
        eq: (k: string, v: string) => ((f[k] = v), b),
        maybeSingle: async () => ({ data: acks.rows.find((r) => Object.entries(f).every(([k, v]) => r[k] === v)) ?? null, error: null }),
        insert: async (row: Record<string, string>) => (acks.rows.push(row), { error: null }),
      };
      return b;
    },
  },
}));

const b = await import("@/lib/agent-briefing.server");
const AGENT = "agent-fixture";
// Frozen business dates (Asia/Dhaka = UTC+6)
const D1_0904 = Date.parse("2026-10-13T03:04:00Z"); // 13 Oct 09:04 Dhaka
const D1_0905 = Date.parse("2026-10-13T03:05:00Z"); // 13 Oct 09:05 Dhaka
const D1_1500 = Date.parse("2026-10-13T09:00:00Z");
const D2_0930 = Date.parse("2026-10-14T03:30:00Z"); // 14 Oct 09:30 Dhaka

beforeEach(() => { acks.rows = []; });

describe("9:05 briefing gate on controlled dates", () => {
  it("before 09:05 is not blocked", async () => {
    await expect(b.assertAgentBriefing(AGENT, D1_0904)).resolves.toBeUndefined();
  });
  it("after 09:05 without acknowledgement is blocked", async () => {
    await expect(b.assertAgentBriefing(AGENT, D1_0905)).rejects.toThrow(/৯:০৫/);
  });
  it("after acknowledging the current version, allowed for the rest of the day", async () => {
    await b.acknowledgeAgentBriefing(AGENT, "web", D1_0905);
    await expect(b.assertAgentBriefing(AGENT, D1_1500)).resolves.toBeUndefined();
    expect(acks.rows[0]).toMatchObject({ business_date: "2026-10-13", policy_version: b.AGENT_BRIEFING_POLICY_VERSION });
  });
  it("next business date requires acknowledgement again", async () => {
    await b.acknowledgeAgentBriefing(AGENT, "web", D1_0905);
    await expect(b.assertAgentBriefing(AGENT, D2_0930)).rejects.toThrow();
  });
  it("an acknowledgement for a stale briefing version is blocked", async () => {
    acks.rows.push({ agent_id: AGENT, business_date: "2026-10-13", policy_version: "2026-01-01-v0" });
    await expect(b.assertAgentBriefing(AGENT, D1_1500)).rejects.toThrow();
  });
  it("another agent's acknowledgement does not count", async () => {
    await b.acknowledgeAgentBriefing("someone-else", "web", D1_0905);
    await expect(b.assertAgentBriefing(AGENT, D1_1500)).rejects.toThrow();
  });
  it("HQ/IT callers are never briefing-gated", async () => {
    await expect(b.assertBriefingForCaller({ scope: "authority", profile: null })).resolves.toBeUndefined();
  });
});
